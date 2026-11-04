const { getPool, sql } = require('../config/db');
const { resolveBothRecommended } = require('../services/reportRecommendedHelper');
const { loadUserDeptAccess, canAccessDept } = require('../services/deptAccess');
const appEmitter = require('../events/appEmitter');

// POST /api/reports/:id/records
async function addRecord(req, res, next) {
	try {
		const { id } = req.params;
		const r = req.body;
		if (!r.id_department)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu id_department' });

		const pool = await getPool();

		const access = await loadUserDeptAccess(pool, req.user);
		if (!canAccessDept(access, r.id_department, 'can_edit')) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền nhập dữ liệu cho khoa này',
			});
		}

		const check = await pool
			.request()
			.input('id_report', sql.Int, id)
			.query(
				`SELECT id_report FROM Daily_Reports WHERE id_report = @id_report`,
			);
		if (!check.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy báo cáo' });

		const dup = await pool
			.request()
			.input('id_report', sql.Int, id)
			.input('id_department', sql.Int, r.id_department).query(`
				SELECT id FROM report_department_records
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
				`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM report_department_records WHERE id_report = @id_report`,
			);
		const nextOrder = sortRes.recordset[0].next_order;

		const { recommended, recommendedCalc } = await resolveBothRecommended(
			pool,
			r,
		);

		const result = await pool
			.request()
			.input('id_report', sql.Int, id)
			.input('id_department', sql.Int, r.id_department)
			.input('sort_order', sql.SmallInt, nextOrder)
			.input('patient_level_1', sql.SmallInt, r.patient_level_1 ?? null)
			.input('patient_level_2', sql.SmallInt, r.patient_level_2 ?? null)
			.input('patient_level_3', sql.SmallInt, r.patient_level_3 ?? null)
			.input('total_patients', sql.SmallInt, r.total_patients ?? null)
			.input('outpatient_cnt', sql.SmallInt, r.outpatient_cnt ?? null)
			.input('total_staff', sql.SmallInt, r.total_staff ?? null)
			.input('staff_on_duty', sql.Decimal(10, 4), r.staff_on_duty ?? null)
			.input('staff_long_leave', sql.Decimal(10, 4), r.staff_long_leave ?? null)
			.input('staff_working', sql.Decimal(10, 4), r.staff_working ?? null)
			.input('tt03_ratio', sql.Decimal(10, 4), r.tt03_ratio ?? null)
			.input('recommended_staff', sql.SmallInt, recommended)
			.input('recommended_staff_calc', sql.SmallInt, recommendedCalc)
			.input('coordination', sql.SmallInt, r.coordination ?? null)
			.input('note', sql.NVarChar(sql.MAX), r.note ?? null)
			.input('created_by', sql.Int, req.user.id_user).query(`
				INSERT INTO report_department_records
					(id_report, id_department, sort_order,
					patient_level_1, patient_level_2, patient_level_3,
					total_patients, outpatient_cnt, total_staff, staff_on_duty,
					staff_long_leave, staff_working, tt03_ratio,
					recommended_staff, recommended_staff_calc,
					coordination, note, created_by)
					VALUES
					(@id_report, @id_department, @sort_order,
					@patient_level_1, @patient_level_2, @patient_level_3,
					@total_patients, @outpatient_cnt, @total_staff, @staff_on_duty,
					@staff_long_leave, @staff_working, @tt03_ratio,
					@recommended_staff, @recommended_staff_calc,
					@coordination, @note, @created_by)
					RETURNING id
			`);

		appEmitter.emit('changed', {
			resource: 'reports',
			action: 'updated',
			id: Number(id),
		});
		res.status(201).json({
			success: true,
			message: 'Đã thêm bản ghi khoa thành công',
			data: {
				id: result.recordset[0].id,
				recommended_staff: recommended,
				recommended_staff_calc: recommendedCalc,
			},
		});
	} catch (err) {
		next(err);
	}
}

// PUT /api/reports/:id/records/:recordId
async function updateRecord(req, res, next) {
	try {
		const { id, recordId } = req.params;
		const r = req.body;
		const pool = await getPool();

		const deptRes = await pool
			.request()
			.input('id', sql.Int, recordId)
			.query(
				`SELECT id_department FROM report_department_records WHERE id = @id`,
			);

		if (!deptRes.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy record' });

		const id_department = deptRes.recordset[0].id_department;

		const access = await loadUserDeptAccess(pool, req.user);
		if (!canAccessDept(access, id_department, 'can_edit')) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền sửa dữ liệu của khoa này',
			});
		}

		const { recommended, recommendedCalc } = await resolveBothRecommended(
			pool,
			{
				...r,
				id_department,
			},
		);

		const result = await pool
			.request()
			.input('id', sql.Int, recordId)
			.input('id_report', sql.Int, id)
			.input('patient_level_1', sql.SmallInt, r.patient_level_1 ?? null)
			.input('patient_level_2', sql.SmallInt, r.patient_level_2 ?? null)
			.input('patient_level_3', sql.SmallInt, r.patient_level_3 ?? null)
			.input('total_patients', sql.SmallInt, r.total_patients ?? null)
			.input('outpatient_cnt', sql.SmallInt, r.outpatient_cnt ?? null)
			.input('total_staff', sql.SmallInt, r.total_staff ?? null)
			.input('staff_on_duty', sql.Decimal(10, 4), r.staff_on_duty ?? null)
			.input('staff_long_leave', sql.Decimal(10, 4), r.staff_long_leave ?? null)
			.input('staff_working', sql.Decimal(10, 4), r.staff_working ?? null)
			.input('tt03_ratio', sql.Decimal(10, 4), r.tt03_ratio ?? null)
			.input('recommended_staff', sql.SmallInt, recommended)
			.input('recommended_staff_calc', sql.SmallInt, recommendedCalc)
			.input('coordination', sql.SmallInt, r.coordination ?? null)
			.input('note', sql.NVarChar(sql.MAX), r.note ?? null).query(`
				UPDATE report_department_records
				SET patient_level_1        = @patient_level_1,
					patient_level_2        = @patient_level_2,
					patient_level_3        = @patient_level_3,
					total_patients         = @total_patients,
					outpatient_cnt         = @outpatient_cnt,
					total_staff            = @total_staff,
					staff_on_duty          = @staff_on_duty,
					staff_long_leave       = @staff_long_leave,
					staff_working          = @staff_working,
					tt03_ratio             = @tt03_ratio,
					recommended_staff      = @recommended_staff,
					recommended_staff_calc = @recommended_staff_calc,
					coordination           = @coordination,
					note                   = @note,
					updated_at             = now()
					WHERE id = @id AND id_report = @id_report
					RETURNING *
			`);

		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy record' });

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

// DELETE /api/reports/:id/records/:recordId
async function removeRecord(req, res, next) {
	try {
		const { id, recordId } = req.params;
		const pool = await getPool();

		const deptRes = await pool
			.request()
			.input('id', sql.Int, recordId)
			.query(
				`SELECT id_department FROM report_department_records WHERE id = @id`,
			);
		if (!deptRes.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy bản ghi' });

		const access = await loadUserDeptAccess(pool, req.user);
		if (!canAccessDept(access, deptRes.recordset[0].id_department, 'can_delete')) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền xoá dữ liệu của khoa này',
			});
		}

		const result = await pool
			.request()
			.input('id', sql.Int, recordId)
			.input('id_report', sql.Int, id).query(`
				DELETE FROM report_department_records
				WHERE id = @id AND id_report = @id_report
				RETURNING id
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
		res.json({ success: true, message: 'Đã xóa bản ghi khoa thành công' });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	addRecord,
	updateRecord,
	removeRecord,
};
