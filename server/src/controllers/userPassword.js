const { getPool, sql } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');

// PUT /api/users/:id/reset-password
async function resetPassword(req, res, next) {
	try {
		const pool = await getPool();
		const userResult = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.query(`SELECT id_user, username FROM Users WHERE id_user = @id`);
		if (!userResult.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy người dùng' });
		const { username } = userResult.recordset[0];
		const hashedPassword = await hashPassword(username);
		await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.input('password', sql.NVarChar(255), hashedPassword)
			.query(
				`UPDATE Users SET password = @password, updated_at = SYSDATETIMEOFFSET() WHERE id_user = @id`,
			);
		res.json({
			success: true,
			message: `Đã đặt lại mật khẩu về mặc định cho tài khoản ${username}`,
		});
	} catch (err) {
		next(err);
	}
}

// PUT /api/users/:id/change-password
async function changePassword(req, res, next) {
	try {
		const { old_password, new_password } = req.body;
		if (!old_password || !new_password)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu mật khẩu cũ hoặc mới' });
		if (new_password.length < 6)
			return res.status(400).json({
				success: false,
				message: 'Mật khẩu mới phải có ít nhất 6 ký tự',
			});

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
		const oldPasswordOk = await comparePassword(old_password, found.password);
		if (!oldPasswordOk)
			return res
				.status(401)
				.json({ success: false, message: 'Mật khẩu hiện tại không đúng' });

		const hashedNewPassword = await hashPassword(new_password);
		await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.input('new_password', sql.NVarChar(255), hashedNewPassword)
			.query(
				`UPDATE Users SET password = @new_password, updated_at = SYSDATETIMEOFFSET() WHERE id_user = @id`,
			);

		res.json({ success: true, message: 'Đổi mật khẩu thành công' });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	resetPassword,
	changePassword,
};
