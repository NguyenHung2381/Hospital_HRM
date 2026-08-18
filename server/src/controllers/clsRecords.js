const { getPool, sql } = require('../config/db');
const { calcRecommended, fetchRecommendedConfig } = require('../services/tt03Formulas');
const appEmitter = require('../events/appEmitter');

// ── Helper: tính recommended_staff (khuyến cáo cố định hệ CLS) ──────────
async function resolveRecommended(pool, record) {
	if (record.recommended_staff !== undefined && record.recommended_staff !== null) {
		return record.recommended_staff;
	}
	if (!record.id_department) return null;

	const cfg = await fetchRecommendedConfig(pool, record.id_department);
	if (!cfg) return null;

	const raw = calcRecommended(record, cfg);
	return raw !== null ? Math.ceil(raw) : null;
}

// ── Helper: lấy toàn bộ bản ghi CLS của 1 báo cáo (dùng trong reports.js#getById) ──
async function getRecordsForReport(pool, id_report) {
	const result = await pool.request().input('id_report', sql.Int, id_report).query(`
		SELECT
			rcr.Id AS id, rcr.id_report, rcr.id_department, rcr.sort_order,
			d.name_department AS department_name, d.code_department,
			rcr.sample_or_visit_cnt, rcr.xray_us_cnt, rcr.ct_endoscopy_cnt,
			rcr.mri_bonedensity_cnt, rcr.ecg_intervention_cnt, rcr.linen_media_cnt,
			rcr.tool_metal_cnt, rcr.tool_plastic_cnt, rcr.supervised_dept_cnt,
			rcr.pending_sample_or_visit_cnt, rcr.pending_xray_us_cnt, rcr.pending_ct_endoscopy_cnt,
			rcr.pending_mri_bonedensity_cnt, rcr.pending_ecg_intervention_cnt, rcr.pending_linen_cnt,
			rcr.pending_tool_metal_cnt, rcr.pending_tool_plastic_cnt,
			rcr.total_staff, rcr.staff_on_duty, rcr.staff_long_leave,
			rcr.staff_working, rcr.work_ratio, rcr.recommended_staff, rcr.coordination,
			rc.formula_type AS rec_formula_type, rc.fixed_add AS rec_fixed_add, rc.note AS rec_note,
			rcr.note, rcr.created_at, rcr.updated_at
		FROM Report_CLS_Records rcr
		LEFT JOIN Departments d ON d.id_department = rcr.id_department
		LEFT JOIN Dept_Recommended_Config rc ON rc.id_department = rcr.id_department
		WHERE rcr.id_report = @id_report
		ORDER BY rcr.sort_order
	`);
	return result.recordset;
}

// POST /api/reports/:id/cls-records
async function addRecord(req, res, next) {
	try {
		const { id } = req.params;
		const r = req.body;
		if (!r.id_department)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu id_department' });

		const pool = await getPool();

		const check = await pool
			.request()
			.input('id_report', sql.Int, id)
			.query(`SELECT id_report FROM Daily_Reports WHERE id_report = @id_report`);
		if (!check.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy báo cáo' });

		const dup = await pool
			.request()
			.input('id_report', sql.Int, id)
			.input('id_department', sql.Int, r.id_department).query(`
				SELECT Id FROM Report_CLS_Records
				WHERE id_report = @id_report AND id_department = @id_department
			`);
		if (dup.recordset.length)
			return res.status(409).json({
				success: false,
				message: 'Khoa này đã có bản ghi trong báo cáo',
			});

		const sortRes = await pool
			.request()
			.input('id_report', sql.Int, id)
			.query(
				`SELECT ISNULL(MAX(sort_order), 0) + 1 AS next_order FROM Report_CLS_Records WHERE id_report = @id_report`,
			);
		const nextOrder = sortRes.recordset[0].next_order;

		const recommended = await resolveRecommended(pool, r);

		const result = await pool
			.request()
			.input('id_report', sql.Int, id)
			.input('id_department', sql.Int, r.id_department)
			.input('sort_order', sql.SmallInt, nextOrder)
			.input('sample_or_visit_cnt', sql.SmallInt, r.sample_or_visit_cnt ?? null)
			.input('xray_us_cnt', sql.SmallInt, r.xray_us_cnt ?? null)
			.input('ct_endoscopy_cnt', sql.SmallInt, r.ct_endoscopy_cnt ?? null)
			.input('mri_bonedensity_cnt', sql.SmallInt, r.mri_bonedensity_cnt ?? null)
			.input('ecg_intervention_cnt', sql.SmallInt, r.ecg_intervention_cnt ?? null)
			.input('linen_media_cnt', sql.SmallInt, r.linen_media_cnt ?? null)
			.input('tool_metal_cnt', sql.SmallInt, r.tool_metal_cnt ?? null)
			.input('tool_plastic_cnt', sql.SmallInt, r.tool_plastic_cnt ?? null)
			.input('supervised_dept_cnt', sql.SmallInt, r.supervised_dept_cnt ?? null)
			.input(
				'pending_sample_or_visit_cnt',
				sql.SmallInt,
				r.pending_sample_or_visit_cnt ?? null,
			)
			.input('pending_xray_us_cnt', sql.SmallInt, r.pending_xray_us_cnt ?? null)
			.input(
				'pending_ct_endoscopy_cnt',
				sql.SmallInt,
				r.pending_ct_endoscopy_cnt ?? null,
			)
			.input(
				'pending_mri_bonedensity_cnt',
				sql.SmallInt,
				r.pending_mri_bonedensity_cnt ?? null,
			)
			.input(
				'pending_ecg_intervention_cnt',
				sql.SmallInt,
				r.pending_ecg_intervention_cnt ?? null,
			)
			.input('pending_linen_cnt', sql.SmallInt, r.pending_linen_cnt ?? null)
			.input('pending_tool_metal_cnt', sql.SmallInt, r.pending_tool_metal_cnt ?? null)
			.input(
				'pending_tool_plastic_cnt',
				sql.SmallInt,
				r.pending_tool_plastic_cnt ?? null,
			)
			.input('total_staff', sql.SmallInt, r.total_staff ?? null)
			.input('staff_on_duty', sql.Decimal(10, 4), r.staff_on_duty ?? null)
			.input('staff_long_leave', sql.Decimal(10, 4), r.staff_long_leave ?? null)
			.input('staff_working', sql.Decimal(10, 4), r.staff_working ?? null)
			.input('work_ratio', sql.Decimal(6, 2), r.work_ratio ?? null)
			.input('recommended_staff', sql.SmallInt, recommended)
			.input('coordination', sql.SmallInt, r.coordination ?? null)
			.input('note', sql.NVarChar(sql.MAX), r.note ?? null)
			.input('created_by', sql.Int, r.created_by ?? null).query(`
				DECLARE @out TABLE (Id INT);
				INSERT INTO Report_CLS_Records
					(id_report, id_department, sort_order,
					sample_or_visit_cnt, xray_us_cnt, ct_endoscopy_cnt, mri_bonedensity_cnt,
					ecg_intervention_cnt, linen_media_cnt, tool_metal_cnt, tool_plastic_cnt, supervised_dept_cnt,
					pending_sample_or_visit_cnt, pending_xray_us_cnt, pending_ct_endoscopy_cnt,
					pending_mri_bonedensity_cnt, pending_ecg_intervention_cnt, pending_linen_cnt,
					pending_tool_metal_cnt, pending_tool_plastic_cnt,
					total_staff, staff_on_duty, staff_long_leave, staff_working, work_ratio,
					recommended_staff, coordination, note, created_by)
				OUTPUT INSERTED.Id INTO @out
				VALUES
					(@id_report, @id_department, @sort_order,
					@sample_or_visit_cnt, @xray_us_cnt, @ct_endoscopy_cnt, @mri_bonedensity_cnt,
					@ecg_intervention_cnt, @linen_media_cnt, @tool_metal_cnt, @tool_plastic_cnt, @supervised_dept_cnt,
					@pending_sample_or_visit_cnt, @pending_xray_us_cnt, @pending_ct_endoscopy_cnt,
					@pending_mri_bonedensity_cnt, @pending_ecg_intervention_cnt, @pending_linen_cnt,
					@pending_tool_metal_cnt, @pending_tool_plastic_cnt,
					@total_staff, @staff_on_duty, @staff_long_leave, @staff_working, @work_ratio,
					@recommended_staff, @coordination, @note, @created_by);
				SELECT * FROM @out;
			`);

		appEmitter.emit('changed', {
			resource: 'reports',
			action: 'updated',
			id: Number(id),
		});
		res.status(201).json({
			success: true,
			message: 'Đã thêm bản ghi khoa CLS thành công',
			data: { id: result.recordset[0].Id, recommended_staff: recommended },
		});
	} catch (err) {
		next(err);
	}
}

// PUT /api/reports/:id/cls-records/:recordId
async function updateRecord(req, res, next) {
	try {
		const { id, recordId } = req.params;
		const r = req.body;
		const pool = await getPool();

		const deptRes = await pool
			.request()
			.input('id', sql.Int, recordId)
			.query(`SELECT id_department FROM Report_CLS_Records WHERE Id = @id`);

		if (!deptRes.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy bản ghi' });

		const id_department = deptRes.recordset[0].id_department;
		const recommended = await resolveRecommended(pool, { ...r, id_department });

		const result = await pool
			.request()
			.input('id', sql.Int, recordId)
			.input('id_report', sql.Int, id)
			.input('sample_or_visit_cnt', sql.SmallInt, r.sample_or_visit_cnt ?? null)
			.input('xray_us_cnt', sql.SmallInt, r.xray_us_cnt ?? null)
			.input('ct_endoscopy_cnt', sql.SmallInt, r.ct_endoscopy_cnt ?? null)
			.input('mri_bonedensity_cnt', sql.SmallInt, r.mri_bonedensity_cnt ?? null)
			.input('ecg_intervention_cnt', sql.SmallInt, r.ecg_intervention_cnt ?? null)
			.input('linen_media_cnt', sql.SmallInt, r.linen_media_cnt ?? null)
			.input('tool_metal_cnt', sql.SmallInt, r.tool_metal_cnt ?? null)
			.input('tool_plastic_cnt', sql.SmallInt, r.tool_plastic_cnt ?? null)
			.input('supervised_dept_cnt', sql.SmallInt, r.supervised_dept_cnt ?? null)
			.input(
				'pending_sample_or_visit_cnt',
				sql.SmallInt,
				r.pending_sample_or_visit_cnt ?? null,
			)
			.input('pending_xray_us_cnt', sql.SmallInt, r.pending_xray_us_cnt ?? null)
			.input(
				'pending_ct_endoscopy_cnt',
				sql.SmallInt,
				r.pending_ct_endoscopy_cnt ?? null,
			)
			.input(
				'pending_mri_bonedensity_cnt',
				sql.SmallInt,
				r.pending_mri_bonedensity_cnt ?? null,
			)
			.input(
				'pending_ecg_intervention_cnt',
				sql.SmallInt,
				r.pending_ecg_intervention_cnt ?? null,
			)
			.input('pending_linen_cnt', sql.SmallInt, r.pending_linen_cnt ?? null)
			.input('pending_tool_metal_cnt', sql.SmallInt, r.pending_tool_metal_cnt ?? null)
			.input(
				'pending_tool_plastic_cnt',
				sql.SmallInt,
				r.pending_tool_plastic_cnt ?? null,
			)
			.input('total_staff', sql.SmallInt, r.total_staff ?? null)
			.input('staff_on_duty', sql.Decimal(10, 4), r.staff_on_duty ?? null)
			.input('staff_long_leave', sql.Decimal(10, 4), r.staff_long_leave ?? null)
			.input('staff_working', sql.Decimal(10, 4), r.staff_working ?? null)
			.input('work_ratio', sql.Decimal(6, 2), r.work_ratio ?? null)
			.input('recommended_staff', sql.SmallInt, recommended)
			.input('coordination', sql.SmallInt, r.coordination ?? null)
			.input('note', sql.NVarChar(sql.MAX), r.note ?? null).query(`
				DECLARE @out TABLE (Id INT);
				UPDATE Report_CLS_Records
				SET sample_or_visit_cnt        = @sample_or_visit_cnt,
					xray_us_cnt                = @xray_us_cnt,
					ct_endoscopy_cnt           = @ct_endoscopy_cnt,
					mri_bonedensity_cnt        = @mri_bonedensity_cnt,
					ecg_intervention_cnt       = @ecg_intervention_cnt,
					linen_media_cnt            = @linen_media_cnt,
					tool_metal_cnt             = @tool_metal_cnt,
					tool_plastic_cnt           = @tool_plastic_cnt,
					supervised_dept_cnt        = @supervised_dept_cnt,
					pending_sample_or_visit_cnt = @pending_sample_or_visit_cnt,
					pending_xray_us_cnt        = @pending_xray_us_cnt,
					pending_ct_endoscopy_cnt   = @pending_ct_endoscopy_cnt,
					pending_mri_bonedensity_cnt = @pending_mri_bonedensity_cnt,
					pending_ecg_intervention_cnt = @pending_ecg_intervention_cnt,
					pending_linen_cnt          = @pending_linen_cnt,
					pending_tool_metal_cnt     = @pending_tool_metal_cnt,
					pending_tool_plastic_cnt   = @pending_tool_plastic_cnt,
					total_staff                = @total_staff,
					staff_on_duty              = @staff_on_duty,
					staff_long_leave           = @staff_long_leave,
					staff_working              = @staff_working,
					work_ratio                 = @work_ratio,
					recommended_staff          = @recommended_staff,
					coordination               = @coordination,
					note                       = @note,
					updated_at                 = SYSDATETIMEOFFSET()
				OUTPUT INSERTED.Id INTO @out
				WHERE Id = @id AND id_report = @id_report;
				SELECT rcr.*
				FROM Report_CLS_Records rcr
				INNER JOIN @out o ON o.Id = rcr.Id;
			`);

		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy bản ghi' });

		appEmitter.emit('changed', {
			resource: 'reports',
			action: 'updated',
			id: Number(id),
		});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// DELETE /api/reports/:id/cls-records/:recordId
async function removeRecord(req, res, next) {
	try {
		const { id, recordId } = req.params;
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id', sql.Int, recordId)
			.input('id_report', sql.Int, id).query(`
				DECLARE @dout TABLE (Id INT);
				DELETE FROM Report_CLS_Records
				OUTPUT DELETED.Id INTO @dout
				WHERE Id = @id AND id_report = @id_report;
				SELECT * FROM @dout;
			`);
		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy bản ghi' });
		appEmitter.emit('changed', {
			resource: 'reports',
			action: 'updated',
			id: Number(id),
		});
		res.json({ success: true, message: 'Đã xóa bản ghi khoa CLS thành công' });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getRecordsForReport,
	addRecord,
	updateRecord,
	removeRecord,
};
