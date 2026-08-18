const { sql } = require('../config/db');

// ── Hàm tính nhân lực TT03 thuần JS ─────────────────────────────────────
function calcTT03(record, cfg, dept) {
	if (!cfg) return null;

	const L1 = record.patient_level_1 ?? 0;
	const L2 = record.patient_level_2 ?? 0;
	const L3 = record.patient_level_3 ?? 0;
	const total = L1 + L2 + L3;
	const ratio = parseFloat(cfg.patient_ratio);
	const div = cfg.shift_divisor || 3;
	const mul = cfg.shift_multiplier || 2;
	const fixed = parseFloat(cfg.fixed_add) || 0;

	switch (cfg.formula_type) {
		case 'standard':
			return ((total * ratio) / div) * mul + fixed;
		case 'icu':
			return ((total * ratio) / div) * mul;
		case 'surgery':
			return (((dept.bed_count ?? 0) * ratio) / div) * mul;
		case 'custom_coef':
			return (
				L1 * parseFloat(dept.coef_level_1 ?? 0.5) +
				L2 * parseFloat(dept.coef_level_2 ?? 0.104) +
				L3 * parseFloat(dept.coef_level_3 ?? 0.104) +
				total * parseFloat(dept.coef_total ?? 0.12)
			);
		default:
			return null;
	}
}

// ── Hàm tính nhân lực Khuyến nghị thuần JS ──────────────────────────────
function calcRecommended(record, cfg) {
	if (!cfg) return null;

	const L1 = record.patient_level_1 ?? 0;
	const L2 = record.patient_level_2 ?? 0;
	const L3 = record.patient_level_3 ?? 0;
	const total = L1 + L2 + L3;
	const fixed = parseFloat(cfg.fixed_add) || 0;

	switch (cfg.formula_type) {
		case 'coef':
			return (
				L1 * parseFloat(cfg.coef_l1 ?? 0.5) +
				L2 * parseFloat(cfg.coef_l2 ?? 0.104) +
				L3 * parseFloat(cfg.coef_l3 ?? 0.104) +
				fixed
			);
		case 'coef_with_total':
			return (
				L1 * parseFloat(cfg.coef_l1 ?? 0.5) +
				L2 * parseFloat(cfg.coef_l2 ?? 0.104) +
				L3 * parseFloat(cfg.coef_l3 ?? 0.104) +
				total * parseFloat(cfg.outpatient_ratio ?? 0) +
				fixed
			);
		case 'total_ratio':
			return total * parseFloat(cfg.outpatient_ratio ?? 0) + fixed;
		case 'outpatient_count':
			return (
				(record.outpatient_cnt ?? 0) * parseFloat(cfg.outpatient_ratio ?? 0) +
				fixed
			);
		case 'fixed':
			// Số khuyến cáo cố định, không phụ thuộc dữ liệu bản ghi (dùng cho hệ CLS)
			return fixed;
		default:
			return null;
	}
}

// ── Helper: lấy cấu hình TT03 cho 1 khoa ────────────────────────────────
async function fetchTT03Config(pool, id_department) {
	const r = await pool.request().input('id_department', sql.Int, id_department)
		.query(`
			SELECT cfg.*, d.bed_count,
				d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total
			FROM Dept_TT03_Config cfg
			INNER JOIN Departments d ON d.id_department = cfg.id_department
			WHERE cfg.id_department = @id_department
		`);
	return r.recordset[0] ?? null;
}

// ── Helper: lấy cấu hình Khuyến nghị cho 1 khoa ─────────────────────────
async function fetchRecommendedConfig(pool, id_department) {
	const r = await pool.request().input('id_department', sql.Int, id_department)
		.query(`
			SELECT * FROM Dept_Recommended_Config
			WHERE id_department = @id_department
		`);
	return r.recordset[0] ?? null;
}

module.exports = {
	calcTT03,
	calcRecommended,
	fetchTT03Config,
	fetchRecommendedConfig,
};
