// Dùng chung cho migrate-from-mssql.js và verify-migration.js: danh sách bảng,
// đọc SQL Server qua sqlcmd, kết nối PostgreSQL.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
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
	// Bảng mới (refresh token), DB SQL Server cũ có thể chưa có → coi như rỗng.
	{ src: 'Auth_Sessions', dst: 'auth_sessions', optional: true },
];

// ── SQL Server (sqlcmd) ─────────────────────────────────────────────────────
// MSSQL_USER trống = Windows Authentication (-E). Mật khẩu truyền qua biến môi
// trường SQLCMDPASSWORD (không đặt trên dòng lệnh → không lộ trong danh sách tiến trình).
// format mặc định -y 0: không cắt cột (JSON dài), tự bỏ dòng tiêu đề.
function sqlcmdInvocation(database = process.env.MSSQL_DATABASE || 'HRM_HOSPITAL', format = ['-y', '0']) {
	const args = [
		'-S', process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS',
		'-d', database,
		'-C', // tin chứng chỉ tự ký (chỉ đọc dữ liệu trên máy/mạng nội bộ)
		'-b', // lỗi SQL → mã thoát khác 0
		...format,
		'-f', '65001', // UTF-8
	];
	const env = { ...process.env };
	if (process.env.MSSQL_USER) {
		args.push('-U', process.env.MSSQL_USER);
		env.SQLCMDPASSWORD = process.env.MSSQL_PASSWORD || '';
	} else {
		args.push('-E');
	}
	return { args, env };
}

// Ghi kết quả ra FILE (-o) chứ không đọc stdout: ra stdout, sqlcmd đổi chuỗi
// theo codepage của console (vd cp1252) bất kể -f 65001 → tiếng Việt thành '?'.
function runSqlcmd(query, invocation) {
	const { args, env } = invocation;
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrm-mssql-'));
	const file = path.join(dir, 'out.txt');
	try {
		execFileSync('sqlcmd', [...args, '-o', file, '-Q', `SET NOCOUNT ON; ${query}`], {
			stdio: ['ignore', 'ignore', 'pipe'],
			windowsHide: true,
			env,
		});
		return fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
	} catch (err) {
		// -b: lỗi SQL → mã thoát khác 0, thông báo lỗi nằm trong file output
		const detail = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
		throw new Error(`sqlcmd lỗi: ${detail || err.stderr?.toString() || err.message}`);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

// Chạy câu lệnh trả về bảng không dùng được FOR JSON (vd RESTORE HEADERONLY /
// FILELISTONLY) → mảng object theo tên cột. database mặc định master.
function mssqlTable(query, database = 'master') {
	const out = runSqlcmd(query, sqlcmdInvocation(database, ['-W', '-s', '|']));
	const lines = out.split(/\r?\n/);
	const h = lines.findIndex((l) => l.trim());
	if (h === -1) return [];
	const header = lines[h].split('|');
	const rows = [];
	// bỏ dòng tiêu đề + dòng gạch ngang; dừng ở dòng trống
	for (const line of lines.slice(h + 2)) {
		if (!line.trim()) break;
		const cells = line.split('|');
		rows.push(Object.fromEntries(header.map((name, i) => [name, cells[i] === 'NULL' ? null : cells[i]])));
	}
	return rows;
}

// Chạy câu lệnh không cần kết quả (vd RESTORE DATABASE, DROP DATABASE).
function mssqlExec(query, database = 'master') {
	return runSqlcmd(query, sqlcmdInvocation(database, []));
}

// Chạy 1 câu ... FOR JSON và trả về mảng object.
function mssqlJson(query) {
	const { args, env } = sqlcmdInvocation();
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrm-mssql-'));
	const file = path.join(dir, 'out.json');
	let out;
	try {
		execFileSync('sqlcmd', [...args, '-o', file, '-Q', `SET NOCOUNT ON; ${query}`], {
			stdio: ['ignore', 'ignore', 'pipe'],
			windowsHide: true,
			env,
		});
		out = fs.readFileSync(file, 'utf8');
	} catch (err) {
		// -b: lỗi SQL → mã thoát khác 0, thông báo lỗi nằm trong file output
		const detail = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
		throw new Error(`sqlcmd lỗi: ${detail || err.stderr?.toString() || err.message}`);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
	// Kết quả FOR JSON là 1 chuỗi '[...]' (không có dòng nào → rỗng). sqlcmd có
	// thể ngắt chuỗi JSON dài thành nhiều dòng → nối lại.
	const lines = out.replace(/^﻿/, '').split(/\r?\n/);
	const start = lines.findIndex((l) => l.startsWith('['));
	if (start === -1) {
		if (lines.every((l) => !l.trim() || l.startsWith('JSON_F52E2B61') || /^-+$/.test(l.trim()))) return [];
		throw new Error(`sqlcmd trả về không đúng định dạng: ${out.slice(0, 200)}`);
	}
	const rows = JSON.parse(lines.slice(start).join('').trim());
	if (JSON.stringify(rows).includes('�'))
		throw new Error('Dữ liệu đọc từ SQL Server bị lỗi mã hoá (U+FFFD) — dừng để không dùng dữ liệu hỏng');
	return rows;
}

function quoteMssql(name) {
	return `[${name.replace(/]/g, ']]')}]`;
}

// Đọc toàn bộ 1 bảng; key = tên cột PostgreSQL. DATETIME2/DATETIME đang lưu giờ
// UTC → thêm hậu tố Z (DATETIMEOFFSET đã có múi giờ trong JSON).
function readTable(t) {
	const name = quoteMssql(t.src);
	const cols = mssqlJson(`
		SELECT c.name, t.name AS type
		FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
		WHERE c.object_id = OBJECT_ID(N'dbo.${name.replace(/'/g, "''")}')
		ORDER BY c.column_id
		FOR JSON PATH`);
	if (!cols.length) {
		if (t.optional) return [];
		throw new Error(`Không thấy bảng ${t.src} trên SQL Server`);
	}
	const select = cols
		.map((c) => {
			const q = quoteMssql(c.name);
			return c.type === 'datetime2' || c.type === 'datetime'
				? `CASE WHEN ${q} IS NULL THEN NULL ELSE CONVERT(varchar(33), ${q}, 126) + 'Z' END AS ${q}`
				: q;
		})
		.join(', ');
	const rows = mssqlJson(`SELECT ${select} FROM dbo.${name} FOR JSON PATH, INCLUDE_NULL_VALUES`);
	const rename = t.columns || {};
	return rows.map((r) => {
		const o = {};
		for (const [k, v] of Object.entries(r)) o[rename[k] || k.toLowerCase()] = v;
		return o;
	});
}

// ── PostgreSQL ──────────────────────────────────────────────────────────────
// PG_* ưu tiên; thiếu thì lấy DB_* trong server/.env. Nên dùng role hrm_owner.
function pgClient(applicationName, extra = {}) {
	return new Client({
		...extra,
		host: process.env.PG_HOST || process.env.DB_HOST,
		port: Number(process.env.PG_PORT || process.env.DB_PORT || 5432),
		database: process.env.PG_DATABASE || process.env.DB_NAME,
		user: process.env.PG_USER || process.env.DB_USER,
		password: process.env.PG_PASSWORD ?? process.env.DB_PASSWORD,
		ssl:
			(process.env.PG_SSL ?? process.env.DB_SSL) === 'true'
				? { rejectUnauthorized: (process.env.PG_SSL_REJECT_UNAUTHORIZED ?? process.env.DB_SSL_REJECT_UNAUTHORIZED) !== 'false' }
				: false,
		application_name: applicationName,
	});
}

module.exports = { TABLES, mssqlJson, mssqlTable, mssqlExec, readTable, pgClient };
