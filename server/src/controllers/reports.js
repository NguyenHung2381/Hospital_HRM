const { getPool, sql } = require('../config/db');
const {
	calcTT03,
	calcRecommended,
	fetchTT03Config,
	fetchRecommendedConfig,
} = require('./tt03');
<<<<<<< HEAD
=======
const { getRecordsForReport: getClsRecordsForReport } = require('./clsRecords');
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
const appEmitter = require('../events/appEmitter');

// ── Helper: lấy cấu hình TT03 cho 1 khoa ────────────────────────────────
// (giữ nguyên để không break logic cũ)
async function fetchTT03ConfigLocal(pool, id_department) {
	return fetchTT03Config(pool, id_department);
}

// ── Helper: tính cả recommended_staff (TT03) và recommended_staff_calc ──
// Trả về { recommended, recommendedCalc }
async function resolveBothRecommended(pool, record) {
	// TT03: override nếu frontend gửi lên
	let recommended =
		record.recommended_staff !== undefined && record.recommended_staff !== null
			? record.recommended_staff
			: null;

	let recommendedCalc =
		record.recommended_staff_calc !== undefined &&
		record.recommended_staff_calc !== null
			? record.recommended_staff_calc
			: null;

	if (!record.id_department) return { recommended, recommendedCalc };

	const [cfgTT03, cfgRec] = await Promise.all([
		recommended === null
			? fetchTT03Config(pool, record.id_department)
			: Promise.resolve(null),
		recommendedCalc === null
			? fetchRecommendedConfig(pool, record.id_department)
			: Promise.resolve(null),
	]);

	if (recommended === null && cfgTT03) {
		const raw = calcTT03(record, cfgTT03, cfgTT03);
		recommended = raw !== null ? Math.ceil(raw) : null;
	}

	if (recommendedCalc === null && cfgRec) {
		const raw = calcRecommended(record, cfgRec);
		recommendedCalc = raw !== null ? Math.ceil(raw) : null;
	}

	return { recommended, recommendedCalc };
}

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
<<<<<<< HEAD
				u.full_name AS created_by_name
=======
				u.full_name AS created_by_name,
				CASE WHEN EXISTS (
					SELECT 1 FROM [Report_Department_Records ] rdr
					WHERE rdr.id_report = dr.id_report
				) THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS has_records
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
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
<<<<<<< HEAD
		const [reportResult, recordsResult] = await Promise.all([
=======
		const [reportResult, recordsResult, clsRecords] = await Promise.all([
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
			pool.request().input('id_report', sql.Int, req.params.id).query(`
				SELECT dr.id_report, dr.report_code, dr.report_date, dr.created_at, dr.updated_at,
					u.full_name AS created_by_name
				FROM Daily_Reports dr
				LEFT JOIN Users u ON u.id_user = dr.created_by
				WHERE dr.id_report = @id_report
			`),
			pool.request().input('id_report', sql.Int, req.params.id).query(`
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
				WHERE rdr.id_report = @id_report
				ORDER BY rdr.sort_order
			`),
<<<<<<< HEAD
=======
			getClsRecordsForReport(pool, req.params.id),
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
		]);

		if (!reportResult.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy báo cáo' });

		res.json({
			success: true,
<<<<<<< HEAD
			data: { ...reportResult.recordset[0], records: recordsResult.recordset },
=======
			data: {
				...reportResult.recordset[0],
				records: recordsResult.recordset,
				cls_records: clsRecords,
			},
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
		});
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
		const { report_date, report_code, created_by, records } = req.body;
		if (!report_date)
			return res
				.status(400)
				.json({ success: false, message: 'report_date không được để trống' });

		const pool = await getPool();
		const transaction = new sql.Transaction(pool);
		await transaction.begin();

		try {
			const reportResult = await transaction
				.request()
				.input('report_date', sql.Date, report_date)
				.input('report_code', sql.NVarChar(50), report_code ?? null)
				.input('created_by', sql.Int, created_by ?? null).query(`
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
						.input('created_by', sql.Int, created_by ?? null).query(`
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
<<<<<<< HEAD
				-- Bảng có trigger nên OUTPUT phải dùng INTO, không trả thẳng về client được
=======
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
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
<<<<<<< HEAD
					note                   = @note
				OUTPUT INSERTED.Id INTO @out
				WHERE Id = @id AND id_report = @id_report;
				-- SELECT lại từ bảng thật để lấy updated_at sau khi trigger chạy
=======
					note                   = @note,
					updated_at             = SYSDATETIMEOFFSET()
				OUTPUT INSERTED.Id INTO @out
				WHERE Id = @id AND id_report = @id_report;
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
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

// DELETE /api/reports/:id
async function remove(req, res, next) {
	try {
		const pool = await getPool();
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

// DELETE /api/reports/:id/records/:recordId
async function removeRecord(req, res, next) {
	try {
		const { id, recordId } = req.params;
		const pool = await getPool();
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
	getAll,
	getById,
	getByDate,
	create,
	addRecord,
	updateRecord,
	removeRecord,
	remove,
};
