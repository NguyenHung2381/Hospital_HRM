const { getPool, sql } = require('../config/db');
const appEmitter = require('../events/appEmitter');
const { hashPassword } = require('../utils/password');

// GET /api/users
async function getAll(req, res, next) {
	try {
		const { status, id_role, id_department } = req.query;
		const pool = await getPool();
		const request = pool.request();
		const where = [];
		if (status) {
			where.push('u.status = @status');
			request.input('status', sql.NVarChar(10), status);
		}
		if (id_role) {
			where.push('u.id_role = @id_role');
			request.input('id_role', sql.Int, id_role);
		}
		if (id_department) {
			where.push('u.id_department = @id_department');
			request.input('id_department', sql.Int, id_department);
		}
		const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
		const result = await request.query(`
			SELECT u.id_user, u.full_name, u.username, u.user_code, u.position, u.status,
				u.created_at, u.updated_at,
				d.id_department, d.name_department,
				r.id_role, r.name_role, r.department_access_type
			FROM Users u
			LEFT JOIN Departments d ON d.id_department = u.id_department
			LEFT JOIN Roles r ON r.id_role = u.id_role
			${whereClause}
			ORDER BY u.user_code
		`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// GET /api/users/:id
async function getById(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool.request().input('id', sql.Int, req.params.id)
			.query(`
			SELECT u.id_user, u.full_name, u.username, u.user_code, u.position, u.status,
				u.created_at, u.updated_at,
				d.id_department, d.name_department,
				r.id_role, r.name_role, r.department_access_type
			FROM Users u
			LEFT JOIN Departments d ON d.id_department = u.id_department
			LEFT JOIN Roles r ON r.id_role = u.id_role
			WHERE u.id_user = @id
		`);
		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy người dùng' });
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// POST /api/users
async function create(req, res, next) {
	try {
		const {
			full_name,
			username,
			password,
			user_code,
			id_department,
			position,
			id_role,
			status,
		} = req.body;
		if (!full_name || !username || !password || !id_role)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu thông tin bắt buộc' });
		const hashedPassword = await hashPassword(password);
		const pool = await getPool();
		const result = await pool
			.request()
			.input('full_name', sql.NVarChar(150), full_name)
			.input('username', sql.NVarChar(50), username)
			.input('password', sql.NVarChar(255), hashedPassword)
			.input('user_code', sql.NVarChar(10), user_code ?? null)
			.input('id_department', sql.Int, id_department ?? null)
			.input('position', sql.NVarChar(100), position ?? null)
			.input('id_role', sql.Int, id_role)
			.input('status', sql.NVarChar(10), status ?? 'active').query(`
				DECLARE @uout TABLE (
					id_user INT, full_name NVARCHAR(150), username NVARCHAR(50),
					user_code NVARCHAR(10), id_department INT, position NVARCHAR(100),
					id_role INT, status NVARCHAR(10), created_at DATETIMEOFFSET
				);
				INSERT INTO Users (full_name, username, password, user_code, id_department, position, id_role, status)
				OUTPUT INSERTED.id_user, INSERTED.full_name, INSERTED.username,
					INSERTED.user_code, INSERTED.id_department, INSERTED.position,
					INSERTED.id_role, INSERTED.status, INSERTED.created_at
				INTO @uout
				VALUES (@full_name, @username, @password, @user_code, @id_department, @position, @id_role, @status);
				SELECT * FROM @uout;
			`);
		appEmitter.emit('changed', {
			resource: 'users',
			action: 'created',
			id: result.recordset[0].id_user,
		});
		res.status(201).json({ success: true, data: result.recordset[0] });
	} catch (err) {
		if (err.number === 2627)
			return res
				.status(409)
				.json({ success: false, message: 'Tên tài khoản đã tồn tại' });
		next(err);
	}
}

// PUT /api/users/:id
async function update(req, res, next) {
	try {
		const { full_name, user_code, id_department, position, id_role, status } =
			req.body;
		const pool = await getPool();
		const check = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.query(`SELECT id_user FROM Users WHERE id_user = @id`);
		if (!check.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy người dùng' });
		const result = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.input('full_name', sql.NVarChar(150), full_name)
			.input('user_code', sql.NVarChar(10), user_code ?? null)
			.input('id_department', sql.Int, id_department ?? null)
			.input('position', sql.NVarChar(100), position ?? null)
			.input('id_role', sql.Int, id_role)
			.input('status', sql.NVarChar(10), status ?? 'active').query(`
				DECLARE @uout TABLE (
					id_user INT, full_name NVARCHAR(150), username NVARCHAR(50),
					user_code NVARCHAR(10), id_department INT, position NVARCHAR(100),
					id_role INT, status NVARCHAR(10), updated_at DATETIMEOFFSET
				);
				UPDATE Users
				SET full_name = @full_name, user_code = @user_code,
					id_department = @id_department, position = @position,
					id_role = @id_role, status = @status,
					updated_at = SYSDATETIMEOFFSET()
				OUTPUT INSERTED.id_user, INSERTED.full_name, INSERTED.username,
					INSERTED.user_code, INSERTED.id_department, INSERTED.position,
					INSERTED.id_role, INSERTED.status, INSERTED.updated_at
				INTO @uout
				WHERE id_user = @id;
				SELECT * FROM @uout;
			`);
		appEmitter.emit('changed', {
			resource: 'users',
			action: 'updated',
			id: Number(req.params.id),
		});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// DELETE /api/users/:id
async function remove(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool.request().input('id_user', sql.Int, req.params.id)
			.query(`
				DECLARE @dout TABLE (id_user INT);
				DELETE FROM Users OUTPUT DELETED.id_user INTO @dout WHERE id_user = @id_user;
				SELECT * FROM @dout;
			`);
		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy người dùng' });
		appEmitter.emit('changed', {
			resource: 'users',
			action: 'deleted',
			id: Number(req.params.id),
		});
		res.json({ success: true, message: 'Đã xoá người dùng thành công' });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getAll,
	getById,
	create,
	update,
	remove,
};
