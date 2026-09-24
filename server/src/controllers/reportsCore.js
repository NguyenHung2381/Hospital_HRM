const { getPool, sql } = require('../config/db');
const { resolveBothRecommended } = require('../services/reportRecommendedHelper');
const { getRecordsForReport: getClsRecordsForReport } = require('./clsRecords');
const {
	loadUserDeptAccess,
	canAccessDept,
	loadReadScope,
	canReadDept,
	filterByReadScope,
} = require('../services/deptAccess');
const appEmitter = require('../events/appEmitter');
const { isAdmin } = require('../middleware/auth');

// Cột + JOIN dùng chung cho bản ghi khoa (getById, getByDepartment)
const RECORD_SELECT = `
	SELECT
		rdr.Id AS id, rdr.id_report, rdr.id_department, rdr.sort_order,
		d.name_department AS department_name,
		d.bed_count, d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total,
		rdr.patient_level_1, rdr.patient_level_2, rdr.patient_level_3,
		rdr.total_patients, rdr.outpatient_cnt,
		rdr.total_staff, rdr.staff_on_duty, rdr.staff_long_leave,
		rdr.staff_working, rdr.tt03_ratio,
		-- TT03
		rdr.recommended_staff,
		v.tt03_staff_calc,
		v.tt03_surplus_deficit  AS staff_surplus_deficit,
		v.tt03_formula_type     AS formula_type,
		-- config TT03 để client tính lại được
		tt03cfg.patient_ratio,
		tt03cfg.shift_divisor,
		tt03cfg.shift_multiplier,
		tt03cfg.fixed_add,
		-- Khuyến nghị (saved + view calc)
		rdr.recommended_staff_calc,
		v.rec_staff_calc,
		v.rec_formula_type,
		-- Hệ số khuyến nghị (fallback tính lại phía client)
		rc.formula_type         AS rec_formula_type_cfg,
		rc.coef_l1              AS rec_coef_level_1,
		rc.coef_l2              AS rec_coef_level_2,
		rc.coef_l3              AS rec_coef_level_3,
		rc.outpatient_ratio     AS rec_outpatient_ratio,
		rc.fixed_add            AS rec_fixed_add,
		rdr.coordination, rdr.note,
		rdr.created_at, rdr.updated_at
	FROM [Report_Department_Records ] rdr
	LEFT JOIN Departments d ON d.id_department = rdr.id_department
	LEFT JOIN vw_TT03_Recommended v ON v.record_id = rdr.Id
	LEFT JOIN Dept_Recommended_Config rc ON rc.id_department = rdr.id_department
	LEFT JOIN Dept_TT03_Config tt03cfg ON tt03cfg.id_department = rdr.id_department
`;

// GET /api/reports
async function getAll(req, res, next) {
	try {
		const { from, to } = req.query;
		const pool = await getPool();
		const request = pool.request();
		const where = [];
		if (from) {
			where.push('dr.report_date >= @from');
			request.input('from', sql.Date, from);
		}
		if (to) {
			where.push('dr.report_date <= @to');
			request.input('to', sql.Date, to);
		}
		const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

		const result = await request.query(`
			SELECT dr.id_report, dr.report_code, dr.report_date, dr.created_at, dr.updated_at,
				u.full_name AS created_by_name,
				CASE WHEN EXISTS (
					SELECT 1 FROM [Report_Department_Records ] rdr
					WHERE rdr.id_report = dr.id_report
				) THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS has_records
			FROM Daily_Reports dr
			LEFT JOIN Users u ON u.id_user = dr.created_by
			${whereClause}
			ORDER BY dr.report_date DESC
		`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// GET /api/reports/:id
async function getById(req, res, next) {
	try {
		const pool = await getPool();
		const [scope, reportResult, recordsResult, clsRecords] = await Promise.all([
			loadReadScope(pool, req.user),
			pool.request().input('id_report', sql.Int, req.params.id).query(`
				SELECT dr.id_report, dr.report_code, dr.report_date, dr.created_at, dr.updated_at,
					u.full_name AS created_by_name
				FROM Daily_Reports dr
				LEFT JOIN Users u ON u.id_user = dr.created_by
				WHERE dr.id_report = @id_report
			`),
			pool.request().input('id_report', sql.Int, req.params.id).query(`
				${RECORD_SELECT}
				WHERE rdr.id_report = @id_report
				ORDER BY rdr.sort_order
			`),
			getClsRecordsForReport(pool, req.params.id),
		]);

		if (!reportResult.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy báo cáo' });

		res.json({
			success: true,
			data: {
				...reportResult.recordset[0],
				// Chỉ trả dữ liệu các khoa user được xem
				records: filterByReadScope(scope, recordsResult.recordset),
				cls_records: filterByReadScope(scope, clsRecords),
			},
		});
	} catch (err) {
		next(err);
	}
}

// GET /api/reports/department/:deptId?from=&to=
// Bản ghi của 1 khoa trong khoảng ngày — 1 truy vấn thay vì tải chi tiết
// từng báo cáo (mỗi báo cáo chứa toàn bộ các khoa).
async function getByDepartment(req, res, next) {
	try {
		const { from, to } = req.query;
		if (!from || !to)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu from/to' });
		const pool = await getPool();
		if (!canReadDept(await loadReadScope(pool, req.user), req.params.deptId))
			return res
				.status(403)
				.json({ success: false, message: 'Bạn không có quyền xem dữ liệu của khoa này' });
		const result = await pool
			.request()
			.input('dept', sql.Int, req.params.deptId)
			.input('from', sql.Date, from)
			.input('to', sql.Date, to).query(`
				${RECORD_SELECT.replace(
					'SELECT',
					'SELECT CONVERT(varchar(10), dr.report_date, 23) AS report_date,',
				)}
				INNER JOIN Daily_Reports dr ON dr.id_report = rdr.id_report
				WHERE rdr.id_department = @dept
				  AND dr.report_date BETWEEN @from AND @to
				ORDER BY dr.report_date
			`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// GET /api/reports/date/:date
async function getByDate(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('date', sql.Date, req.params.date)
			.query(`SELECT id_report FROM Daily_Reports WHERE report_date = @date`);

		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không có báo cáo ngày này' });

		req.params.id = result.recordset[0].id_report;
		return getById(req, res, next);
	} catch (err) {
		next(err);
	}
}

// POST /api/reports
async function create(req, res, next) {
	try {
		// created_by lấy từ token, không tin giá trị client gửi lên
		const { report_date, report_code, records } = req.body;
		if (!report_date)
			return res
				.status(400)
				.json({ success: false, message: 'report_date không được để trống' });

		const pool = await getPool();

		if (Array.isArray(records) && records.length) {
			const access = await loadUserDeptAccess(pool, req.user);
			const denied = records.find(
				(r) => !canAccessDept(access, r.id_department, 'can_edit'),
			);
			if (denied)
				return res.status(403).json({
					success: false,
					message: 'Bạn không có quyền nhập dữ liệu cho một hoặc nhiều khoa trong danh sách',
				});
		}

		const transaction = new sql.Transaction(pool);
		await transaction.begin();

		try {
			const reportResult = await transaction
				.request()
				.input('report_date', sql.Date, report_date)
				.input('report_code', sql.NVarChar(50), report_code ?? null)
				.input('created_by', sql.Int, req.user.id_user).query(`
					DECLARE @tmp TABLE (id_report INT);
					INSERT INTO Daily_Reports (report_date, report_code, created_by)
					OUTPUT INSERTED.id_report INTO @tmp
					VALUES (@report_date, @report_code, @created_by);
					SELECT dr.id_report, dr.report_date, dr.report_code, dr.created_at
					FROM Daily_Reports dr
					INNER JOIN @tmp t ON t.id_report = dr.id_report;
				`);

			const id_report = reportResult.recordset[0].id_report;

			if (Array.isArray(records) && records.length) {
				for (const r of records) {
					const { recommended, recommendedCalc } = await resolveBothRecommended(
						pool,
						r,
					);

					await transaction
						.request()
						.input('id_report', sql.Int, id_report)
						.input('id_department', sql.Int, r.id_department ?? null)
						.input('sort_order', sql.SmallInt, r.sort_order ?? null)
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
						.input('created_by', sql.Int, req.user.id_user).query(`
							INSERT INTO [Report_Department_Records ]
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
						`);
				}
			}

			await transaction.commit();
			appEmitter.emit('changed', {
				resource: 'reports',
				action: 'created',
				id: id_report,
			});
			res.status(201).json({ success: true, data: reportResult.recordset[0] });
		} catch (err) {
			await transaction.rollback();
			throw err;
		}
	} catch (err) {
		if (err.number === 2627)
			return res
				.status(409)
				.json({ success: false, message: 'Báo cáo ngày này đã tồn tại' });
		next(err);
	}
}

// DELETE /api/reports/:id
async function remove(req, res, next) {
	try {
		const pool = await getPool();

		// Xoá cả báo cáo ngày = xoá dữ liệu của MỌI khoa trong báo cáo → chỉ cho
		// phép khi user có quyền xoá (can_delete) trên tất cả các khoa đó; điều
		// phối nhân lực chỉ Quản trị hệ thống được xoá.
		const deptRes = await pool
			.request()
			.input('id_report', sql.Int, req.params.id).query(`
				SELECT id_department FROM [Report_Department_Records ] WHERE id_report = @id_report
				UNION
				SELECT id_department FROM Report_CLS_Records WHERE id_report = @id_report;
				SELECT COUNT(*) AS cnt FROM Staff_Coordination_Records WHERE id_report = @id_report;
			`);
		const access = await loadUserDeptAccess(pool, req.user);
		const deniedDept = deptRes.recordsets[0].find(
			(r) => r.id_department != null && !canAccessDept(access, r.id_department, 'can_delete'),
		);
		if (deniedDept || (deptRes.recordsets[1][0].cnt > 0 && !isAdmin(req.user)))
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền xoá dữ liệu của một hoặc nhiều khoa trong báo cáo này',
			});

		const result = await pool
			.request()
			.input('id_report', sql.Int, req.params.id).query(`
				DECLARE @dout TABLE (id_report INT);
				DELETE FROM Daily_Reports OUTPUT DELETED.id_report INTO @dout WHERE id_report = @id_report;
				SELECT * FROM @dout;
			`);

		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy báo cáo' });

		appEmitter.emit('changed', {
			resource: 'reports',
			action: 'deleted',
			id: Number(req.params.id),
		});
		res.json({ success: true, message: 'Đã xoá báo cáo thành công' });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getAll,
	getById,
	getByDate,
	getByDepartment,
	create,
	remove,
};
