const { getPool, sql } = require('../config/db');
const appEmitter = require('../events/appEmitter');
const { loadUserDeptAccess, canAccessDept } = require('../services/deptAccess');
const {
	calcTT03,
	calcRecommended,
	fetchTT03Config,
	fetchRecommendedConfig,
} = require('../services/tt03Formulas');

// ════════════════════════════════════════════════════════════
// TT03 CONFIG APIs
// ════════════════════════════════════════════════════════════

// GET /api/tt03/config
async function getConfig(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool.request().query(`
			SELECT
				cfg.id, cfg.id_department, d.name_department, d.code_department,
				cfg.formula_type, cfg.patient_ratio, cfg.shift_divisor,
				cfg.shift_multiplier, cfg.fixed_add, cfg.note,
				d.bed_count, d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total
			FROM Dept_TT03_Config cfg
			INNER JOIN Departments d ON d.id_department = cfg.id_department
			ORDER BY cfg.id_department ASC
		`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// GET /api/tt03/config/:deptId
async function getConfigByDept(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.deptId).query(`
				SELECT
					cfg.id, cfg.id_department, d.name_department,
					cfg.formula_type, cfg.patient_ratio, cfg.shift_divisor,
					cfg.shift_multiplier, cfg.fixed_add, cfg.note,
					d.bed_count, d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total
				FROM Dept_TT03_Config cfg
				INNER JOIN Departments d ON d.id_department = cfg.id_department
				WHERE cfg.id_department = @id_department
			`);
		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy cấu hình TT03' });
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// PUT /api/tt03/config/:deptId
async function updateConfig(req, res, next) {
	try {
		const {
			formula_type,
			patient_ratio,
			shift_divisor,
			shift_multiplier,
			fixed_add,
			note,
		} = req.body;
		const pool = await getPool();

		const access = await loadUserDeptAccess(pool, req.user);
		if (!canAccessDept(access, Number(req.params.deptId), 'can_edit')) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền sửa cấu hình của khoa này',
			});
		}

		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.deptId)
			.input('formula_type', sql.NVarChar(20), formula_type)
			.input('patient_ratio', sql.Decimal(4, 3), patient_ratio ?? 0.6)
			.input('shift_divisor', sql.TinyInt, shift_divisor ?? 3)
			.input('shift_multiplier', sql.TinyInt, shift_multiplier ?? 2)
			.input('fixed_add', sql.Decimal(5, 1), fixed_add ?? 0)
			.input('note', sql.NVarChar(200), note ?? null).query(`
				IF EXISTS (SELECT 1 FROM Dept_TT03_Config WHERE id_department = @id_department)
					UPDATE Dept_TT03_Config
					SET formula_type = @formula_type, patient_ratio = @patient_ratio,
						shift_divisor = @shift_divisor, shift_multiplier = @shift_multiplier,
						fixed_add = @fixed_add, note = @note,
						updated_at = SYSDATETIMEOFFSET()
					WHERE id_department = @id_department;
				ELSE
					INSERT INTO Dept_TT03_Config
						(id_department, formula_type, patient_ratio, shift_divisor, shift_multiplier, fixed_add, note)
					VALUES
						(@id_department, @formula_type, @patient_ratio, @shift_divisor, @shift_multiplier, @fixed_add, @note);

				SELECT cfg.*, d.name_department, d.bed_count,
					d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total
				FROM Dept_TT03_Config cfg
				INNER JOIN Departments d ON d.id_department = cfg.id_department
				WHERE cfg.id_department = @id_department;
			`);

		appEmitter.emit('changed', {
			resource: 'departments',
			action: 'updated',
			id: Number(req.params.deptId),
		});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// ════════════════════════════════════════════════════════════
// RECOMMENDED CONFIG APIs  (Dept_Recommended_Config)
// ════════════════════════════════════════════════════════════

// GET /api/tt03/recommended-config
async function getRecommendedConfig(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool.request().query(`
			SELECT
				rc.id, rc.id_department, d.name_department, d.code_department,
				rc.formula_type, rc.coef_l1, rc.coef_l2, rc.coef_l3,
				rc.outpatient_ratio, rc.fixed_add, rc.note,
				rc.created_at, rc.updated_at
			FROM Dept_Recommended_Config rc
			INNER JOIN Departments d ON d.id_department = rc.id_department
			ORDER BY rc.id_department ASC
		`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// GET /api/tt03/recommended-config/:deptId
async function getRecommendedConfigByDept(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.deptId).query(`
				SELECT
					rc.id, rc.id_department, d.name_department, d.code_department,
					rc.formula_type, rc.coef_l1, rc.coef_l2, rc.coef_l3,
					rc.outpatient_ratio, rc.fixed_add, rc.note,
					rc.created_at, rc.updated_at
				FROM Dept_Recommended_Config rc
				INNER JOIN Departments d ON d.id_department = rc.id_department
				WHERE rc.id_department = @id_department
			`);
		if (!result.recordset.length)
			return res.status(404).json({
				success: false,
				message: 'Không tìm thấy cấu hình khuyến nghị',
			});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// PUT /api/tt03/recommended-config/:deptId
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

		const deptCheck = await pool
			.request()
			.input('id_department', sql.Int, req.params.deptId)
			.query(
				`SELECT id_department FROM Departments WHERE id_department = @id_department`,
			);
		if (!deptCheck.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy khoa' });

		const access = await loadUserDeptAccess(pool, req.user);
		if (!canAccessDept(access, Number(req.params.deptId), 'can_edit')) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền sửa cấu hình của khoa này',
			});
		}

		const result = await pool
			.request()
			.input('id_department', sql.Int, req.params.deptId)
			.input('formula_type', sql.NVarChar(20), formula_type)
			.input('coef_l1', sql.Decimal(5, 4), coef_l1 ?? 0.5)
			.input('coef_l2', sql.Decimal(5, 4), coef_l2 ?? 0.104)
			.input('coef_l3', sql.Decimal(5, 4), coef_l3 ?? 0.104)
			.input('outpatient_ratio', sql.Decimal(5, 4), outpatient_ratio ?? null)
			.input('fixed_add', sql.Decimal(6, 1), fixed_add ?? 0)
			.input('note', sql.NVarChar(300), note ?? null).query(`
				IF EXISTS (SELECT 1 FROM Dept_Recommended_Config WHERE id_department = @id_department)
					UPDATE Dept_Recommended_Config
					SET formula_type    = @formula_type,
						coef_l1         = @coef_l1,
						coef_l2         = @coef_l2,
						coef_l3         = @coef_l3,
						outpatient_ratio = @outpatient_ratio,
						fixed_add       = @fixed_add,
						note            = @note,
						updated_at      = SYSDATETIMEOFFSET()
					WHERE id_department = @id_department;
				ELSE
					INSERT INTO Dept_Recommended_Config
						(id_department, formula_type, coef_l1, coef_l2, coef_l3, outpatient_ratio, fixed_add, note)
					VALUES
						(@id_department, @formula_type, @coef_l1, @coef_l2, @coef_l3, @outpatient_ratio, @fixed_add, @note);

				SELECT rc.*, d.name_department, d.code_department
				FROM Dept_Recommended_Config rc
				INNER JOIN Departments d ON d.id_department = rc.id_department
				WHERE rc.id_department = @id_department;
			`);

		appEmitter.emit('changed', {
			resource: 'departments',
			action: 'updated',
			id: Number(req.params.deptId),
		});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// ════════════════════════════════════════════════════════════
// CALCULATE APIs
// ════════════════════════════════════════════════════════════

// POST /api/tt03/calculate
async function calculate(req, res, next) {
	try {
		const {
			id_department,
			patient_level_1,
			patient_level_2,
			patient_level_3,
			outpatient_cnt,
		} = req.body;
		if (!id_department)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu id_department' });

		const pool = await getPool();
		const [cfgTT03, cfgRec] = await Promise.all([
			fetchTT03Config(pool, id_department),
			fetchRecommendedConfig(pool, id_department),
		]);

		const record = {
			patient_level_1,
			patient_level_2,
			patient_level_3,
			outpatient_cnt,
		};

		const rawTT03 = calcTT03(record, cfgTT03, cfgTT03);
		const rawRec = calcRecommended(record, cfgRec);

		const total =
			(patient_level_1 ?? 0) + (patient_level_2 ?? 0) + (patient_level_3 ?? 0);

		res.json({
			success: true,
			data: {
				id_department,
				patient_level_1: patient_level_1 ?? 0,
				patient_level_2: patient_level_2 ?? 0,
				patient_level_3: patient_level_3 ?? 0,
				total_patients: total,
				outpatient_cnt: outpatient_cnt ?? 0,
				tt03: cfgTT03
					? {
							formula_type: cfgTT03.formula_type,
							note: cfgTT03.note,
							raw: rawTT03 !== null ? parseFloat(rawTT03.toFixed(2)) : null,
							staff: rawTT03 !== null ? Math.ceil(rawTT03) : null,
						}
					: null,
				recommended: cfgRec
					? {
							formula_type: cfgRec.formula_type,
							note: cfgRec.note,
							raw: rawRec !== null ? parseFloat(rawRec.toFixed(2)) : null,
							staff: rawRec !== null ? Math.ceil(rawRec) : null,
						}
					: null,
			},
		});
	} catch (err) {
		next(err);
	}
}

// GET /api/tt03/report/:reportId
async function getReportTT03(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id_report', sql.Int, req.params.reportId).query(`
				SELECT
					record_id, id_report, id_department, name_department, code_department,
					tt03_formula_type   AS formula_type,
					tt03_formula_note   AS formula_note,
					tt03_staff_saved    AS recommended_staff_saved,
					tt03_staff_calc     AS recommended_staff_calc,
					tt03_surplus_deficit AS staff_surplus_deficit,
					rec_formula_type,
					rec_formula_note,
					rec_staff_saved,
					rec_staff_calc,
					L1 AS patient_level_1, L2 AS patient_level_2, L3 AS patient_level_3,
					total_NB AS total_patients, outpatient_cnt, bed_count,
					total_staff, staff_working,
					coordination, record_note AS note,
					created_at, updated_at
				FROM vw_TT03_Recommended
				WHERE id_report = @id_report
				ORDER BY id_department ASC
			`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	// TT03 config
	getConfig,
	getConfigByDept,
	updateConfig,
	// Recommended config
	getRecommendedConfig,
	getRecommendedConfigByDept,
	updateRecommendedConfig,
	// Calculate & report
	calculate,
	getReportTT03,
};
