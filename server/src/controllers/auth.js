const { getPool, sql } = require('../config/db');
const { comparePassword, needsRehash, hashPassword } = require('../utils/password');
const { recordLoginFailure, recordLoginSuccess } = require('../middleware/loginRateLimit');
const {
	setSessionCookie,
	setRefreshCookie,
	clearAuthCookies,
	readSessionCookie,
	readRefreshCookie,
} = require('../utils/sessionCookie');
const {
	ACCESS_TTL_MS,
	passwordFingerprint,
	signAccessToken,
	verifyAccessToken,
} = require('../utils/tokens');
const sessions = require('../services/sessions');
const { audit } = require('../utils/auditLog');

// Dùng chung 1 thông báo cho sai username / sai mật khẩu / tài khoản bị khoá
// để không lộ tài khoản nào đang tồn tại.
const INVALID_LOGIN_MESSAGE = 'Tên đăng nhập hoặc mật khẩu không đúng';
const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
const ACCESS_TTL_SEC = Math.floor(ACCESS_TTL_MS / 1000);

const USER_SELECT = `
	SELECT u.id_user, u.full_name, u.username, u.password,
		u.position, u.status, u.user_code,
		d.id_department, d.name_department,
		r.id_role, r.name_role, r.department_access_type
	FROM Users u
	LEFT JOIN Departments d ON d.id_department = u.id_department
	LEFT JOIN Roles r ON r.id_role = u.id_role
`;

function badRequest(res, message) {
	return res.status(400).json({ success: false, message });
}

// Kiểm tra username/password. Trả về bản ghi user (kèm hash mật khẩu) hoặc
// null nếu sai — khi đó đã ghi nhận brute-force + audit.
async function verifyCredentials(req, failAction) {
	const { username, password } = req.body || {};
	if (
		typeof username !== 'string' ||
		typeof password !== 'string' ||
		!username ||
		!password ||
		username.length > 50 ||
		password.length > 200
	) {
		return { error: 'Thiếu tên đăng nhập hoặc mật khẩu' };
	}

	const pool = await getPool();
	const result = await pool
		.request()
		.input('username', sql.NVarChar(50), username)
		.query(`${USER_SELECT} WHERE u.username = @username`);
	const found = result.recordset[0];

	// Luôn chạy bcrypt (kể cả khi không có user) để thời gian phản hồi như nhau
	const passwordOk = await comparePassword(password, found?.password ?? null);

	if (!found || !passwordOk || found.status !== 'active') {
		recordLoginFailure(req);
		audit(req, failAction, { attempted_username: username.slice(0, 50) });
		return { user: null };
	}
	recordLoginSuccess(req);

	// Mật khẩu cũ còn lưu plaintext / cost thấp → hash lại ngay
	if (needsRehash(found.password)) {
		found.password = await hashPassword(password);
		await pool
			.request()
			.input('id', sql.Int, found.id_user)
			.input('password', sql.NVarChar(255), found.password)
			.query(`UPDATE Users SET password = @password WHERE id_user = @id`);
	}
	req.user = { id_user: found.id_user, username: found.username, name_role: found.name_role };
	return { user: found };
}

function issueAccessToken(user, sid) {
	return signAccessToken({
		id_user: user.id_user,
		username: user.username,
		pwf: passwordFingerprint(user.password),
		sid,
	});
}

function withoutPassword(user) {
	const { password: _pw, ...safe } = user;
	return safe;
}

// ════════════════════ WEB (cookie HttpOnly) ════════════════════

// POST /api/auth/login  { username, password, remember? }
async function login(req, res, next) {
	try {
		const { user, error } = await verifyCredentials(req, 'auth.login_failed');
		if (error) return badRequest(res, error);
		if (!user) return res.status(401).json({ success: false, message: INVALID_LOGIN_MESSAGE });

		const remember = req.body.remember === true;
		const s = await sessions.createSession({
			user,
			clientType: 'web',
			remember,
			ip: req.ip,
			userAgent: req.get('user-agent'),
		});
		setSessionCookie(req, res, issueAccessToken(user, s.sid));
		setRefreshCookie(req, res, s.refreshToken, { expiresAt: s.refreshExpiresAt, remember });
		req.auth = { sid: s.sid, via: 'cookie' };
		audit(req, 'auth.login', { remember });

		res.json({
			success: true,
			data: {
				user: withoutPassword(user),
				session: { expires_in: ACCESS_TTL_SEC, refresh_expires_at: s.refreshExpiresAt },
			},
		});
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/refresh — dùng cookie hrm_refresh xin access token mới
async function refresh(req, res, next) {
	try {
		const token = readRefreshCookie(req);
		if (!token) {
			clearAuthCookies(req, res);
			return res.status(401).json({ success: false, code: 'NO_REFRESH', message: SESSION_EXPIRED_MESSAGE });
		}
		const result = await sessions.rotateRefreshToken(token, {
			clientType: 'web',
			ip: req.ip,
			userAgent: req.get('user-agent'),
		});
		const s = result.session;
		if (s) {
			req.user = { id_user: s.id_user, username: s.username, name_role: s.name_role };
			req.auth = { sid: s.id_session, via: 'cookie' };
		}

		if (result.status === 'reuse') {
			audit(req, 'auth.refresh_reuse', { session_id: s.id_session });
			clearAuthCookies(req, res);
			return res.status(401).json({
				success: false,
				code: 'REFRESH_REUSED',
				message: 'Phiên đăng nhập bị thu hồi vì phát hiện dùng lại token cũ, vui lòng đăng nhập lại',
			});
		}
		if (result.status === 'invalid') {
			audit(req, 'auth.refresh_failed', { reason: result.reason });
			clearAuthCookies(req, res);
			return res.status(401).json({ success: false, code: 'REFRESH_INVALID', message: SESSION_EXPIRED_MESSAGE });
		}

		// 'grace': tab khác vừa xoay token — trình duyệt đã có refresh cookie
		// mới, chỉ cần cấp lại access token.
		setSessionCookie(req, res, issueAccessToken(s, s.id_session));
		if (result.status === 'ok')
			setRefreshCookie(req, res, result.refreshToken, {
				expiresAt: result.refreshExpiresAt,
				remember: !!s.remember,
			});
		audit(req, 'auth.refresh', result.status === 'grace' ? { grace: true } : {});
		res.json({ success: true, data: { expires_in: ACCESS_TTL_SEC } });
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/logout — thu hồi phiên hiện tại và xoá cookie. Không yêu cầu
// access token còn hạn (access hết hạn vẫn đăng xuất được bằng refresh cookie).
async function logout(req, res, next) {
	try {
		const access = verifyAccessToken(readSessionCookie(req) || '');
		let revoked = null;
		if (access) {
			if (await sessions.revokeSession(access.sid, 'logout', { id_user: access.id_user }))
				revoked = { id_session: access.sid, id_user: access.id_user };
			req.user = { id_user: access.id_user, username: access.username };
		}
		const refreshToken = readRefreshCookie(req);
		if (refreshToken) {
			const r = await sessions.revokeByRefreshToken(refreshToken, 'logout', 'web');
			if (r) revoked = r;
		}
		clearAuthCookies(req, res);
		if (revoked) audit(req, 'auth.logout', { session_id: revoked.id_session });
		res.json({ success: true });
	} catch (err) {
		next(err);
	}
}

// GET /api/auth/me — thông tin tài khoản đang đăng nhập
async function me(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id', sql.Int, req.user.id_user)
			.query(`${USER_SELECT} WHERE u.id_user = @id`);
		const found = result.recordset[0];
		if (!found) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
		res.json({
			success: true,
			data: {
				user: withoutPassword(found),
				session: { id: req.auth.sid, via: req.auth.via, access_expires_at: new Date(req.auth.exp * 1000) },
			},
		});
	} catch (err) {
		next(err);
	}
}

// ════════════════════ API CLIENT (Bearer token) ════════════════════
// Cho Postman / ứng dụng / hệ thống khác gọi API. Token trả trong body,
// KHÔNG đặt cookie; gọi API bằng header "Authorization: Bearer <access_token>".

// POST /api/auth/token  { username, password }
async function issueToken(req, res, next) {
	try {
		const { user, error } = await verifyCredentials(req, 'auth.token_failed');
		if (error) return badRequest(res, error);
		if (!user) return res.status(401).json({ success: false, message: INVALID_LOGIN_MESSAGE });

		const s = await sessions.createSession({
			user,
			clientType: 'api',
			remember: true,
			ip: req.ip,
			userAgent: req.get('user-agent'),
		});
		req.auth = { sid: s.sid, via: 'bearer' };
		audit(req, 'auth.token');
		res.json({
			success: true,
			data: {
				token_type: 'Bearer',
				access_token: issueAccessToken(user, s.sid),
				expires_in: ACCESS_TTL_SEC,
				refresh_token: s.refreshToken,
				refresh_expires_at: s.refreshExpiresAt,
				session_id: s.sid,
			},
		});
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/token/refresh  { refresh_token } — trả cặp token mới
// (refresh token cũ hết giá trị ngay).
async function refreshToken(req, res, next) {
	try {
		const token = req.body?.refresh_token;
		if (typeof token !== 'string' || !token) return badRequest(res, 'Thiếu refresh_token');
		const result = await sessions.rotateRefreshToken(token, {
			clientType: 'api',
			ip: req.ip,
			userAgent: req.get('user-agent'),
		});
		const s = result.session;
		if (s) {
			req.user = { id_user: s.id_user, username: s.username, name_role: s.name_role };
			req.auth = { sid: s.id_session, via: 'bearer' };
		}
		if (result.status === 'grace')
			return res.status(409).json({
				success: false,
				code: 'REFRESH_IN_PROGRESS',
				message: 'Refresh token vừa được dùng bởi 1 request khác — hãy dùng cặp token mới nhất',
			});
		if (result.status === 'reuse') {
			audit(req, 'auth.refresh_reuse', { session_id: s.id_session });
			return res.status(401).json({
				success: false,
				code: 'REFRESH_REUSED',
				message: 'Refresh token đã được dùng trước đó — phiên bị thu hồi, hãy xin token mới',
			});
		}
		if (result.status === 'invalid') {
			audit(req, 'auth.refresh_failed', { reason: result.reason });
			return res.status(401).json({ success: false, code: 'REFRESH_INVALID', message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
		}
		audit(req, 'auth.refresh');
		res.json({
			success: true,
			data: {
				token_type: 'Bearer',
				access_token: issueAccessToken(s, s.id_session),
				expires_in: ACCESS_TTL_SEC,
				refresh_token: result.refreshToken,
				refresh_expires_at: result.refreshExpiresAt,
				session_id: s.id_session,
			},
		});
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/token/revoke  { refresh_token } — đăng xuất client API
async function revokeToken(req, res, next) {
	try {
		const r = await sessions.revokeByRefreshToken(req.body?.refresh_token, 'logout', 'api');
		if (r) {
			req.user = { id_user: r.id_user };
			audit(req, 'auth.logout', { session_id: r.id_session });
		}
		// Luôn trả thành công (RFC 7009) — không cho dò token nào tồn tại
		res.json({ success: true });
	} catch (err) {
		next(err);
	}
}

// ════════════════════ PHIÊN CỦA CHÍNH MÌNH ════════════════════

function toSessionDto(s, currentSid) {
	return {
		id: s.id_session,
		id_user: s.id_user,
		username: s.username,
		full_name: s.full_name,
		name_role: s.name_role,
		client_type: s.client_type,
		remember: !!s.remember,
		ip_address: s.ip_address,
		user_agent: s.user_agent,
		created_at: s.created_at,
		last_used_at: s.last_used_at,
		expires_at: s.expires_at,
		current: s.id_session === currentSid,
	};
}

// GET /api/auth/sessions
async function mySessions(req, res, next) {
	try {
		const rows = await sessions.listActiveSessions({ id_user: req.user.id_user });
		res.json({ success: true, data: rows.map((s) => toSessionDto(s, req.auth.sid)) });
	} catch (err) {
		next(err);
	}
}

// DELETE /api/auth/sessions/:sid — thu hồi 1 phiên (thiết bị) của chính mình
async function revokeMySession(req, res, next) {
	try {
		const sid = String(req.params.sid);
		if (!/^[0-9a-f]{32}$/.test(sid)) return badRequest(res, 'Mã phiên không hợp lệ');
		const ok = await sessions.revokeSession(sid, 'user_revoke', { id_user: req.user.id_user });
		if (!ok) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên đăng nhập' });
		audit(req, 'session.revoke', { session_id: sid, self: true });
		if (sid === req.auth.sid) clearAuthCookies(req, res);
		res.json({ success: true, message: 'Đã đăng xuất thiết bị' });
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/logout-all — đăng xuất mọi thiết bị khác, giữ phiên hiện tại
async function logoutOthers(req, res, next) {
	try {
		const count = await sessions.revokeUserSessions(req.user.id_user, 'logout_all', req.auth.sid);
		audit(req, 'auth.logout_all', { revoked: count });
		res.json({ success: true, message: `Đã đăng xuất ${count} thiết bị khác`, data: { revoked: count } });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	login,
	refresh,
	logout,
	me,
	issueToken,
	refreshToken,
	revokeToken,
	mySessions,
	revokeMySession,
	logoutOthers,
	toSessionDto,
};
