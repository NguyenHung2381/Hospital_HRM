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
				SELECT Id FROM [Report_Department_Records ]
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
				`SELECT ISNULL(MAX(sort_order), 0) + 1 AS next_order FROM [Report_Department_Records ] WHERE id_report = @id_report`,
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
			.input('patient_level_1', sql.Decimal(10, 4), r.patient_level_1 ?? null)
			.input('patient_level_2', sql.Decimal(10, 4), r.patient_level_2 ?? null)
			.input('patient_level_3', sql.Decimal(10, 4), r.patient_level_3 ?? null)
			.input('total_patients', sql.Decimal(10, 4), r.total_patients ?? null)
			.input('outpatient_cnt', sql.Decimal(10, 4), r.outpatient_cnt ?? null)
			.input('total_staff', sql.Decimal(10, 4), r.total_staff ?? null)
			.input('staff_on_duty', sql.Decimal(10, 4), r.staff_on_duty ?? null)
			.input('staff_long_leave', sql.Decimal(10, 4), r.staff_long_leave ?? null)
			.input('staff_working', sql.Decimal(10, 4), r.staff_working ?? null)
			.input('tt03_ratio', sql.Decimal(10, 4), r.tt03_ratio ?? null)
			.input('recommended_staff', sql.Decimal(10, 4), recommended)
			.input('recommended_staff_calc', sql.Decimal(10, 4), recommendedCalc)
			.input('coordination', sql.Decimal(10, 4), r.coordination ?? null)
			.input('note', sql.NVarChar(sql.MAX), r.note ?? null)
			.input('created_by', sql.Int, r.created_by ?? null).query(`
				DECLARE @out TABLE (Id INT);
				INSERT INTO [Report_Department_Records ]
					(id_report, id_department, sort_order,
					patient_level_1, patient_level_2, patient_level_3,
					total_patients, outpatient_cnt, total_staff, staff_on_duty,
					staff_long_leave, staff_working, tt03_ratio,
					recommended_staff, recommended_staff_calc,
					coordination, note, created_by)
				OUTPUT INSERTED.Id INTO @out
				VALUES
					(@id_report, @id_department, @sort_order,
					@patient_level_1, @patient_level_2, @patient_level_3,
					@total_patients, @outpatient_cnt, @total_staff, @staff_on_duty,
					@staff_long_leave, @staff_working, @tt03_ratio,
					@recommended_staff, @recommended_staff_calc,
					@coordination, @note, @created_by);
				SELECT * FROM @out;
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
				id: result.recordset[0].Id,
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
				`SELECT id_department FROM [Report_Department_Records ] WHERE Id = @id`,
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
			.input('patient_level_1', sql.Decimal(10, 4), r.patient_level_1 ?? null)
			.input('patient_level_2', sql.Decimal(10, 4), r.patient_level_2 ?? null)
			.input('patient_level_3', sql.Decimal(10, 4), r.patient_level_3 ?? null)
			.input('total_patients', sql.Decimal(10, 4), r.total_patients ?? null)
			.input('outpatient_cnt', sql.Decimal(10, 4), r.outpatient_cnt ?? null)
			.input('total_staff', sql.Decimal(10, 4), r.total_staff ?? null)
			.input('staff_on_duty', sql.Decimal(10, 4), r.staff_on_duty ?? null)
			.input('staff_long_leave', sql.Decimal(10, 4), r.staff_long_leave ?? null)
			.input('staff_working', sql.Decimal(10, 4), r.staff_working ?? null)
			.input('tt03_ratio', sql.Decimal(10, 4), r.tt03_ratio ?? null)
			.input('recommended_staff', sql.Decimal(10, 4), recommended)
			.input('recommended_staff_calc', sql.Decimal(10, 4), recommendedCalc)
			.input('coordination', sql.Decimal(10, 4), r.coordination ?? null)
			.input('note', sql.NVarChar(sql.MAX), r.note ?? null).query(`
				DECLARE @out TABLE (Id INT);
				UPDATE [Report_Department_Records ]
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
					updated_at             = SYSDATETIMEOFFSET()
				OUTPUT INSERTED.Id INTO @out
				WHERE Id = @id AND id_report = @id_report;
				SELECT rdr.*
				FROM [Report_Department_Records ] rdr
				INNER JOIN @out o ON o.Id = rdr.Id;
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
				`SELECT id_department FROM [Report_Department_Records ] WHERE Id = @id`,
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
				DECLARE @dout TABLE (Id INT);
				DELETE FROM [Report_Department_Records ]
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
