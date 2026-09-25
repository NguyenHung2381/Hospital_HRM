const { getPool, sql } = require('../config/db');
const {
	hashPassword,
	comparePassword,
	validatePasswordPolicy,
	generateTempPassword,
} = require('../utils/password');
const { invalidateUserCache, createAuthSession } = require('../middleware/auth');
const sessionStore = require('../services/sessionStore');
const { logSecurityEvent } = require('../utils/securityEvents');
const { assertCanManageUser } = require('../services/accountGuard');
const { setSessionCookie } = require('../utils/sessionCookie');
const { audit } = require('../utils/auditLog');
const { trustDevice, revokeTrustedDevices } = require('../services/trustedDevice');

// PUT /api/users/:id/reset-password
// Đặt mật khẩu tạm NGẪU NHIÊN (trước đây đặt = username → ai biết tên đăng
// nhập là vào được). Mật khẩu tạm chỉ trả về 1 lần cho người quản trị để
// chuyển cho chủ tài khoản; mọi phiên đăng nhập cũ của tài khoản bị huỷ.
async function resetPassword(req, res, next) {
	try {
		const pool = await getPool();
		const userResult = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.query(`
				SELECT u.id_user, u.username, r.name_role
				FROM Users u LEFT JOIN Roles r ON r.id_role = u.id_role
				WHERE u.id_user = @id
			`);
		if (!userResult.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy người dùng' });
		const target = userResult.recordset[0];

		const denied = assertCanManageUser(req.user, target);
		if (denied) return res.status(403).json({ success: false, message: denied });

		const tempPassword = generateTempPassword();
		const hashedPassword = await hashPassword(tempPassword);
		await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.input('password', sql.NVarChar(255), hashedPassword)
			.query(
				`UPDATE Users SET password = @password, failed_login_count = 0, locked_until = NULL,
					lockout_level = 0, updated_at = SYSDATETIMEOFFSET()
				 WHERE id_user = @id`,
			);
		invalidateUserCache(target.id_user);
		await sessionStore.revokeAllSessions(target.id_user);
		await revokeTrustedDevices(pool, target.id_user);
		req.auditLogged = true;
		audit(req, 'user.reset_password', {
			target_user_id: target.id_user,
			target_username: target.username,
		});
		await logSecurityEvent(req, {
			eventType: 'password_reset_by_admin',
			actorId: req.user.id_user,
			targetId: target.id_user,
			detail: `Đặt lại mật khẩu + mở khoá tài khoản ${target.username}`,
		});

		res.set('Cache-Control', 'no-store');
		res.json({
			success: true,
			message: `Đã đặt lại mật khẩu cho tài khoản ${target.username}`,
			data: { temp_password: tempPassword },
		});
	} catch (err) {
		next(err);
	}
}

// PUT /api/users/:id/change-password — chỉ chính chủ (cần mật khẩu hiện tại)
async function changePassword(req, res, next) {
	try {
		const { old_password, new_password } = req.body || {};
		if (typeof old_password !== 'string' || typeof new_password !== 'string' || !old_password || !new_password)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu mật khẩu cũ hoặc mới' });

		const pool = await getPool();
		const userResult = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.query(
				`SELECT id_user, username, password FROM Users WHERE id_user = @id`,
			);

		if (!userResult.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy người dùng' });

		const found = userResult.recordset[0];

		const policyError = validatePasswordPolicy(new_password, { username: found.username });
		if (policyError)
			return res.status(400).json({ success: false, message: policyError });
		if (new_password === old_password)
			return res.status(400).json({
				success: false,
				message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
			});

		const oldPasswordOk = await comparePassword(old_password, found.password);
		// 400 (không phải 401) để client không hiểu nhầm là phiên hết hạn và tự đăng xuất
		if (!oldPasswordOk)
			return res
				.status(400)
				.json({ success: false, message: 'Mật khẩu hiện tại không đúng' });

		const hashedNewPassword = await hashPassword(new_password);
		await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.input('new_password', sql.NVarChar(255), hashedNewPassword)
			.query(
				`UPDATE Users SET password = @new_password, updated_at = SYSDATETIMEOFFSET() WHERE id_user = @id`,
			);
		invalidateUserCache(found.id_user);

		// Đổi mật khẩu thường vì nghi lộ → thu hồi mọi phiên và bỏ "quen" mọi
		// thiết bị, rồi cấp phiên mới + giữ "quen" cho thiết bị hiện tại để người
		// dùng không bị đăng xuất.
		await sessionStore.revokeAllSessions(found.id_user);
		await revokeTrustedDevices(pool, found.id_user);
		setSessionCookie(
			req,
			res,
			await createAuthSession(req, { ...found, password: hashedNewPassword }),
		);
		await trustDevice(req, res, found.id_user);
		req.auditLogged = true;
		audit(req, 'user.change_password', { target_user_id: found.id_user });
		await logSecurityEvent(req, {
			eventType: 'password_changed',
			actorId: found.id_user,
			targetId: found.id_user,
		});

		res.json({ success: true, message: 'Đổi mật khẩu thành công' });
	} catch (err) {
		next(err);
	}
}

// PUT /api/users/:id/reset-2fa — quản trị tắt 2FA cho người dùng bị mất điện
// thoại / app xác thực. Chủ tài khoản đăng nhập lại bằng mật khẩu rồi tự
// thiết lập 2FA mới. Mọi phiên cũ của tài khoản bị huỷ.
async function reset2FA(req, res, next) {
	try {
		const pool = await getPool();
		const userResult = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.query(`
				SELECT u.id_user, u.username, u.totp_enabled, r.name_role
				FROM Users u LEFT JOIN Roles r ON r.id_role = u.id_role
				WHERE u.id_user = @id
			`);
		const target = userResult.recordset[0];
		if (!target)
			return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

		const denied = assertCanManageUser(req.user, target);
		if (denied) return res.status(403).json({ success: false, message: denied });
		if (!target.totp_enabled)
			return res
				.status(400)
				.json({ success: false, message: 'Tài khoản này chưa bật xác thực 2 lớp' });

		await pool
			.request()
			.input('id', sql.Int, target.id_user)
			.query(
				`UPDATE Users SET totp_secret = NULL, totp_enabled = 0,
					totp_verified_at = NULL, totp_last_step = NULL,
					updated_at = SYSDATETIMEOFFSET()
				 WHERE id_user = @id`,
			);
		await sessionStore.revokeAllSessions(target.id_user);
		req.auditLogged = true;
		await logSecurityEvent(req, {
			eventType: '2fa_reset_by_admin',
			actorId: req.user.id_user,
			targetId: target.id_user,
			detail: `Tắt xác thực 2 lớp của tài khoản ${target.username}`,
		});
		res.json({
			success: true,
			message: `Đã tắt xác thực 2 lớp cho tài khoản ${target.username}`,
		});
	} catch (err) {
		next(err);
	}
}

module.exports = {
	resetPassword,
	changePassword,
	reset2FA,
};
