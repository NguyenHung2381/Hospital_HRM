const { getPool, sql } = require('../config/db');
const { comparePassword, needsRehash, hashPassword } = require('../utils/password');
const {
	createAuthSession,
	signPreAuthToken,
	verifyPreAuthToken,
	revokeToken,
	passwordFingerprint,
} = require('../middleware/auth');
const { recordLoginFailure, recordLoginSuccess } = require('../middleware/loginRateLimit');
const {
	lockedMinutesLeft,
	recordFailedAttempt,
	resetFailedAttempts,
	isRepeatedWrongPassword,
} = require('../services/accountLockout');
const {
	findTrustedDevice,
	trustDevice,
	recordDeviceFailure,
} = require('../services/trustedDevice');
const { verifyTotpCode } = require('../services/twoFactor');
const {
	setSessionCookie,
	clearSessionCookie,
	readSessionCookie,
} = require('../utils/sessionCookie');
const { audit } = require('../utils/auditLog');
const { logSecurityEvent } = require('../utils/securityEvents');

// Dùng chung 1 thông báo cho sai username / sai mật khẩu / tài khoản bị khoá
// để không lộ tài khoản nào đang tồn tại.
const INVALID_LOGIN_MESSAGE = 'Tên đăng nhập hoặc mật khẩu không đúng';

const USER_SELECT = `
	SELECT u.id_user, u.full_name, u.username, u.password,
		u.position, u.status, u.user_code,
		u.failed_login_count, u.locked_until,
		u.totp_enabled, u.totp_secret, u.totp_last_step,
		d.id_department, d.name_department,
		r.id_role, r.name_role, r.department_access_type
	FROM Users u
	LEFT JOIN Departments d ON d.id_department = u.id_department
	LEFT JOIN Roles r ON r.id_role = u.id_role
`;

// Bỏ các cột nhạy cảm (hash mật khẩu, secret 2FA, bộ đếm khoá) trước khi trả client
function toSafeUser(found) {
	const {
		password: _pw,
		totp_secret: _ts,
		totp_last_step: _tls,
		failed_login_count: _flc,
		locked_until: _lu,
		...rest
	} = found;
	return { ...rest, totp_enabled: !!found.totp_enabled };
}

function lockedResponse(res, minutes) {
	res.set('Retry-After', String(minutes * 60));
	return res.status(429).json({
		success: false,
		code: 'ACCOUNT_LOCKED',
		message: `Tài khoản tạm khoá do đăng nhập sai nhiều lần. Thử lại sau ${minutes} phút.`,
	});
}

// Phát phiên đăng nhập thật (cookie HttpOnly) — dùng chung cho đăng nhập
// thường và bước 2 (sau khi xác minh mã OTP). Trình duyệt này thành thiết
// bị quen của user.
async function completeLogin(req, res, found, extraAudit = {}) {
	setSessionCookie(req, res, await createAuthSession(req, found));
	await trustDevice(req, res, found.id_user);
	req.user = { id_user: found.id_user, username: found.username };
	audit(req, 'auth.login', extraAudit);
	res.json({ success: true, data: { user: toSafeUser(found) } });
}

// POST /api/auth/login
async function login(req, res, next) {
	try {
		const { username, password } = req.body || {};
		if (
			typeof username !== 'string' ||
			typeof password !== 'string' ||
			!username ||
			!password ||
			username.length > 50 ||
			password.length > 200
		) {
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu tên đăng nhập hoặc mật khẩu' });
		}

		const pool = await getPool();
		const result = await pool
			.request()
			.input('username', sql.NVarChar(50), username)
			.query(`${USER_SELECT} WHERE u.username = @username`);

		const found = result.recordset[0];

		// Luôn chạy bcrypt (kể cả khi không có user) để thời gian phản hồi như nhau
		const passwordOk = await comparePassword(password, found?.password ?? null);

		// Thiết bị quen không bị khoá tạm tài khoản chặn — kẻ tấn công cố tình
		// nhập sai từ máy khác không khoá được chủ tài khoản trên máy của họ.
		const trustedDevice = found ? await findTrustedDevice(pool, req, found.id_user) : null;

		// Tài khoản đang bị khoá tạm (với thiết bị lạ): chỉ báo "đang khoá" khi
		// mật khẩu ĐÚNG (chủ tài khoản thật) — sai mật khẩu vẫn trả thông báo
		// chung để không lộ tài khoản tồn tại, và không cộng thêm lần sai (khoá
		// không bị kéo dài).
		const lockedMinutes = trustedDevice ? 0 : lockedMinutesLeft(found);
		if (found && lockedMinutes > 0) {
			recordLoginFailure(req);
			audit(req, 'auth.login_blocked_locked', { attempted_username: username.slice(0, 50) });
			if (passwordOk && found.status === 'active') return lockedResponse(res, lockedMinutes);
			return res.status(401).json({ success: false, message: INVALID_LOGIN_MESSAGE });
		}

		if (!found || !passwordOk || found.status !== 'active') {
			recordLoginFailure(req);
			audit(req, 'auth.login_failed', { attempted_username: username.slice(0, 50) });
			// Không báo "đã khoá" ở đây dù vừa chạm ngưỡng (mật khẩu đang sai) —
			// chủ tài khoản nhập đúng ở lần sau sẽ thấy thông báo khoá.
			if (found && !passwordOk && !isRepeatedWrongPassword(found.id_user, password)) {
				if (trustedDevice) await recordDeviceFailure(pool, req, trustedDevice, 'sai mật khẩu');
				else await recordFailedAttempt(pool, req, found, 'sai mật khẩu');
			}
			return res.status(401).json({ success: false, message: INVALID_LOGIN_MESSAGE });
		}

		recordLoginSuccess(req);
		// Đăng nhập đúng trên thiết bị quen không xoá bộ đếm/khoá của thiết bị
		// lạ — nếu không, kẻ tấn công được làm lại từ đầu mỗi khi chủ tài khoản
		// đăng nhập. Bộ đếm của thiết bị quen được reset trong trustDevice().
		if (!trustedDevice) await resetFailedAttempts(pool, found);

		// Mật khẩu cũ còn lưu plaintext / cost thấp → hash lại ngay
		if (needsRehash(found.password)) {
			found.password = await hashPassword(password);
			await pool
				.request()
				.input('id', sql.Int, found.id_user)
				.input('password', sql.NVarChar(255), found.password)
				.query(`UPDATE Users SET password = @password WHERE id_user = @id`);
		}

		// Đã bật 2FA: dừng ở đây, KHÔNG phát phiên — chỉ trả pre-auth token ngắn
		// hạn để client gọi tiếp /auth/2fa/verify kèm mã OTP.
		if (found.totp_enabled && found.totp_secret) {
			return res.json({
				success: true,
				data: { requires_2fa: true, pre_auth_token: signPreAuthToken(found) },
			});
		}

		await completeLogin(req, res, found);
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/2fa/verify — bước 2 của đăng nhập cho tài khoản đã bật 2FA
async function verify2FALogin(req, res, next) {
	try {
		const { pre_auth_token, code } = req.body || {};
		const pre = verifyPreAuthToken(pre_auth_token);
		if (!pre)
			return res.status(401).json({
				success: false,
				code: 'PRE_AUTH_EXPIRED',
				message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
			});

		const pool = await getPool();
		const result = await pool
			.request()
			.input('id', sql.Int, pre.id_user)
			.query(`${USER_SELECT} WHERE u.id_user = @id`);
		const found = result.recordset[0];
		if (
			!found ||
			found.status !== 'active' ||
			passwordFingerprint(found.password) !== pre.pwf ||
			!found.totp_enabled ||
			!found.totp_secret
		)
			return res.status(401).json({
				success: false,
				code: 'PRE_AUTH_EXPIRED',
				message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
			});

		const trustedDevice = await findTrustedDevice(pool, req, found.id_user);
		const lockedMinutes = trustedDevice ? 0 : lockedMinutesLeft(found);
		if (lockedMinutes > 0) return lockedResponse(res, lockedMinutes);

		const timeStep = await verifyTotpCode(
			found.totp_secret,
			typeof code === 'string' ? code.trim() : '',
			found.totp_last_step,
		);
		if (timeStep == null) {
			await logSecurityEvent(req, {
				eventType: 'login_2fa_failed',
				actorId: found.id_user,
				targetId: found.id_user,
				detail: 'Sai mã xác thực 2 lớp lúc đăng nhập',
			});
			// Sai OTP cũng tính vào bộ đếm khoá (của thiết bị quen, hoặc của tài
			// khoản với thiết bị lạ) — chặn dò mã 6 số
			if (trustedDevice) {
				await recordDeviceFailure(pool, req, trustedDevice, 'sai mã 2FA');
			} else {
				const lockMinutes = await recordFailedAttempt(pool, req, found, 'sai mã 2FA');
				if (lockMinutes) return lockedResponse(res, lockMinutes);
			}
			return res
				.status(400)
				.json({ success: false, message: 'Mã xác thực không đúng hoặc đã hết hạn' });
		}

		await pool
			.request()
			.input('id', sql.Int, found.id_user)
			.input('step', sql.BigInt, timeStep)
			.query(`UPDATE Users SET totp_last_step = @step WHERE id_user = @id`);
		if (!trustedDevice) await resetFailedAttempts(pool, found);

		await completeLogin(req, res, found, { two_factor: true });
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/logout — thu hồi phiên hiện tại và xoá cookie phiên
async function logout(req, res) {
	const token = readSessionCookie(req);
	if (token) await revokeToken(token).catch((err) => console.error('[logout]', err.message));
	clearSessionCookie(req, res);
	req.auditLogged = true;
	res.json({ success: true });
}

// GET /api/auth/me — thông tin tài khoản đang đăng nhập (client dùng khi tải
// lại trang để lấy vai trò/trạng thái mới nhất từ server)
async function me(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id', sql.Int, req.user.id_user)
			.query(`${USER_SELECT} WHERE u.id_user = @id`);
		const found = result.recordset[0];
		if (!found)
			return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
		res.json({ success: true, data: { user: toSafeUser(found) } });
	} catch (err) {
		next(err);
	}
}

module.exports = { login, verify2FALogin, logout, me };
