const { getPool, sql } = require('../config/db');
const appEmitter = require('../events/appEmitter');

// GET /api/coordination?date=YYYY-MM-DD
async function getAll(req, res, next) {
	try {
		const { date } = req.query;
		if (!date)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu tham số date' });

		const pool = await getPool();
		const result = await pool.request().input('date', sql.Date, date).query(`
				SELECT sc.id, sc.id_report, dr.report_date,
					sc.id_department_from, df.name_department AS from_department_name,
					sc.id_department_to, dt.name_department AS to_department_name,
					sc.staff_count, sc.note,
					sc.created_by, u.full_name AS created_by_name,
					sc.created_at, sc.updated_at
				FROM Staff_Coordination_Records sc
				INNER JOIN Daily_Reports dr ON dr.id_report = sc.id_report
				INNER JOIN Departments df ON df.id_department = sc.id_department_from
				INNER JOIN Departments dt ON dt.id_department = sc.id_department_to
				LEFT JOIN Users u ON u.id_user = sc.created_by
				WHERE dr.report_date = @date
				ORDER BY sc.created_at DESC
			`);
		res.json({ success: true, data: result.recordset });
	} catch (err) {
		next(err);
	}
}

// POST /api/coordination
async function create(req, res, next) {
	try {
		const {
			report_date,
			id_department_from,
			id_department_to,
			staff_count,
			note,
			created_by,
		} = req.body;

		if (!report_date || !id_department_from || !id_department_to || !staff_count)
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu thông tin bắt buộc' });

		if (Number(id_department_from) === Number(id_department_to))
			return res.status(400).json({
				success: false,
				message: 'Khoa gửi và khoa nhận không được trùng nhau',
			});

		if (Number(staff_count) <= 0)
			return res
				.status(400)
				.json({ success: false, message: 'Số người phải lớn hơn 0' });

		const pool = await getPool();

		const reportRes = await pool
			.request()
			.input('date', sql.Date, report_date)
			.query(`SELECT id_report FROM Daily_Reports WHERE report_date = @date`);
		if (!reportRes.recordset.length)
			return res.status(404).json({
				success: false,
				message: 'Chưa có báo cáo ngày này, vui lòng nhập số liệu trước',
			});
		const id_report = reportRes.recordset[0].id_report;

		const result = await pool
			.request()
			.input('id_report', sql.Int, id_report)
			.input('id_department_from', sql.Int, id_department_from)
			.input('id_department_to', sql.Int, id_department_to)
			.input('staff_count', sql.SmallInt, staff_count)
			.input('note', sql.NVarChar(300), note ?? null)
			.input('created_by', sql.Int, created_by ?? null).query(`
				DECLARE @out TABLE (id INT);
				INSERT INTO Staff_Coordination_Records
					(id_report, id_department_from, id_department_to, staff_count, note, created_by)
				OUTPUT INSERTED.id INTO @out
				VALUES (@id_report, @id_department_from, @id_department_to, @staff_count, @note, @created_by);

				SELECT sc.id, sc.id_report, dr.report_date,
					sc.id_department_from, df.name_department AS from_department_name,
					sc.id_department_to, dt.name_department AS to_department_name,
					sc.staff_count, sc.note,
					sc.created_by, u.full_name AS created_by_name,
					sc.created_at, sc.updated_at
				FROM Staff_Coordination_Records sc
				INNER JOIN @out o ON o.id = sc.id
				INNER JOIN Daily_Reports dr ON dr.id_report = sc.id_report
				INNER JOIN Departments df ON df.id_department = sc.id_department_from
				INNER JOIN Departments dt ON dt.id_department = sc.id_department_to
				LEFT JOIN Users u ON u.id_user = sc.created_by;
			`);

		appEmitter.emit('changed', {
			resource: 'coordination',
			action: 'created',
			id: result.recordset[0].id,
		});
		res.status(201).json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// PUT /api/coordination/:id
async function update(req, res, next) {
	try {
		const { staff_count, note } = req.body;

		if (staff_count !== undefined && Number(staff_count) <= 0)
			return res
				.status(400)
				.json({ success: false, message: 'Số người phải lớn hơn 0' });

		const pool = await getPool();

		const check = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.query(`SELECT id FROM Staff_Coordination_Records WHERE id = @id`);
		if (!check.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy bản ghi điều phối' });

		const result = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.input('staff_count', sql.SmallInt, staff_count)
			.input('note', sql.NVarChar(300), note ?? null).query(`
				DECLARE @out TABLE (id INT);
				UPDATE Staff_Coordination_Records
				SET staff_count = @staff_count,
					note        = @note,
					updated_at  = SYSDATETIMEOFFSET()
				OUTPUT INSERTED.id INTO @out
				WHERE id = @id;

				SELECT sc.id, sc.id_report, dr.report_date,
					sc.id_department_from, df.name_department AS from_department_name,
					sc.id_department_to, dt.name_department AS to_department_name,
					sc.staff_count, sc.note,
					sc.created_by, u.full_name AS created_by_name,
					sc.created_at, sc.updated_at
				FROM Staff_Coordination_Records sc
				INNER JOIN @out o ON o.id = sc.id
				INNER JOIN Daily_Reports dr ON dr.id_report = sc.id_report
				INNER JOIN Departments df ON df.id_department = sc.id_department_from
				INNER JOIN Departments dt ON dt.id_department = sc.id_department_to
				LEFT JOIN Users u ON u.id_user = sc.created_by;
			`);

		appEmitter.emit('changed', {
			resource: 'coordination',
			action: 'updated',
			id: Number(req.params.id),
		});
		res.json({ success: true, data: result.recordset[0] });
	} catch (err) {
		next(err);
	}
}

// DELETE /api/coordination/:id
async function remove(req, res, next) {
	try {
		const pool = await getPool();
		const result = await pool
			.request()
			.input('id', sql.Int, req.params.id)
			.query(
				`DELETE FROM Staff_Coordination_Records OUTPUT DELETED.id WHERE id = @id`,
			);

		if (!result.recordset.length)
			return res
				.status(404)
				.json({ success: false, message: 'Không tìm thấy bản ghi điều phối' });

		appEmitter.emit('changed', {
			resource: 'coordination',
			action: 'deleted',
			id: Number(req.params.id),
		});
		res.json({ success: true, message: 'Đã xoá bản ghi điều phối' });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getAll,
	create,
	update,
	remove,
};
