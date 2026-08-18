const { sql } = require('../config/db');

// ── Lấy raw records cho export báo cáo nhân lực ──────────────────────────
async function fetchRawRecords(pool, { from, to, department }) {
	const req = pool.request();
	req.input('from', sql.Date, from);
	req.input('to', sql.Date, to);

	const deptFilter =
		department && department !== 'all' ? 'AND rdr.id_department = @dept' : '';
	if (department && department !== 'all') {
		req.input('dept', sql.Int, Number(department));
	}

	const result = await req.query(`
		SELECT
			dr.report_date,
			dr.report_code,
			d.id_department,
			d.name_department,
			ISNULL(rdr.patient_level_1,  0) AS patient_level_1,
			ISNULL(rdr.patient_level_2,  0) AS patient_level_2,
			ISNULL(rdr.patient_level_3,  0) AS patient_level_3,
			ISNULL(rdr.outpatient_cnt,   0) AS outpatient_cnt,
			ISNULL(rdr.total_patients,   0) AS total_patients,
			ISNULL(rdr.total_staff,      0) AS total_staff,
			ISNULL(rdr.staff_on_duty,    0) AS staff_on_duty,
			ISNULL(rdr.staff_long_leave, 0) AS staff_long_leave,
			ISNULL(rdr.staff_working,
				ISNULL(rdr.total_staff,0) - ISNULL(rdr.staff_on_duty,0) - ISNULL(rdr.staff_long_leave,0)
			) AS staff_working,
			d.bed_count,
			d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total,
			tt03cfg.formula_type,
			tt03cfg.patient_ratio,
			tt03cfg.shift_divisor,
			tt03cfg.shift_multiplier,
			tt03cfg.fixed_add,
			rec.formula_type     AS rec_formula_type,
			rec.coef_l1          AS rec_coef_level_1,
			rec.coef_l2          AS rec_coef_level_2,
			rec.coef_l3          AS rec_coef_level_3,
			rec.outpatient_ratio AS rec_outpatient_ratio,
			rec.fixed_add        AS rec_fixed_add
		FROM Daily_Reports dr
		INNER JOIN [Report_Department_Records ] rdr ON rdr.id_report = dr.id_report
		LEFT JOIN  Departments d             ON d.id_department       = rdr.id_department
		LEFT JOIN  Dept_TT03_Config tt03cfg  ON tt03cfg.id_department = rdr.id_department
		LEFT JOIN  Dept_Recommended_Config rec ON rec.id_department   = rdr.id_department
		WHERE dr.report_date BETWEEN @from AND @to
		  ${deptFilter}
		ORDER BY dr.report_date ASC, d.name_department ASC
	`);
	return result.recordset;
}

module.exports = { fetchRawRecords };
