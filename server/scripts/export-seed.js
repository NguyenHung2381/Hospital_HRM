#!/usr/bin/env node
/* eslint-disable no-console */
// ============================================================================
// Xuất DỮ LIỆU DANH MỤC từ SQL Server ra server/db/postgres/010_seed_data.sql —
// dữ liệu "cài mới" (npm run setup → Cài mới hoàn toàn) nạp sẵn:
//   vai trò, quyền, quyền theo vai trò, khoa phòng (hệ số), cấu hình TT03,
//   cấu hình khuyến nghị.
// KHÔNG xuất tài khoản, báo cáo, phiên đăng nhập.
//
//   npm run db:export-seed       (trong server/; sửa danh mục ở DB nguồn rồi xuất lại)
//
// Đọc SQL Server giống migrate-from-mssql.js (biến MSSQL_SERVER, MSSQL_DATABASE,
// MSSQL_USER, MSSQL_PASSWORD).
// ============================================================================
const fs = require('fs');
const path = require('path');
const { mssqlJson } = require('./lib/migrationCommon');

const OUT = path.join(__dirname, '..', 'db', 'postgres', '010_seed_data.sql');

// Thứ tự theo khoá ngoại. Bỏ created_at/updated_at → lấy now() lúc cài.
const SEED_TABLES = [
	{ src: 'Roles', dst: 'roles', id: 'id_role',
		cols: ['id_role', 'name_role', 'description', 'icon', 'color', 'is_system', 'department_access_type'] },
	{ src: 'Permissions', dst: 'permissions', id: 'id_permission',
		cols: ['id_permission', 'code_permission', 'label', 'group_name', 'sort_order'] },
	{ src: 'Role_Permissions', dst: 'role_permissions', order: 'id_role, id_permission',
		cols: ['id_role', 'id_permission', 'is_granted'] },
	{ src: 'Departments', dst: 'departments', id: 'id_department',
		cols: ['id_department', 'name_department', 'code_department', 'bed_count', 'coef_level_1', 'coef_level_2',
			'coef_level_3', 'coef_total', 'total_staff', 'status', 'formula_type', 'fixed_staff_add', 'dept_group'] },
	{ src: 'Dept_TT03_Config', dst: 'dept_tt03_config', id: 'id',
		cols: ['id', 'id_department', 'formula_type', 'patient_ratio', 'shift_divisor', 'shift_multiplier', 'fixed_add', 'note'] },
	{ src: 'Dept_Recommended_Config', dst: 'dept_recommended_config', id: 'id',
		cols: ['id', 'id_department', 'formula_type', 'coef_l1', 'coef_l2', 'coef_l3', 'outpatient_ratio', 'fixed_add', 'note'] },
];

function literal(v) {
	if (v === null || v === undefined) return 'NULL';
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	if (typeof v === 'number') return String(v);
	return `'${String(v).replace(/'/g, "''")}'`;
}

function main() {
	const db = process.env.MSSQL_DATABASE || 'HRM_HOSPITAL';
	const out = [
		'-- ============================================================================',
		'-- Dữ liệu danh mục ban đầu cho bản cài mới — SINH TỰ ĐỘNG, không sửa tay.',
		`-- Nguồn: SQL Server ${db}, xuất ngày ${new Date().toISOString().slice(0, 10)} bằng`,
		'--   cd server && npm run db:export-seed',
		'-- Nạp bởi npm run setup (chế độ "Cài mới") khi bảng roles còn trống.',
		'-- Gồm: vai trò, quyền, quyền theo vai trò, khoa phòng, cấu hình TT03,',
		'-- cấu hình khuyến nghị. Không có tài khoản người dùng.',
		'-- ============================================================================',
		'',
		"SET client_encoding = 'UTF8';",
		'BEGIN;',
	];
	const counts = [];
	for (const t of SEED_TABLES) {
		const select = t.cols.map((c) => `[${c}]`).join(', ');
		const rows = mssqlJson(
			`SELECT ${select} FROM dbo.[${t.src}] ORDER BY ${t.order || t.id} FOR JSON PATH, INCLUDE_NULL_VALUES`,
		);
		counts.push(`${t.dst}: ${rows.length}`);
		if (!rows.length) continue;
		out.push('', `-- ${t.dst} (${rows.length} dòng)`, `INSERT INTO ${t.dst} (${t.cols.join(', ')}) VALUES`);
		out.push(rows.map((r) => `\t(${t.cols.map((c) => literal(r[c])).join(', ')})`).join(',\n') + ';');
	}
	out.push('', '-- Đẩy sequence IDENTITY lên MAX(id) để thêm mới không trùng khoá');
	for (const t of SEED_TABLES.filter((x) => x.id)) {
		out.push(
			`SELECT setval(pg_get_serial_sequence('${t.dst}', '${t.id}'), COALESCE((SELECT MAX(${t.id}) FROM ${t.dst}), 1), (SELECT COUNT(*) > 0 FROM ${t.dst}));`,
		);
	}
	out.push('', 'COMMIT;', '');
	fs.writeFileSync(OUT, out.join('\n'));
	console.log(`✅ Đã ghi ${path.relative(process.cwd(), OUT)} — ${counts.join(', ')}`);
}

try {
	main();
} catch (err) {
	console.error('❌', err.message);
	process.exit(1);
}
