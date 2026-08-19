const { getPool, sql } = require('../config/db');
const jwt = require('jsonwebtoken');
const { comparePassword } = require('../utils/password');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// POST /api/auth/login
async function login(req, res, next) {
	try {
		const { username, password } = req.body;
		if (!username || !password) {
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu tên đăng nhập hoặc mật khẩu' });
		}

		const pool = await getPool();
		const result = await pool
			.request()
			.input('username', sql.NVarChar(50), username).query(`
				SELECT u.id_user, u.full_name, u.username, u.password,
					u.position, u.status, u.user_code,
					d.id_department, d.name_department,
					r.id_role, r.name_role, r.department_access_type
				FROM Users u
				LEFT JOIN Departments d ON d.id_department = u.id_department
				LEFT JOIN Roles r ON r.id_role = u.id_role
				WHERE u.username = @username
			`);

		const found = result.recordset[0];

		if (!found || found.status !== 'active') {
			return res.status(404).json({
				success: false,
				message: 'Tài khoản không tồn tại hoặc đã bị khoá',
			});
		}

		const passwordOk = await comparePassword(password, found.password);
		if (!passwordOk) {
			return res
				.status(401)
				.json({ success: false, message: 'Mật khẩu không đúng' });
		}

		const payload = {
			id_user: found.id_user,
			username: found.username,
			id_role: found.id_role,
			name_role: found.name_role,
		};
		const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

		const { password: _pw, ...userSafe } = found;

		res.json({ success: true, data: { user: userSafe, token } });
	} catch (err) {
		next(err);
	}
}

module.exports = { login };
