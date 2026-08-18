const { getPool, sql } = require('../config/db');
const appEmitter = require('../events/appEmitter');

// GET /api/users/:id/departments
// Trả về danh sách khoa user được phép xem theo department_access_type
async function getDepartments(req, res, next) {
	try {
		const pool = await getPool();
		const userResult = await pool.request().input('id', sql.Int, req.params.id)
			.query(`
			SELECT u.id_user, u.id_department, r.department_access_type
			FROM Users u
			INNER JOIN Roles r ON r.id_role = u.id_role
			WHERE u.id_user = @id AND u.status = 'active'
		`);
		if (!userResult.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy người dùng' });

		const { id_department, department_access_type } = userResult.recordset[0];
		let departments = [];

		const TT03_JOIN = `LEFT JOIN Dept_TT03_Config cfg ON cfg.id_department = d.id_department`;
		const TT03_COLS = `
			cfg.formula_type, cfg.patient_ratio, cfg.shift_divisor,
			cfg.shift_multiplier, cfg.fixed_add, cfg.note AS tt03_note`;

		const REC_JOIN = `LEFT JOIN Dept_Recommended_Config rec ON rec.id_department = d.id_department`;
		const REC_COLS = `
			rec.formula_type   AS rec_formula_type,
			rec.coef_l1        AS rec_coef_l1,
			rec.coef_l2        AS rec_coef_l2,
			rec.coef_l3        AS rec_coef_l3,
			rec.outpatient_ratio AS rec_outpatient_ratio,
			rec.fixed_add      AS rec_fixed_add,
			rec.note           AS rec_note`;

		if (department_access_type === 'all') {
			const r = await pool.request().query(`
				SELECT d.id_department, d.name_department, d.code_department, d.bed_count,
					d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total, d.total_staff, d.dept_group,
					${TT03_COLS},
					${REC_COLS}
				FROM Departments d ${TT03_JOIN} ${REC_JOIN}
				WHERE d.status = 'active' ORDER BY d.id_department ASC
			`);
			departments = r.recordset;
		} else if (department_access_type === 'assigned') {
			const r = await pool
				.request()
				.input('id', sql.Int, req.params.id)
				.input('id_department', sql.Int, id_department ?? null).query(`
					SELECT DISTINCT d.id_department, d.name_department, d.code_department, d.bed_count,
						d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total, d.total_staff, d.dept_group,
						${TT03_COLS},
						${REC_COLS}
					FROM Departments d ${TT03_JOIN} ${REC_JOIN}
					WHERE d.status = 'active'
					  AND (
						d.id_department IN (
							SELECT uda.id_department FROM User_Department_Access uda WHERE uda.id_user = @id
						)
						OR d.id_department = @id_department
					  )
					ORDER BY d.id_department ASC
				`);
			departments = r.recordset;
		} else {
			// own
			if (id_department) {
				const r = await pool
					.request()
					.input('id_department', sql.Int, id_department).query(`
						SELECT d.id_department, d.name_department, d.code_department, d.bed_count,
							d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total, d.total_staff, d.dept_group,
							${TT03_COLS},
							${REC_COLS}
						FROM Departments d ${TT03_JOIN} ${REC_JOIN}
						WHERE d.id_department = @id_department AND d.status = 'active'
					`);
				departments = r.recordset;
			}
		}

		res.json({ success: true, data: departments });
	} catch (err) {
		next(err);
	}
}

// GET /api/users/:id/assigned-departments
async function getAssignedDepartments(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool.request().input('id', sql.Int, req.params.id)
			.query(`
				SELECT d.id_department, d.name_department, d.status
				FROM User_Department_Access uda
				INNER JOIN Departments d ON d.id_department = uda.id_department
				WHERE uda.id_user = @id
				ORDER BY d.id_department ASC
			`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// PUT /api/users/:id/assigned-departments
async function setAssignedDepartments(req, res, next) {
	try {
		const { department_ids } = req.body;
		if (!Array.isArray(department_ids))
			return res
				.status(400)
				.json({ success: false, message: 'department_ids phải là mảng' });
		const pool = await getPool();
		const transaction = new sql.Transaction(pool);
		await transaction.begin();
		try {
			await transaction
				.request()
				.input('id', sql.Int, req.params.id)
				.query(`DELETE FROM User_Department_Access WHERE id_user = @id`);
			for (const dept_id of department_ids) {
				await transaction
					.request()
					.input('id_user', sql.Int, req.params.id)
					.input('id_department', sql.Int, dept_id)
					.query(
						`INSERT INTO User_Department_Access (id_user, id_department) VALUES (@id_user, @id_department)`,
					);
			}
			await transaction.commit();
			appEmitter.emit('changed', {
				resource: 'users',
				action: 'updated',
				id: Number(req.params.id),
			});
			res.json({
				success: true,
				message: `Đã phân ${department_ids.length} khoa cho người dùng`,
			});
		} catch (err) {
			await transaction.rollback();
			throw err;
		}
	} catch (err) {
		next(err);
	}
}

// GET /api/users/:id/dept-permissions
async function getDeptPermissions(req, res, next) {
	try {
		const pool = await getPool();

		const userResult = await pool.request().input('id', sql.Int, req.params.id)
			.query(`
				SELECT u.id_department, r.department_access_type
				FROM Users u
				INNER JOIN Roles r ON r.id_role = u.id_role
				WHERE u.id_user = @id AND u.status = 'active'
			`);

		if (!userResult.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy người dùng' });

		const { id_department, department_access_type } = userResult.recordset[0];

		// ── all: toàn bộ khoa, full quyền ─────────────────────
		if (department_access_type === 'all') {
			const r = await pool.request().query(`
				SELECT id_department, name_department,
					CAST(1 AS BIT) AS can_edit,
					CAST(1 AS BIT) AS can_delete,
					CAST(1 AS BIT) AS can_export
				FROM Departments WHERE status = 'active' ORDER BY id_department ASC
			`);
			return res.json({ success: true, data: r.recordset });
		}

		// ── assigned: khoa được phân, quyền từ User_Dept_Permissions ──
		if (department_access_type === 'assigned') {
			const r = await pool
				.request()
				.input('id', sql.Int, req.params.id)
				.input('id_department', sql.Int, id_department ?? null).query(`
					SELECT DISTINCT d.id_department, d.name_department,
						CAST(COALESCE(udp.can_edit,   1) AS BIT) AS can_edit,
						CAST(COALESCE(udp.can_delete, 0) AS BIT) AS can_delete,
						CAST(COALESCE(udp.can_export, 1) AS BIT) AS can_export
					FROM Departments d
					LEFT JOIN User_Dept_Permissions udp
						ON udp.id_department = d.id_department AND udp.id_user = @id
					WHERE d.status = 'active'
					  AND (
						d.id_department IN (
							SELECT uda.id_department FROM User_Department_Access uda WHERE uda.id_user = @id
						)
						OR d.id_department = @id_department
					  )
					ORDER BY d.id_department ASC
				`);
			return res.json({ success: true, data: r.recordset });
		}

		// ── own: chỉ khoa công tác, quyền từ User_Dept_Permissions ──
		if (!id_department) return res.json({ success: true, data: [] });

		const r = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.input('id_department', sql.Int, id_department).query(`
				SELECT d.id_department, d.name_department,
					CAST(COALESCE(udp.can_edit,   1) AS BIT) AS can_edit,
					CAST(COALESCE(udp.can_delete, 0) AS BIT) AS can_delete,
					CAST(COALESCE(udp.can_export, 0) AS BIT) AS can_export
				FROM Departments d
				LEFT JOIN User_Dept_Permissions udp
					ON udp.id_department = d.id_department AND udp.id_user = @id
				WHERE d.id_department = @id_department AND d.status = 'active'
			`);
		res.json({ success: true, data: r.recordset });
	} catch (err) {
		next(err);
	}
}

// PUT /api/users/:id/dept-permissions
async function setDeptPermissions(req, res, next) {
	try {
		const { permissions } = req.body;
		if (!Array.isArray(permissions))
			return res
				.status(400)
				.json({ success: false, message: 'permissions phải là mảng' });
		const pool = await getPool();
		const transaction = new sql.Transaction(pool);
		await transaction.begin();
		try {
			await transaction
				.request()
				.input('id', sql.Int, req.params.id)
				.query(`DELETE FROM User_Dept_Permissions WHERE id_user = @id`);
			for (const p of permissions) {
				await transaction
					.request()
					.input('id_user', sql.Int, req.params.id)
					.input('id_department', sql.Int, p.id_department)
					.input('can_edit', sql.Bit, p.can_edit ? 1 : 0)
					.input('can_delete', sql.Bit, p.can_delete ? 1 : 0)
					.input('can_export', sql.Bit, p.can_export ? 1 : 0).query(`
						INSERT INTO User_Dept_Permissions (id_user, id_department, can_edit, can_delete, can_export)
						VALUES (@id_user, @id_department, @can_edit, @can_delete, @can_export)
					`);
			}
			await transaction.commit();
			appEmitter.emit('changed', {
				resource: 'users',
				action: 'updated',
				id: Number(req.params.id),
			});
			res.json({ success: true, message: 'Đã cập nhật quyền thao tác khoa' });
		} catch (err) {
			await transaction.rollback();
			throw err;
		}
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getDepartments,
	getAssignedDepartments,
	setAssignedDepartments,
	getDeptPermissions,
	setDeptPermissions,
};
