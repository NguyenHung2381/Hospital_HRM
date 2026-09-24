const { getPool, sql } = require('../config/db');
const { comparePassword, needsRehash, hashPassword } = require('../utils/password');
const { signAuthToken, revokeToken } = require('../middleware/auth');
const { recordLoginFailure, recordLoginSuccess } = require('../middleware/loginRateLimit');
const {
	setSessionCookie,
	clearSessionCookie,
	readSessionCookie,
} = require('../utils/sessionCookie');
const { audit } = require('../utils/auditLog');

// Dùng chung 1 thông báo cho sai username / sai mật khẩu / tài khoản bị khoá
// để không lộ tài khoản nào đang tồn tại.
const INVALID_LOGIN_MESSAGE = 'Tên đăng nhập hoặc mật khẩu không đúng';

const USER_SELECT = `
	SELECT u.id_user, u.full_name, u.username, u.password,
		u.position, u.status, u.user_code,
		d.id_department, d.name_department,
		r.id_role, r.name_role, r.department_access_type
	FROM Users u
	LEFT JOIN Departments d ON d.id_department = u.id_department
	LEFT JOIN Roles r ON r.id_role = u.id_role
`;

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

		if (!found || !passwordOk || found.status !== 'active') {
			recordLoginFailure(req);
			audit(req, 'auth.login_failed', { attempted_username: username.slice(0, 50) });
			return res.status(401).json({ success: false, message: INVALID_LOGIN_MESSAGE });
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

		setSessionCookie(req, res, signAuthToken(found));

		const { password: _pw, ...userSafe } = found;
		req.user = { id_user: found.id_user, username: found.username };
		audit(req, 'auth.login');

		res.json({ success: true, data: { user: userSafe } });
	} catch (err) {
		next(err);
	}
}

// POST /api/auth/logout — thu hồi token hiện tại và xoá cookie phiên
function logout(req, res) {
	const token = readSessionCookie(req);
	if (token) revokeToken(token);
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
		const { password: _pw, ...userSafe } = found;
		res.json({ success: true, data: { user: userSafe } });
	} catch (err) {
		next(err);
	}
}

module.exports = { login, logout, me };
