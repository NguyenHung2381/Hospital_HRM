#!/usr/bin/env node
/* eslint-disable no-console */
// ============================================================================
// Chuyển DỮ LIỆU từ SQL Server (HRM_HOSPITAL) sang PostgreSQL (hrm_hospital).
// Schema PostgreSQL phải được tạo trước (server/db/postgres/001, 002).
//
// Đọc SQL Server bằng `sqlcmd` (… FOR JSON) → chạy được với Windows
// Authentication lẫn SQL login, không cần driver mssql. Ghi PostgreSQL bằng role
// sở hữu bảng (hrm_owner) trong MỘT transaction: lỗi giữa chừng → không ghi gì.
//
//   node scripts/migrate-from-mssql.js            # bảng PG đích phải trống
//   node scripts/migrate-from-mssql.js --truncate # xoá sạch dữ liệu PG trước khi nạp
//
// Biến môi trường:
//   MSSQL_SERVER   (mặc định localhost\SQLEXPRESS)   MSSQL_DATABASE (HRM_HOSPITAL)
//   MSSQL_USER / MSSQL_PASSWORD  — bỏ trống = Windows Authentication (sqlcmd -E)
//   PG_HOST PG_PORT PG_DATABASE PG_USER PG_PASSWORD — mặc định lấy DB_* trong .env,
//   nhưng PG_USER nên là hrm_owner (hrm_app không TRUNCATE được).
// ============================================================================
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

// Thứ tự nạp theo khoá ngoại (bảng cha trước).
// columns: đổi tên cột SQL Server → PostgreSQL (mặc định: viết thường).
const TABLES = [
	{ src: 'Roles', dst: 'roles' },
	{ src: 'Permissions', dst: 'permissions' },
	{ src: 'Departments', dst: 'departments' },
	{ src: 'Role_Permissions', dst: 'role_permissions' },
	{ src: 'Role_Department_Access', dst: 'role_department_access', columns: { id_deparment: 'id_department' } },
	{ src: 'Users', dst: 'users' },
	{ src: 'User_Department_Access', dst: 'user_department_access' },
	{ src: 'User_Dept_Permissions', dst: 'user_dept_permissions' },
	{ src: 'Dept_TT03_Config', dst: 'dept_tt03_config' },
	{ src: 'Dept_Recommended_Config', dst: 'dept_recommended_config' },
	{ src: 'Daily_Reports', dst: 'daily_reports' },
	{ src: 'Report_Department_Records ', dst: 'report_department_records' }, // tên cũ có dấu cách cuối
	{ src: 'Report_CLS_Records', dst: 'report_cls_records' },
	{ src: 'Staff_Coordination_Records', dst: 'staff_coordination_records' },
	{ src: 'UserSessions', dst: 'usersessions' },
	{ src: 'SecurityEvents', dst: 'securityevents' },
	{ src: 'TrustedDevices', dst: 'trusteddevices' },
	{ src: 'Auth_Sessions', dst: 'auth_sessions' },
];

const BATCH_ROWS = 1000;

function sqlcmdArgs() {
	const args = [
		'-S', process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS',
		'-d', process.env.MSSQL_DATABASE || 'HRM_HOSPITAL',
		'-C', // tin chứng chỉ tự ký (chỉ đọc dữ liệu trên máy/mạng nội bộ)
		'-b', // lỗi SQL → mã thoát khác 0
		'-y', '0', // không cắt cột (JSON dài); -y 0 không đi cùng -h nên tự bỏ tiêu đề
		'-f', '65001', // UTF-8
	];
	if (process.env.MSSQL_USER) args.push('-U', process.env.MSSQL_USER, '-P', process.env.MSSQL_PASSWORD || '');
	else args.push('-E');
	return args;
}

// Ghi kết quả ra FILE (-o) chứ không đọc stdout: ra stdout, sqlcmd đổi chuỗi
// theo codepage của console (vd cp1252) bất kể -f 65001 → tiếng Việt thành '?'.
function mssqlJson(query) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrm-mssql-'));
	const file = path.join(dir, 'out.json');
	let out;
	try {
		execFileSync('sqlcmd', [...sqlcmdArgs(), '-o', file, '-Q', `SET NOCOUNT ON; ${query}`], {
			stdio: ['ignore', 'ignore', 'pipe'],
			windowsHide: true,
		});
		out = fs.readFileSync(file, 'utf8');
	} catch (err) {
		// -b: lỗi SQL → mã thoát khác 0, thông báo lỗi nằm trong file output
		const detail = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
		throw new Error(`sqlcmd lỗi: ${detail || err.stderr?.toString() || err.message}`);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
	// Kết quả FOR JSON là 1 chuỗi '[...]' (bảng trống → không có dòng nào).
	// Bỏ dòng tiêu đề/gạch ngang nếu có; sqlcmd có thể ngắt chuỗi JSON dài thành
	// nhiều dòng → nối lại.
	const lines = out.replace(/^﻿/, '').split(/\r?\n/);
	const start = lines.findIndex((l) => l.startsWith('['));
	if (start === -1) {
		if (lines.every((l) => !l.trim() || l.startsWith('JSON_F52E2B61') || /^-+$/.test(l.trim()))) return [];
		throw new Error(`sqlcmd trả về không đúng định dạng: ${out.slice(0, 200)}`);
	}
	return JSON.parse(lines.slice(start).join('').trim());
}

function readTable(t) {
	const name = `[${t.src.replace(/]/g, ']]')}]`;
	// Mọi cột DATETIME2 đang lưu giờ UTC → thêm hậu tố Z để PostgreSQL hiểu đúng
	// (DATETIMEOFFSET đã có sẵn múi giờ trong JSON).
	const cols = mssqlJson(`
		SELECT c.name, t.name AS type
		FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
		WHERE c.object_id = OBJECT_ID(N'dbo.${name.replace(/'/g, "''")}')
		ORDER BY c.column_id
		FOR JSON PATH`);
	if (!cols.length) throw new Error(`Không thấy bảng ${t.src} trên SQL Server`);
	const select = cols
		.map((c) => {
			const q = `[${c.name}]`;
			return c.type === 'datetime2' || c.type === 'datetime'
				? `CASE WHEN ${q} IS NULL THEN NULL ELSE CONVERT(varchar(33), ${q}, 126) + 'Z' END AS ${q}`
				: q;
		})
		.join(', ');
	const rows = mssqlJson(`SELECT ${select} FROM dbo.${name} FOR JSON PATH, INCLUDE_NULL_VALUES`);
	if (JSON.stringify(rows).includes('�'))
		throw new Error(`Bảng ${t.src}: dữ liệu đọc về bị lỗi mã hoá (U+FFFD) — dừng để không ghi dữ liệu hỏng`);
	const rename = t.columns || {};
	return rows.map((r) => {
		const o = {};
		for (const [k, v] of Object.entries(r)) o[rename[k] || k.toLowerCase()] = v;
		return o;
	});
}

async function main() {
	const truncate = process.argv.includes('--truncate');
	const pg = new Client({
		host: process.env.PG_HOST || process.env.DB_HOST,
		port: Number(process.env.PG_PORT || process.env.DB_PORT || 5432),
		database: process.env.PG_DATABASE || process.env.DB_NAME,
		user: process.env.PG_USER || process.env.DB_USER,
		password: process.env.PG_PASSWORD ?? process.env.DB_PASSWORD,
		application_name: 'hrm-migrate-from-mssql',
	});
	await pg.connect();
	console.log(`→ PostgreSQL ${pg.host}:${pg.port}/${pg.database} (user ${pg.user})`);

	const report = [];
	try {
		await pg.query('BEGIN');
		await pg.query("SET LOCAL TimeZone = 'UTC'");
		if (truncate) {
			await pg.query(`TRUNCATE ${TABLES.map((t) => t.dst).join(', ')} RESTART IDENTITY`);
			console.log('  đã TRUNCATE mọi bảng đích');
		}
		for (const t of TABLES) {
			const { rows: existing } = await pg.query(`SELECT count(*)::int AS n FROM ${t.dst}`);
			if (existing[0].n) throw new Error(`Bảng ${t.dst} đã có ${existing[0].n} dòng — chạy lại với --truncate`);

			const rows = readTable(t);
			for (let i = 0; i < rows.length; i += BATCH_ROWS) {
				const batch = JSON.stringify(rows.slice(i, i + BATCH_ROWS));
				await pg.query(
					`INSERT INTO ${t.dst} SELECT * FROM jsonb_populate_recordset(NULL::${t.dst}, $1::jsonb)`,
					[batch],
				);
			}
			const { rows: cnt } = await pg.query(`SELECT count(*)::int AS n FROM ${t.dst}`);
			report.push({ table: t.dst, mssql: rows.length, postgres: cnt[0].n });
			if (cnt[0].n !== rows.length) throw new Error(`Lệch số dòng ở ${t.dst}: ${rows.length} → ${cnt[0].n}`);
			console.log(`  ${t.dst.padEnd(28)} ${String(rows.length).padStart(6)} dòng`);
		}

		// Đẩy sequence IDENTITY lên MAX(id) (giống 900_reset_sequences.sql)
		await pg.query(`
			DO $$
			DECLARE rec record; v_max bigint;
			BEGIN
				FOR rec IN
					SELECT c.table_name, c.column_name,
					       pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
					FROM information_schema.columns c
					WHERE c.table_schema = 'public' AND c.is_identity = 'YES'
				LOOP
					EXECUTE format('SELECT MAX(%I) FROM %I', rec.column_name, rec.table_name) INTO v_max;
					IF v_max IS NULL THEN PERFORM setval(rec.seq, 1, false);
					ELSE PERFORM setval(rec.seq, v_max, true);
					END IF;
				END LOOP;
			END $$`);
		await pg.query('COMMIT');
	} catch (err) {
		await pg.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		await pg.end();
	}
	console.table(report);
	console.log('✅ Đã chuyển dữ liệu xong (sequence đã được đặt lại).');
}

main().catch((err) => {
	console.error('❌ Chuyển dữ liệu thất bại, PostgreSQL không bị thay đổi:', err.message);
	process.exit(1);
});
