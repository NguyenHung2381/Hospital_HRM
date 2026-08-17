const { getPool, sql } = require('../config/db');
const appEmitter = require('../events/appEmitter');

// GET /api/departments
async function getAll(req, res, next) {
	try {
		const { status, group } = req.query;
		const pool = await getPool();
		const request = pool.request();

		let query = `
			SELECT d.id_department, d.name_department, d.code_department, d.bed_count,
				d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total,
				d.total_staff, d.status, d.dept_group, d.created_at, d.updated_at,
				-- Cấu hình TT03 (nếu có)
				cfg.formula_type, cfg.patient_ratio, cfg.shift_divisor,
				cfg.shift_multiplier, cfg.fixed_add, cfg.note AS tt03_note,
				-- Cấu hình Khuyến nghị (nếu có)
				rec.formula_type   AS rec_formula_type,
				rec.coef_l1        AS rec_coef_l1,
				rec.coef_l2        AS rec_coef_l2,
				rec.coef_l3        AS rec_coef_l3,
				rec.outpatient_ratio AS rec_outpatient_ratio,
				rec.fixed_add      AS rec_fixed_add,
				rec.note           AS rec_note
			FROM Departments d
			LEFT JOIN Dept_TT03_Config cfg ON cfg.id_department = d.id_department
			LEFT JOIN Dept_Recommended_Config rec ON rec.id_department = d.id_department
		`;
		const where = [];
		if (status) {
			where.push('d.status = @status');
			request.input('status', sql.NVarChar(10), status);
		}
		if (group && group !== 'all') {
			where.push('d.dept_group = @group');
			request.input('group', sql.NVarChar(10), group);
		}
		if (where.length) query += ` WHERE ${where.join(' AND ')}`;
		query += ` ORDER BY d.id_department ASC`;

		const result = await request.query(query);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// GET /api/departments/simple  — chỉ id + tên, dùng để check khoa chưa nhập dữ liệu
// Query param "group" (ward | cls) lọc theo dept_group — mặc định 'ward' để không phá
// logic "khoa chưa nhập" của báo cáo khối nội trú hiện có khi thêm khoa nhóm khác.
async function getSimple(req, res, next) {
	try {
		const { group = 'ward' } = req.query;
		const pool = await getPool();
		const request = pool.request();
		let query = `
			SELECT id_department, name_department AS department_name
			FROM Departments
			WHERE status = 'active'
		`;
		if (group && group !== 'all') {
			query += ` AND dept_group = @group`;
			request.input('group', sql.NVarChar(10), group);
		}
		query += ` ORDER BY id_department ASC`;
		const result = await request.query(query);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// GET /api/departments/:id
async function getById(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.id).query(`
				SELECT d.id_department, d.name_department, d.code_department, d.bed_count,
					d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total,
					d.total_staff, d.status, d.created_at, d.updated_at,
					cfg.formula_type, cfg.patient_ratio, cfg.shift_divisor,
					cfg.shift_multiplier, cfg.fixed_add, cfg.note AS tt03_note,
					rec.formula_type   AS rec_formula_type,
					rec.coef_l1        AS rec_coef_l1,
					rec.coef_l2        AS rec_coef_l2,
					rec.coef_l3        AS rec_coef_l3,
					rec.outpatient_ratio AS rec_outpatient_ratio,
					rec.fixed_add      AS rec_fixed_add,
					rec.note           AS rec_note
				FROM Departments d
				LEFT JOIN Dept_TT03_Config cfg ON cfg.id_department = d.id_department
				LEFT JOIN Dept_Recommended_Config rec ON rec.id_department = d.id_department
				WHERE d.id_department = @id_department
			`);

		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy khoa' });

		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// POST /api/departments
async function create(req, res, next) {
	try {
		const {
			name,
			code_department,
			bed_count,
			coef_level_1,
			coef_level_2,
			coef_level_3,
			coef_total,
			total_staff,
			status,
			// TT03 fields (tuỳ chọn khi tạo)
			formula_type,
			fixed_add,
		} = req.body;
		if (!name)
			return res
				.status(400)
				.json({ success: false, message: 'Tên khoa không được để trống' });

		const pool = await getPool();
		const transaction = new sql.Transaction(pool);
		await transaction.begin();

		try {
			// Dùng @out TABLE variable để tránh lỗi trigger + OUTPUT clause
			const result = await transaction
				.request()
				.input('name_department', sql.NVarChar(sql.MAX), name)
				.input('code_department', sql.NVarChar(10), code_department ?? null)
				.input('bed_count', sql.SmallInt, bed_count ?? null)
				.input('coef_level_1', sql.Decimal(5, 4), coef_level_1 ?? 0.5)
				.input('coef_level_2', sql.Decimal(5, 4), coef_level_2 ?? 0.104)
				.input('coef_level_3', sql.Decimal(5, 4), coef_level_3 ?? 0.104)
				.input('coef_total', sql.Decimal(5, 4), coef_total ?? 0.12)
				.input('total_staff', sql.SmallInt, total_staff ?? null)
				.input('status', sql.NVarChar(10), status ?? 'active').query(`
					DECLARE @out TABLE (id_department INT);
					INSERT INTO Departments
						(name_department, code_department, bed_count, coef_level_1, coef_level_2,
						coef_level_3, coef_total, total_staff, status)
					OUTPUT INSERTED.id_department INTO @out
					VALUES (@name_department, @code_department, @bed_count, @coef_level_1, @coef_level_2,
						@coef_level_3, @coef_total, @total_staff, @status);

					SELECT d.id_department, d.name_department, d.code_department, d.bed_count,
						d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total,
						d.total_staff, d.status, d.created_at, d.updated_at
					FROM Departments d
					INNER JOIN @out o ON d.id_department = o.id_department;
				`);

			const newDept = result.recordset[0];

			// Nếu có formula_type → tạo config TT03 luôn
			if (formula_type) {
				await transaction
					.request()
					.input('id_department', sql.Int, newDept.id_department)
					.input('formula_type', sql.NVarChar(20), formula_type)
					.input('fixed_add', sql.Decimal(5, 1), fixed_add ?? 0).query(`
						INSERT INTO Dept_TT03_Config (id_department, formula_type, fixed_add)
						VALUES (@id_department, @formula_type, @fixed_add)
					`);
			}

			await transaction.commit();
			appEmitter.emit('changed', {
				resource: 'departments',
				action: 'created',
				id: newDept.id_department,
			});
			res.status(201).json({ success: true, data: newDept });
		} catch (err) {
			await transaction.rollback();
			throw err;
		}
	} catch (err) {
		if (err.number === 2627 || err.number === 2601)
			return res.status(409).json({
				success: false,
				message: 'Mã khoa đã tồn tại, vui lòng chọn mã khác',
			});
		next(err);
	}
}

// PUT /api/departments/:id
async function update(req, res, next) {
	try {
		const {
			name,
			code_department,
			bed_count,
			coef_level_1,
			coef_level_2,
			coef_level_3,
			coef_total,
			total_staff,
			status,
		} = req.body;
		const pool = await getPool();

		const check = await pool
			.request()
			.input('id_department', sql.Int, req.params.id)
			.query(
				`SELECT id_department FROM Departments WHERE id_department = @id_department`,
			);
		if (!check.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy khoa' });

		// Dùng @out TABLE variable để tránh lỗi trigger + OUTPUT clause
		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.id)
			.input('name_department', sql.NVarChar(sql.MAX), name)
			.input('code_department', sql.NVarChar(10), code_department ?? null)
			.input('bed_count', sql.SmallInt, bed_count ?? null)
			.input('coef_level_1', sql.Decimal(5, 4), coef_level_1 ?? 0.5)
			.input('coef_level_2', sql.Decimal(5, 4), coef_level_2 ?? 0.104)
			.input('coef_level_3', sql.Decimal(5, 4), coef_level_3 ?? 0.104)
			.input('coef_total', sql.Decimal(5, 4), coef_total ?? 0.12)
			.input('total_staff', sql.SmallInt, total_staff ?? null)
			.input('status', sql.NVarChar(10), status ?? 'active').query(`
				DECLARE @out TABLE (id_department INT);
				UPDATE Departments
				SET name_department = @name_department, code_department = @code_department,
					bed_count = @bed_count, coef_level_1 = @coef_level_1,
					coef_level_2 = @coef_level_2, coef_level_3 = @coef_level_3,
					coef_total = @coef_total, total_staff = @total_staff, status = @status,
					updated_at = SYSDATETIMEOFFSET()
				OUTPUT INSERTED.id_department INTO @out
				WHERE id_department = @id_department;

				SELECT d.id_department, d.name_department, d.code_department, d.bed_count,
					d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total,
					d.total_staff, d.status, d.created_at, d.updated_at
				FROM Departments d
				INNER JOIN @out o ON d.id_department = o.id_department;
			`);

		appEmitter.emit('changed', {
			resource: 'departments',
			action: 'updated',
			id: Number(req.params.id),
		});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		if (err.number === 2627 || err.number === 2601)
			return res.status(409).json({
				success: false,
				message: 'Mã khoa đã tồn tại, vui lòng chọn mã khác',
			});
		next(err);
	}
}

// DELETE /api/departments/:id
async function remove(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.id)
			.query(
				`DELETE FROM Departments OUTPUT DELETED.id_department WHERE id_department = @id_department`,
			);

		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy khoa' });

		appEmitter.emit('changed', {
			resource: 'departments',
			action: 'deleted',
			id: Number(req.params.id),
		});
		res.json({ success: true, message: 'Đã xoá khoa thành công' });
	} catch (err) {
		if (err.number === 547)
			return res.status(409).json({
				success: false,
				message:
					'Không thể xoá khoa này vì đã có dữ liệu báo cáo/ cấu hình liên quan. Vui lòng chuyển trạng thái sang "Ngừng hoạt động" thay vì xoá.',
			});
		next(err);
	}
}

// ─── Dept_Recommended_Config ────────────────────────────────────────────────

// GET /api/departments/:id/recommended-config
async function getRecommendedConfig(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.id).query(`
				SELECT id, id_department, formula_type,
					coef_l1, coef_l2, coef_l3,
					outpatient_ratio, fixed_add, note,
					created_at, updated_at
				FROM Dept_Recommended_Config
				WHERE id_department = @id_department
			`);

		if (!result.recordset.length)
			return res.status(404).json({
				success: false,
				message: 'Chưa có cấu hình khuyến nghị cho khoa này',
			});

		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// POST /api/departments/:id/recommended-config
async function createRecommendedConfig(req, res, next) {
	try {
		const {
			formula_type,
			coef_l1,
			coef_l2,
			coef_l3,
			outpatient_ratio,
			fixed_add,
			note,
		} = req.body;

		if (!formula_type)
			return res
				.status(400)
				.json({ success: false, message: 'formula_type không được để trống' });

		const pool = await getPool();

		const deptCheck = await pool
			.request()
			.input('id_department', sql.Int, req.params.id)
			.query(
				`SELECT id_department FROM Departments WHERE id_department = @id_department`,
			);
		if (!deptCheck.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy khoa' });

		const existing = await pool
			.request()
			.input('id_department', sql.Int, req.params.id)
			.query(
				`SELECT id FROM Dept_Recommended_Config WHERE id_department = @id_department`,
			);
		if (existing.recordset.length)
			return res.status(409).json({
				success: false,
				message: 'Khoa này đã có cấu hình khuyến nghị. Dùng PUT để cập nhật.',
			});

		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.id)
			.input('formula_type', sql.NVarChar(20), formula_type)
			.input('coef_l1', sql.Decimal(5, 4), coef_l1 ?? 0)
			.input('coef_l2', sql.Decimal(5, 4), coef_l2 ?? 0)
			.input('coef_l3', sql.Decimal(5, 4), coef_l3 ?? 0)
			.input('outpatient_ratio', sql.Decimal(5, 4), outpatient_ratio ?? null)
			.input('fixed_add', sql.Decimal(6, 1), fixed_add ?? 0)
			.input('note', sql.NVarChar(300), note ?? null).query(`
				INSERT INTO Dept_Recommended_Config
					(id_department, formula_type, coef_l1, coef_l2, coef_l3,
					outpatient_ratio, fixed_add, note)
				OUTPUT INSERTED.*
				VALUES (@id_department, @formula_type, @coef_l1, @coef_l2, @coef_l3,
					@outpatient_ratio, @fixed_add, @note)
			`);

		appEmitter.emit('changed', {
			resource: 'departments',
			action: 'updated',
			id: Number(req.params.id),
		});
		res.status(201).json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// PUT /api/departments/:id/recommended-config
async function updateRecommendedConfig(req, res, next) {
	try {
		const {
			formula_type,
			coef_l1,
			coef_l2,
			coef_l3,
			outpatient_ratio,
			fixed_add,
			note,
		} = req.body;

		if (!formula_type)
			return res
				.status(400)
				.json({ success: false, message: 'formula_type không được để trống' });

		const pool = await getPool();

		const check = await pool
			.request()
			.input('id_department', sql.Int, req.params.id)
			.query(
				`SELECT id FROM Dept_Recommended_Config WHERE id_department = @id_department`,
			);
		if (!check.recordset.length)
			return res.status(404).json({
				success: false,
				message:
					'Chưa có cấu hình khuyến nghị cho khoa này. Dùng POST để tạo mới.',
			});

		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.id)
			.input('formula_type', sql.NVarChar(20), formula_type)
			.input('coef_l1', sql.Decimal(5, 4), coef_l1 ?? 0)
			.input('coef_l2', sql.Decimal(5, 4), coef_l2 ?? 0)
			.input('coef_l3', sql.Decimal(5, 4), coef_l3 ?? 0)
			.input('outpatient_ratio', sql.Decimal(5, 4), outpatient_ratio ?? null)
			.input('fixed_add', sql.Decimal(6, 1), fixed_add ?? 0)
			.input('note', sql.NVarChar(300), note ?? null).query(`
				UPDATE Dept_Recommended_Config
				SET formula_type    = @formula_type,
					coef_l1         = @coef_l1,
					coef_l2         = @coef_l2,
					coef_l3         = @coef_l3,
					outpatient_ratio = @outpatient_ratio,
					fixed_add       = @fixed_add,
					note            = @note,
					updated_at      = SYSDATETIMEOFFSET()
				OUTPUT INSERTED.*
				WHERE id_department = @id_department
			`);

		appEmitter.emit('changed', {
			resource: 'departments',
			action: 'updated',
			id: Number(req.params.id),
		});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// DELETE /api/departments/:id/recommended-config
async function removeRecommendedConfig(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.id).query(`
				DELETE FROM Dept_Recommended_Config
				OUTPUT DELETED.id
				WHERE id_department = @id_department
			`);

		if (!result.recordset.length)
			return res.status(404).json({
				success: false,
				message: 'Không tìm thấy cấu hình khuyến nghị cho khoa này',
			});

		appEmitter.emit('changed', {
			resource: 'departments',
			action: 'updated',
			id: Number(req.params.id),
		});
		res.json({
			success: true,
			message: 'Đã xoá cấu hình khuyến nghị thành công',
		});
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getAll,
	getSimple,
	getById,
	create,
	update,
	remove,
	getRecommendedConfig,
	createRecommendedConfig,
	updateRecommendedConfig,
	removeRecommendedConfig,
};
