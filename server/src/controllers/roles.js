const { getPool, sql } = require('../config/db');
const appEmitter = require('../events/appEmitter');
const { isAdmin, invalidateUserCache } = require('../middleware/auth');
const { isReservedRoleName } = require('../services/accountGuard');

const DEPARTMENT_ACCESS_TYPES = ['all', 'assigned', 'own'];

// GET /api/roles
async function getAll(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool.request().query(`
			SELECT id_role, name_role, description, icon, color,
				is_system, department_access_type, created_at, updated_at
			FROM Roles ORDER BY id_role ASC
		`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// GET /api/roles/:id — kèm permissions
async function getById(req, res, next) {
	try {
		const pool = await getPool();
		const [roleResult, permResult] = await Promise.all([
			pool
				.request()
				.input('id_role', sql.Int, req.params.id)
				.query(`SELECT * FROM Roles WHERE id_role = @id_role`),
			pool.request().input('id_role', sql.Int, req.params.id).query(`
				SELECT p.id_permission, p.code_permission, p.label, p.group_name, rp.is_granted
				FROM Role_Permissions rp
				INNER JOIN Permissions p ON p.id_permission = rp.id_permission
				WHERE rp.id_role = @id_role
				ORDER BY p.sort_order
			`),
		]);

		if (!roleResult.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy vai trò' });

		res.json({
			success: true,
			data: { ...roleResult.recordset[0], permissions: permResult.recordset },
		});
	} catch (err) {
		next(err);
	}
}

// POST /api/roles
async function create(req, res, next) {
	try {
		const {
			name,
			description,
			icon,
			color,
			is_system,
			department_access_type,
		} = req.body;
		if (!name)
			return res
				.status(400)
				.json({ success: false, message: 'Tên vai trò không được để trống' });
		if (isReservedRoleName(name))
			return res.status(403).json({
				success: false,
				message: 'Tên vai trò này đã được hệ thống dành riêng',
			});
		if (department_access_type && !DEPARTMENT_ACCESS_TYPES.includes(department_access_type))
			return res
				.status(400)
				.json({ success: false, message: 'Loại truy cập khoa không hợp lệ' });

		const pool = await getPool();
		const result = await pool
			.request()
			.input('name_role', sql.NVarChar(100), name)
			.input('description', sql.NVarChar(sql.MAX), description ?? null)
			.input('icon', sql.NVarChar(20), icon ?? null)
			.input('color', sql.NVarChar(20), color ?? null)
			// Vai trò hệ thống (không sửa/xoá được) — chỉ Quản trị hệ thống được đặt
			.input('is_system', sql.Bit, isAdmin(req.user) && is_system ? 1 : 0)
			.input(
				'department_access_type',
				sql.NVarChar(10),
				department_access_type ?? 'own',
			).query(`
				INSERT INTO Roles (name_role, description, icon, color, is_system, department_access_type)
				OUTPUT INSERTED.*
				VALUES (@name_role, @description, @icon, @color, @is_system, @department_access_type)
			`);

		appEmitter.emit('changed', {
			resource: 'roles',
			action: 'created',
			id: result.recordset[0].id_role,
		});
		res.status(201).json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// PUT /api/roles/:id
async function update(req, res, next) {
	try {
		const { name, description, icon, color, department_access_type } = req.body;
		if (department_access_type && !DEPARTMENT_ACCESS_TYPES.includes(department_access_type))
			return res
				.status(400)
				.json({ success: false, message: 'Loại truy cập khoa không hợp lệ' });
		const pool = await getPool();

		const check = await pool
			.request()
			.input('id_role', sql.Int, req.params.id)
			.query(`SELECT id_role, name_role, is_system FROM Roles WHERE id_role = @id_role`);
		if (!check.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy vai trò' });
		if (check.recordset[0].is_system)
			return res.status(403).json({
				success: false,
				message: 'Không thể sửa vai trò hệ thống',
			});
		// Đổi tên thành / từ 1 vai trò dashboard sẽ trao / tước quyền quản trị
		// của mọi tài khoản thuộc vai trò đó → không cho phép qua API.
		const renaming =
			String(name ?? '').trim() !== String(check.recordset[0].name_role).trim();
		if (
			renaming &&
			(isReservedRoleName(name) || isReservedRoleName(check.recordset[0].name_role))
		)
			return res.status(403).json({
				success: false,
				message: 'Không thể đổi tên sang/từ vai trò quản trị dành riêng',
			});

		const result = await pool
			.request()
			.input('id_role', sql.Int, req.params.id)
			.input('name_role', sql.NVarChar(100), name)
			.input('description', sql.NVarChar(sql.MAX), description ?? null)
			.input('icon', sql.NVarChar(20), icon ?? null)
			.input('color', sql.NVarChar(20), color ?? null)
			.input(
				'department_access_type',
				sql.NVarChar(10),
				department_access_type ?? 'own',
			).query(`
				UPDATE Roles
				SET name_role = @name_role, description = @description, icon = @icon,
					color = @color, department_access_type = @department_access_type,
					updated_at = SYSDATETIMEOFFSET()
				OUTPUT INSERTED.*
				WHERE id_role = @id_role
			`);

		invalidateUserCache(); // tên vai trò quyết định quyền của mọi user thuộc vai trò
		appEmitter.emit('changed', {
			resource: 'roles',
			action: 'updated',
			id: Number(req.params.id),
		});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// PUT /api/roles/:id/permissions
async function updatePermissions(req, res, next) {
	try {
		const { permissions } = req.body;
		if (!Array.isArray(permissions))
			return res
				.status(400)
				.json({ success: false, message: 'permissions phải là mảng' });

		const pool = await getPool();

		const check = await pool
			.request()
			.input('id_role', sql.Int, req.params.id)
			.query(`SELECT id_role, is_system FROM Roles WHERE id_role = @id_role`);
		if (!check.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy vai trò' });
		if (check.recordset[0].is_system)
			return res.status(403).json({
				success: false,
				message: 'Không thể sửa quyền của vai trò hệ thống',
			});

		const transaction = new sql.Transaction(pool);
		await transaction.begin();
		try {
			await transaction
				.request()
				.input('id_role', sql.Int, req.params.id)
				.query(`DELETE FROM Role_Permissions WHERE id_role = @id_role`);

			for (const p of permissions) {
				await transaction
					.request()
					.input('id_role', sql.Int, req.params.id)
					.input('id_permission', sql.Int, p.permission_id)
					.input('is_granted', sql.Bit, p.is_granted ? 1 : 0).query(`
						INSERT INTO Role_Permissions (id_role, id_permission, is_granted)
						VALUES (@id_role, @id_permission, @is_granted)
					`);
			}
			await transaction.commit();
			appEmitter.emit('changed', {
				resource: 'roles',
				action: 'updated',
				id: Number(req.params.id),
			});
			res.json({ success: true, message: 'Đã cập nhật quyền thành công' });
		} catch (err) {
			await transaction.rollback();
			throw err;
		}
	} catch (err) {
		next(err);
	}
}

// GET /api/permissions
async function getAllPermissions(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool.request().query(`
			SELECT id_permission, code_permission, label, group_name, sort_order
			FROM Permissions ORDER BY sort_order
		`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getAll,
	getById,
	create,
	update,
	updatePermissions,
	getAllPermissions,
};
