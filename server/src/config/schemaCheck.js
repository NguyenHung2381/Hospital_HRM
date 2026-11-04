const { getPool } = require('./db');

// Kiểm tra schema PostgreSQL trước khi nhận request + dọn dữ liệu phiên cũ.
//
// Khác bản SQL Server (securitySchema.js cũ tự ALTER/CREATE TABLE lúc khởi
// động): role ứng dụng hrm_app KHÔNG có quyền DDL. Schema do hrm_owner tạo
// bằng các file server/db/postgres/*.sql (xem server/db/README.md). Ở đây chỉ
// xác nhận đủ bảng/view, thiếu thì dừng và báo rõ cần chạy file nào.
const REQUIRED_RELATIONS = [
	'departments',
	'roles',
	'permissions',
	'role_permissions',
	'users',
	'user_department_access',
	'user_dept_permissions',
	'dept_tt03_config',
	'dept_recommended_config',
	'daily_reports',
	'report_department_records',
	'report_cls_records',
	'staff_coordination_records',
	'usersessions',
	'securityevents',
	'trusteddevices',
	'vw_tt03_recommended',
];

const CLEANUP_STATEMENTS = [
	// Dọn phiên đã hết hạn quá 30 ngày để bảng không phình
	`DELETE FROM usersessions WHERE expires_at < now() - interval '30 days'`,
	// Dọn thiết bị quen không dùng quá 180 ngày (khớp DEVICE_TRUST_DAYS)
	`DELETE FROM trusteddevices WHERE last_used_at < now() - interval '180 days'`,
];

async function checkSchemaAndCleanup() {
	const pool = await getPool();
	const { rows } = await pool.query(
		`SELECT name FROM unnest($1::text[]) AS name WHERE to_regclass(name) IS NULL`,
		[REQUIRED_RELATIONS],
	);
	if (rows.length) {
		const missing = rows.map((r) => r.name).join(', ');
		const err = new Error(
			`Database thiếu bảng/view: ${missing}. Chạy server/db/postgres/001_init.sql và ` +
				`002_views_functions.sql bằng role hrm_owner (xem server/db/README.md).`,
		);
		err.code = 'SCHEMA_MISSING';
		throw err;
	}
	for (const stmt of CLEANUP_STATEMENTS) await pool.query(stmt);
}

module.exports = { checkSchemaAndCleanup, REQUIRED_RELATIONS };
