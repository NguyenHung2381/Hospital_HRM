const { getPool, sql } = require('../config/db');
const {
	hashPassword,
	comparePassword,
	validatePasswordPolicy,
	generateTempPassword,
} = require('../utils/password');
const { invalidateUserCache } = require('../middleware/auth');
const { assertCanManageUser } = require('../services/accountGuard');
const { setSessionCookie } = require('../utils/sessionCookie');
const { signAccessToken, passwordFingerprint } = require('../utils/tokens');
const sessions = require('../services/sessions');
const { audit } = require('../utils/auditLog');

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
				`UPDATE Users SET password = @password, updated_at = SYSDATETIMEOFFSET() WHERE id_user = @id`,
			);
		invalidateUserCache(target.id_user);
		const revoked = await sessions.revokeUserSessions(target.id_user, 'password_reset');
		audit(req, 'user.reset_password', {
			target_user_id: target.id_user,
			target_username: target.username,
			revoked_sessions: revoked,
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

		// Mọi thiết bị khác bị đăng xuất; phiên hiện tại được giữ, cập nhật
		// dấu vân tay mật khẩu mới và cấp access token mới (token cũ mang dấu
		// vân tay cũ nên hết hiệu lực) để người dùng không bị đăng xuất.
		const revoked = await sessions.revokeUserSessions(found.id_user, 'password_changed', req.auth.sid);
		await sessions.updateSessionFingerprint(req.auth.sid, hashedNewPassword);
		const accessToken = signAccessToken({
			id_user: found.id_user,
			username: found.username,
			pwf: passwordFingerprint(hashedNewPassword),
			sid: req.auth.sid,
		});
		// Client web nhận cookie mới; client API (Bearer) nhận token trong body
		if (req.auth.via === 'cookie') setSessionCookie(req, res, accessToken);
		audit(req, 'user.change_password', { target_user_id: found.id_user, revoked_sessions: revoked });

		res.json({
			success: true,
			message: 'Đổi mật khẩu thành công',
			...(req.auth.via === 'bearer' ? { data: { access_token: accessToken } } : {}),
		});
	} catch (err) {
		next(err);
	}
}

module.exports = {
	resetPassword,
	changePassword,
};
