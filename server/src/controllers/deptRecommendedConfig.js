const { getPool, sql } = require('../config/db');
const appEmitter = require('../events/appEmitter');

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
	getRecommendedConfig,
	createRecommendedConfig,
	updateRecommendedConfig,
	removeRecommendedConfig,
};
