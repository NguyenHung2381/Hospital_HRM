const { getPool, sql } = require('../config/db');
const { comparePassword } = require('../utils/password');
const { createTotpSetup, verifyTotpCode } = require('../services/twoFactor');
const sessionStore = require('../services/sessionStore');
const { logSecurityEvent } = require('../utils/securityEvents');

// Các thao tác bảo mật trên CHÍNH tài khoản đang đăng nhập (req.user):
// xác thực 2 lớp (TOTP) và quản lý phiên đăng nhập trên các thiết bị.

async function loadSelf(pool, id_user) {
	const r = await pool
		.request()
		.input('id', sql.Int, id_user)
		.query(
			`SELECT id_user, username, password, totp_secret, totp_enabled, totp_last_step
			 FROM Users WHERE id_user = @id`,
		);
	return r.recordset[0];
}

// GET /api/auth/2fa/status
async function status2FA(req, res, next) {
	try {
		const pool = await getPool();
		const me = await loadSelf(pool, req.user.id_user);
		res.json({ success: true, data: { enabled: !!me?.totp_enabled } });
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/2fa/setup — sinh secret mới (chưa bật, chờ xác nhận mã đầu
// tiên). Secret lưu ngay ở server để client không phải giữ giữa 2 bước.
// Không cho setup lại khi 2FA đang bật: nếu không, 1 phiên bị chiếm có thể
// ghi đè secret và vô hiệu hoá 2FA mà không cần mật khẩu.
async function setup2FA(req, res, next) {
	try {
		const pool = await getPool();
		const me = await loadSelf(pool, req.user.id_user);
		if (!me) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
		if (me.totp_enabled)
			return res.status(400).json({
				success: false,
				message: 'Xác thực 2 lớp đang bật. Hãy tắt trước khi thiết lập lại.',
			});

		const setup = await createTotpSetup(me.username);
		await pool
			.request()
			.input('id', sql.Int, me.id_user)
			.input('secret', sql.NVarChar(255), setup.secret)
			.query(
				`UPDATE Users SET totp_secret = @secret, totp_enabled = 0,
					totp_verified_at = NULL, totp_last_step = NULL
				 WHERE id_user = @id`,
			);
		req.auditLogged = true;
		res.json({ success: true, data: setup });
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/2fa/verify-setup { code } — xác nhận mã đầu tiên → bật 2FA
async function verifySetup2FA(req, res, next) {
	try {
		const pool = await getPool();
		const me = await loadSelf(pool, req.user.id_user);
		if (!me?.totp_secret)
			return res.status(400).json({
				success: false,
				message: 'Chưa khởi tạo thiết lập 2FA, vui lòng bắt đầu lại',
			});
		if (me.totp_enabled)
			return res.status(400).json({ success: false, message: 'Xác thực 2 lớp đã được bật' });

		const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
		const timeStep = await verifyTotpCode(me.totp_secret, code, me.totp_last_step);
		if (timeStep == null)
			return res.status(400).json({ success: false, message: 'Mã xác thực không đúng' });

		await pool
			.request()
			.input('id', sql.Int, me.id_user)
			.input('step', sql.BigInt, timeStep)
			.query(
				`UPDATE Users SET totp_enabled = 1, totp_verified_at = SYSUTCDATETIME(),
					totp_last_step = @step
				 WHERE id_user = @id`,
			);
		req.auditLogged = true;
		await logSecurityEvent(req, {
			eventType: '2fa_enabled',
			actorId: me.id_user,
			targetId: me.id_user,
		});
		res.json({ success: true, message: 'Đã bật xác thực 2 lớp' });
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/2fa/disable { password } — yêu cầu nhập lại mật khẩu
async function disable2FA(req, res, next) {
	try {
		const pool = await getPool();
		const me = await loadSelf(pool, req.user.id_user);
		if (!me) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

		const ok = await comparePassword(req.body?.password, me.password);
		// 400 (không phải 401) để client không hiểu nhầm là hết phiên
		if (!ok) return res.status(400).json({ success: false, message: 'Mật khẩu không đúng' });

		await pool
			.request()
			.input('id', sql.Int, me.id_user)
			.query(
				`UPDATE Users SET totp_secret = NULL, totp_enabled = 0,
					totp_verified_at = NULL, totp_last_step = NULL
				 WHERE id_user = @id`,
			);
		req.auditLogged = true;
		await logSecurityEvent(req, {
			eventType: '2fa_disabled',
			actorId: me.id_user,
			targetId: me.id_user,
		});
		res.json({ success: true, message: 'Đã tắt xác thực 2 lớp' });
	} catch (err) {
		next(err);
	}
}

// GET /api/auth/sessions — các phiên đăng nhập đang hoạt động của tôi
async function listSessions(req, res, next) {
	try {
		const rows = await sessionStore.listSessions(req.user.id_user);
		res.json({
			success: true,
			data: rows.map((r) => ({
				id: r.jti,
				ip_address: r.ip_address,
				user_agent: r.user_agent,
				created_at: r.created_at,
				last_seen_at: r.last_seen_at,
				expires_at: r.expires_at,
				current: r.jti === req.sessionJti,
			})),
		});
	} catch (err) {
		next(err);
	}
}

// DELETE /api/auth/sessions/:sessionId — đăng xuất 1 thiết bị khác
async function revokeSession(req, res, next) {
	try {
		const { sessionId } = req.params;
		if (!/^[0-9a-f]{32}$/.test(sessionId))
			return res.status(400).json({ success: false, message: 'Phiên không hợp lệ' });
		if (sessionId === req.sessionJti)
			return res.status(400).json({
				success: false,
				message: 'Dùng nút Đăng xuất để thoát phiên hiện tại',
			});
		const n = await sessionStore.revokeSession(sessionId, req.user.id_user);
		if (!n) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên' });
		req.auditLogged = true;
		await logSecurityEvent(req, {
			eventType: 'session_revoked',
			actorId: req.user.id_user,
			targetType: 'session',
			targetId: sessionId.slice(0, 8),
		});
		res.json({ success: true, message: 'Đã đăng xuất thiết bị' });
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/logout-all — đăng xuất mọi thiết bị KHÁC (giữ phiên hiện tại)
async function logoutOtherSessions(req, res, next) {
	try {
		const n = await sessionStore.revokeAllSessions(req.user.id_user, req.sessionJti);
		req.auditLogged = true;
		await logSecurityEvent(req, {
			eventType: 'logout_all_sessions',
			actorId: req.user.id_user,
			targetId: req.user.id_user,
			detail: `Đăng xuất ${n} phiên trên thiết bị khác`,
		});
		res.json({ success: true, message: `Đã đăng xuất ${n} thiết bị khác`, data: { revoked: n } });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	status2FA,
	setup2FA,
	verifySetup2FA,
	disable2FA,
	listSessions,
	revokeSession,
	logoutOtherSessions,
};
