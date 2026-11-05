#!/usr/bin/env node
// ============================================================================
// Cài đặt 1 lệnh cho Hospital HRM (chạy sau khi đã npm install — xem
// "npm run setup" ở package.json gốc):
//
//   1. Tạo / cập nhật file env của server (server/.env hoặc .env.production):
//      sinh JWT_SECRET, mật khẩu DB cho hrm_app nếu còn trống.
//   2. Tạo role hrm_owner, hrm_app + database hrm_hospital (giống 000_roles_database.sql).
//   3. Tạo bảng (001_init.sql — chỉ khi DB chưa có bảng) và view/hàm
//      (002_views_functions.sql — luôn chạy lại, file idempotent).
//   4. Dữ liệu — DB còn trống thì hỏi chọn:
//        1) Cài mới: nạp danh mục (010_seed_data.sql: vai trò, quyền, khoa phòng + hệ số)
//        2) Nhập từ file .bak: khôi phục vào SQL Server tạm → chuyển sang PostgreSQL → đối chiếu → xoá DB tạm
//        3) Nhập từ database SQL Server đang chạy
//      DB đã có dữ liệu → giữ nguyên (trừ khi chỉ định --import-*).
//   5. Chưa có tài khoản "Quản trị hệ thống" nào đang hoạt động → tạo tài khoản admin.
//   6. Kiểm tra đăng nhập DB bằng hrm_app và đủ bảng/view.
//   7. (--docker) Build image + chạy container: docker compose up -d --build.
//
// Chạy lại nhiều lần được: bước nào đã xong thì bỏ qua.
//
// Tuỳ chọn:
//   --prod               dùng server/.env.production + docker-compose.prod.yml
//   --docker             build + chạy bằng Docker sau khi cài DB
//                        (dev: docker-compose.yml, --prod: docker-compose.prod.yml)
//   --fresh              cài mới, không hỏi
//   --import-bak=<file>  nhập dữ liệu từ file backup SQL Server (.bak), không hỏi
//   --import-mssql[=<db>] nhập từ database SQL Server đang chạy (mặc định HRM_HOSPITAL)
//   --yes                đồng ý xoá dữ liệu PostgreSQL đang có khi nhập lại (không hỏi)
//   --skip-db            chỉ tạo file env, không đụng tới PostgreSQL
//   --admin-user=<tên>   tên đăng nhập admin đầu tiên (mặc định: admin)
//
// Nhập từ SQL Server cần sqlcmd; MSSQL_SERVER (mặc định localhost\SQLEXPRESS),
// MSSQL_USER / MSSQL_PASSWORD (trống = Windows Authentication).
//
// Biến môi trường (không bắt buộc):
//   PG_SUPER_USER        superuser PostgreSQL (mặc định: postgres)
//   PG_SUPER_PASSWORD    mật khẩu superuser — không đặt thì script hỏi (nhập ẩn)
//   SETUP_DB_HOST        host PostgreSQL nhìn từ máy chạy script (mặc định lấy
//                        DB_HOST; host.docker.internal → localhost)
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync } = require('child_process');

const SERVER_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(SERVER_DIR, '..');
const SQL_DIR = path.join(SERVER_DIR, 'db', 'postgres');

const args = process.argv.slice(2);
const PROD = args.includes('--prod');
const DOCKER = args.includes('--docker');
const SKIP_DB = args.includes('--skip-db');
const FRESH = args.includes('--fresh');
const YES = args.includes('--yes');
// --name=giá trị (giá trị có thể chứa '='); --name không có giá trị → ''
const argValue = (name) => {
	const a = args.find((x) => x === name || x.startsWith(`${name}=`));
	return a === undefined ? null : a.slice(name.length + 1);
};
const BAK_ARG = argValue('--import-bak');
const MSSQL_ARG = argValue('--import-mssql');
if (BAK_ARG === '') {
	console.error('❌ --import-bak cần đường dẫn file: --import-bak=D:\\Backup\\HRM.bak');
	process.exit(1);
}
const ADMIN_USER = (args.find((a) => a.startsWith('--admin-user=')) || '--admin-user=admin').split('=')[1];

const OWNER_ROLE = 'hrm_owner';
const ADMIN_ROLE_NAME = 'Quản trị hệ thống';

const step = (n, msg) => console.log(`\n[${n}] ${msg}`);
const ok = (msg) => console.log(`    ✅ ${msg}`);
const info = (msg) => console.log(`    • ${msg}`);
const warn = (msg) => console.log(`    ⚠️  ${msg}`);

function fail(msg) {
	console.error(`\n❌ ${msg}`);
	process.exit(1);
}

// ── File env ────────────────────────────────────────────────────────────────

// Đọc giá trị KEY=value (bỏ comment cuối dòng nếu không có dấu nháy).
function parseEnv(text) {
	const env = {};
	for (const line of text.split(/\r?\n/)) {
		const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
		if (!m) continue;
		let v = m[2].trim();
		if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
		else v = v.replace(/\s+#.*$/, '').trim();
		env[m[1]] = v;
	}
	return env;
}

// Đặt KEY=value: sửa dòng KEY= đang có (kể cả dòng "# KEY=" bị comment), không có thì thêm cuối file.
// Không dùng \s hay . trong regex: file có thể xuống dòng kiểu Windows (CRLF).
function setEnv(text, key, value) {
	const line = `${key}=${value}`;
	const re = new RegExp(`^[ \\t]*${key}[ \\t]*=[^\\r\\n]*`, 'm');
	if (re.test(text)) return text.replace(re, () => line);
	const commented = new RegExp(`^#[ \\t]*${key}=[^\\r\\n]*`, 'm');
	if (commented.test(text)) return text.replace(commented, () => line);
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	return `${text.replace(/\s*$/, '')}${eol}${line}${eol}`;
}

// File env còn cấu hình SQL Server (trước khi chuyển PostgreSQL)?
function isLegacyEnv(env) {
	return (
		'DB_ENCRYPT' in env ||
		'DB_TRUST_CERT' in env ||
		(env.DB_HOST || '').includes('\\') ||
		(env.DB_USER || '').toLowerCase() === 'sa' ||
		['1433', '1413'].includes(env.DB_PORT)
	);
}

const randomSecret = (bytes) => crypto.randomBytes(bytes).toString('hex');

function prepareEnvFile() {
	const envName = PROD ? '.env.production' : '.env';
	const envPath = path.join(SERVER_DIR, envName);
	const template = fs.readFileSync(path.join(SERVER_DIR, `${envName}.example`), 'utf8');

	step(1, `File cấu hình server/${envName}`);
	let text;
	let fromTemplate = true;
	if (!fs.existsSync(envPath)) {
		text = template;
		info(`Chưa có → tạo từ server/${envName}.example`);
	} else {
		const old = fs.readFileSync(envPath, 'utf8');
		const oldEnv = parseEnv(old);
		if (isLegacyEnv(oldEnv)) {
			const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
			const backup = `${envPath}.bak-${stamp}`;
			fs.copyFileSync(envPath, backup);
			warn(`File đang là cấu hình SQL Server cũ → đã sao lưu sang ${path.basename(backup)}`);
			info('Tạo lại theo mẫu PostgreSQL, giữ các giá trị không liên quan DB');
			text = template;
			for (const key of ['PORT', 'HOST', 'JWT_SECRET', 'JWT_EXPIRES', 'COOKIE_SECURE', 'TRUST_PROXY', 'CORS_ORIGIN']) {
				if (oldEnv[key]) text = setEnv(text, key, oldEnv[key]);
			}
		} else {
			text = old;
			fromTemplate = false;
			info('Đã có → chỉ điền các giá trị còn trống');
		}
	}

	let env = parseEnv(text);
	// File mẫu dev để sẵn NODE_ENV=production → đổi sang development cho máy lập trình.
	if (!PROD && fromTemplate) text = setEnv(text, 'NODE_ENV', 'development');
	if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
		text = setEnv(text, 'JWT_SECRET', randomSecret(48));
		ok('Đã sinh JWT_SECRET mới');
	} else ok('JWT_SECRET đã có');
	if (!env.DB_PASSWORD) {
		text = setEnv(text, 'DB_PASSWORD', randomSecret(24));
		ok('Đã sinh mật khẩu DB cho hrm_app (DB_PASSWORD)');
	}

	fs.writeFileSync(envPath, text);
	env = parseEnv(text);
	for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER']) {
		if (!env[key]) fail(`server/${envName}: ${key} đang trống — điền rồi chạy lại.`);
	}
	if (['postgres', OWNER_ROLE].includes(env.DB_USER.toLowerCase()))
		fail(`DB_USER=${env.DB_USER} — app phải dùng role ứng dụng (hrm_app), không dùng superuser/owner.`);
	ok(`Đã lưu server/${envName}`);
	return { env, envName };
}

// ── PostgreSQL ──────────────────────────────────────────────────────────────

function askHidden(question) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		rl._writeToOutput = (s) => {
			if (s.startsWith(question)) rl.output.write(question);
		};
		rl.question(question, (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer);
		});
	});
}

const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;
const quoteLiteral = (s) => `'${String(s).replace(/'/g, "''")}'`;

function readSql(file) {
	return fs.readFileSync(path.join(SQL_DIR, file), 'utf8').replace(/^﻿/, '');
}

// Chạy 1 file .sql (nhiều câu lệnh). File có BEGIN/COMMIT → lỗi thì ROLLBACK.
async function runSqlFile(client, file) {
	try {
		await client.query(readSql(file));
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw new Error(`${file}: ${err.message}`);
	}
}

function ask(question) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

async function dataCounts(db) {
	const { rows } = await db.query(`SELECT
		(SELECT count(*) FROM users)::int AS users,
		(SELECT count(*) FROM roles)::int AS roles,
		(SELECT count(*) FROM permissions)::int AS permissions,
		(SELECT count(*) FROM departments)::int AS departments`);
	return rows[0];
}

// Chế độ dữ liệu: cờ dòng lệnh > hỏi (DB còn trống) > giữ nguyên (DB đã có dữ liệu).
//   fresh: nạp danh mục mẫu (010_seed_data.sql) + tạo admin
//   bak:   khôi phục file .bak vào SQL Server tạm rồi chuyển sang PostgreSQL
//   mssql: chuyển từ database SQL Server đang chạy
//   keep:  không đụng tới dữ liệu
async function chooseDataMode(counts) {
	const hasData = counts.users > 0 || counts.roles > 0;
	let choice = null;
	if (BAK_ARG) choice = { mode: 'bak', bak: BAK_ARG };
	else if (MSSQL_ARG !== null) choice = { mode: 'mssql', database: MSSQL_ARG || 'HRM_HOSPITAL' };
	else if (FRESH) return { mode: 'fresh' };
	else if (hasData) return { mode: 'keep' };
	else if (!process.stdin.isTTY) return { mode: 'fresh' };
	else {
		const server = process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS';
		console.log('    Chọn kiểu cài đặt:');
		console.log('      1) Cài mới hoàn toàn — nạp sẵn vai trò, quyền, khoa phòng (hệ số) + tạo tài khoản admin');
		console.log(`      2) Nhập dữ liệu từ file backup SQL Server (.bak) — khôi phục tạm trên ${server}`);
		console.log(`      3) Nhập dữ liệu từ database SQL Server đang chạy trên ${server}`);
		const pick = (await ask('    Chọn [1]: ')) || '1';
		if (pick === '2') {
			const bak = await ask('    Đường dẫn file .bak: ');
			if (!bak) fail('Chưa nhập đường dẫn file .bak.');
			choice = { mode: 'bak', bak };
		} else if (pick === '3') {
			choice = { mode: 'mssql', database: (await ask('    Tên database SQL Server [HRM_HOSPITAL]: ')) || 'HRM_HOSPITAL' };
		} else if (pick === '1') return { mode: 'fresh' };
		else fail(`Lựa chọn không hợp lệ: ${pick}`);
	}

	// Nhập dữ liệu = XOÁ toàn bộ dữ liệu PostgreSQL hiện có rồi nạp lại.
	if (hasData) {
		warn(`PostgreSQL đang có dữ liệu (${counts.users} tài khoản, ${counts.departments} khoa phòng).`);
		warn('Nhập dữ liệu sẽ XOÁ TOÀN BỘ dữ liệu này rồi nạp lại từ SQL Server.');
		if (!YES) {
			if (!process.stdin.isTTY) fail('Thêm --yes để xác nhận xoá dữ liệu PostgreSQL hiện có.');
			if ((await ask("    Gõ 'yes' để tiếp tục: ")).toLowerCase() !== 'yes') fail('Đã huỷ — dữ liệu giữ nguyên.');
		}
	}
	return choice;
}

async function ensureAdmin(db) {
	const { rows } = await db.query(
		`SELECT count(*)::int AS n FROM users u JOIN roles r ON r.id_role = u.id_role
		 WHERE r.name_role = $1 AND u.status = 'active'`,
		[ADMIN_ROLE_NAME],
	);
	if (rows[0].n) {
		info(`Đã có ${rows[0].n} tài khoản "${ADMIN_ROLE_NAME}" — không tạo mới`);
		return null;
	}
	if ((await db.query('SELECT 1 FROM users WHERE username = $1', [ADMIN_USER])).rowCount) {
		warn(`Chưa có tài khoản quản trị nào đang hoạt động, nhưng tên "${ADMIN_USER}" đã có người dùng.`);
		warn('Chạy lại với --admin-user=<tên khác> để tạo tài khoản quản trị.');
		return null;
	}
	const { hashPassword, generateTempPassword } = require('../src/utils/password');
	let { rows: role } = await db.query('SELECT id_role FROM roles WHERE name_role = $1', [ADMIN_ROLE_NAME]);
	if (!role.length) {
		({ rows: role } = await db.query(
			`INSERT INTO roles (name_role, description, icon, color, is_system, department_access_type)
			 VALUES ($1, 'Toàn quyền hệ thống', '🔑', 'red', true, 'all') RETURNING id_role`,
			[ADMIN_ROLE_NAME],
		));
		ok(`Đã tạo vai trò "${ADMIN_ROLE_NAME}"`);
	}
	const password = generateTempPassword();
	await db.query(
		// Mật khẩu tạm in ra màn hình → bắt đổi ở lần đăng nhập đầu
		`INSERT INTO users (username, password, full_name, id_role, status, must_change_password, password_changed_at)
		 VALUES ($1, $2, $3, $4, 'active', true, now())`,
		[ADMIN_USER, await hashPassword(password), ADMIN_ROLE_NAME, role[0].id_role],
	);
	ok(`Đã tạo tài khoản "${ADMIN_USER}"`);
	return password;
}

// ── Nhập dữ liệu từ SQL Server ──────────────────────────────────────────────

const mssqlLiteral = (s) => `N'${String(s).replace(/'/g, "''")}'`;
const mssqlIdent = (s) => `[${String(s).replace(/]/g, ']]')}]`;

// Khôi phục file .bak thành database tạm HRM_IMPORT_<thời gian> trên SQL Server
// (MSSQL_SERVER, mặc định localhost\SQLEXPRESS). Trả về tên database tạm.
function restoreBak(file) {
	const { mssqlTable, mssqlExec } = require('./lib/migrationCommon');
	// npm chạy script ở thư mục gốc repo → đường dẫn tương đối tính theo nơi gõ lệnh
	const bak = path.resolve(process.env.INIT_CWD || process.cwd(), file.replace(/^["']|["']$/g, ''));
	info(`File: ${bak}`);
	// File do dịch vụ SQL Server đọc, không phải tài khoản đang chạy script — thư mục
	// Backup của SQL Server thường không mở được với user thường nhưng SQL Server vẫn đọc được.
	if (!fs.existsSync(bak)) info('Tài khoản hiện tại không thấy file — để SQL Server tự đọc');

	const explain = (err) => {
		let msg = err.message;
		if (/Operating system error (2|3)\b/i.test(msg))
			msg += `\n   → Không có file ${bak} trên máy chạy SQL Server.`;
		if (/Operating system error 5|Access is denied/i.test(msg))
			msg += '\n   → Dịch vụ SQL Server không đọc được file. Chép file .bak vào thư mục Backup của SQL Server' +
				'\n     (vd ...\\MSSQL\\Backup) hoặc cấp quyền đọc cho NT Service\\MSSQL$SQLEXPRESS rồi chạy lại.';
		if (/version/i.test(msg) && /backed up/i.test(msg))
			msg += '\n   → File được tạo từ SQL Server mới hơn máy này — cần cài SQL Server cùng hoặc mới hơn.';
		return msg;
	};

	let headers;
	try {
		headers = mssqlTable(`RESTORE HEADERONLY FROM DISK = ${mssqlLiteral(bak)}`);
	} catch (err) {
		fail(`Không đọc được file backup: ${explain(err)}`);
	}
	// BackupType 1 = full database; 1 file có thể chứa nhiều bản → lấy bản mới nhất
	const full = headers.filter((h) => h.BackupType === '1');
	if (!full.length) fail('File .bak không chứa bản backup đầy đủ (full) nào.');
	const last = full.reduce((a, b) => (Number(b.Position) > Number(a.Position) ? b : a));
	info(`Bản backup: database ${last.DatabaseName}, lúc ${last.BackupFinishDate}`);

	const position = Number(last.Position);
	const files = mssqlTable(`RESTORE FILELISTONLY FROM DISK = ${mssqlLiteral(bak)} WITH FILE = ${position}`);
	const [dirs] = mssqlTable(`SELECT
		CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400)) AS data_dir,
		CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(400)) AS log_dir`);
	const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
	const tempDb = `HRM_IMPORT_${stamp}`;
	const moves = files.map((f, i) => {
		const ext = f.Type === 'L' ? '.ldf' : f.Type === 'D' ? (i === 0 ? '.mdf' : '.ndf') : '';
		const dir = f.Type === 'L' ? dirs.log_dir : dirs.data_dir;
		return `MOVE ${mssqlLiteral(f.LogicalName)} TO ${mssqlLiteral(path.win32.join(dir, `${tempDb}_${i}${ext}`))}`;
	});
	info(`Đang khôi phục vào database tạm ${tempDb}...`);
	try {
		mssqlExec(
			`RESTORE DATABASE ${mssqlIdent(tempDb)} FROM DISK = ${mssqlLiteral(bak)}
			 WITH FILE = ${position}, ${moves.join(', ')}, RECOVERY`,
		);
	} catch (err) {
		dropTempDb(tempDb);
		fail(`Khôi phục .bak thất bại: ${explain(err)}`);
	}
	ok(`Đã khôi phục vào ${tempDb}`);
	return tempDb;
}

function dropTempDb(name) {
	// Chỉ xoá đúng database tạm do script tạo
	if (!/^HRM_IMPORT_\d{8}_\d{6}$/.test(name)) return;
	try {
		require('./lib/migrationCommon').mssqlExec(
			`IF DB_ID(${mssqlLiteral(name)}) IS NOT NULL BEGIN
				ALTER DATABASE ${mssqlIdent(name)} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
				DROP DATABASE ${mssqlIdent(name)};
			END`,
		);
		info(`Đã xoá database tạm ${name}`);
	} catch (err) {
		warn(`Không xoá được database tạm ${name} (xoá tay trong SSMS): ${err.message}`);
	}
}

// Chuyển dữ liệu bằng 2 script có sẵn (migrate-from-mssql.js --truncate rồi
// verify-migration.js), ghi PostgreSQL bằng superuser vừa nhập.
function importFromSqlServer(choice, pg) {
	if (spawnSync('sqlcmd', ['-?'], { stdio: 'ignore', windowsHide: true }).error)
		fail('Không tìm thấy sqlcmd — cài SQL Server Management Studio / sqlcmd rồi chạy lại.');

	const database = choice.mode === 'bak' ? restoreBak(choice.bak) : choice.database;
	const childEnv = {
		...process.env,
		MSSQL_DATABASE: database,
		PG_HOST: pg.host,
		PG_PORT: String(pg.port),
		PG_DATABASE: pg.dbName,
		PG_USER: pg.superUser,
		PG_PASSWORD: pg.superPassword,
		PG_SSL: pg.ssl || 'false',
	};
	const run = (script, scriptArgs = []) =>
		spawnSync(process.execPath, [path.join(__dirname, script), ...scriptArgs], {
			cwd: SERVER_DIR,
			env: childEnv,
			stdio: 'inherit',
		}).status === 0;

	// fail() thoát tiến trình ngay (không chạy finally) → xoá database tạm trước.
	let error = null;
	info(`Chuyển dữ liệu từ SQL Server ${database} (xoá dữ liệu PostgreSQL cũ trước khi nạp)...`);
	if (!run('migrate-from-mssql.js', ['--truncate'])) {
		error = 'Chuyển dữ liệu thất bại — PostgreSQL không bị thay đổi.';
	} else {
		info('Đối chiếu từng ô dữ liệu giữa 2 database...');
		if (!run('verify-migration.js')) error = 'Dữ liệu sau khi chuyển chưa khớp hoàn toàn — xem chi tiết ở trên.';
	}
	if (choice.mode === 'bak') dropTempDb(database);
	if (error) fail(error);
	ok('Đã nhập dữ liệu và đối chiếu khớp');
}

async function setupDatabase(env) {
	const { Client } = require('pg');
	const dbName = env.DB_NAME;
	const appUser = env.DB_USER;
	let host = process.env.SETUP_DB_HOST || env.DB_HOST;
	if (host.toLowerCase() === 'host.docker.internal') host = 'localhost';
	const port = Number(env.DB_PORT) || 5432;
	const ssl = env.DB_SSL === 'true' ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false;

	step(2, `Kết nối PostgreSQL ${host}:${port}`);
	const superUser = process.env.PG_SUPER_USER || 'postgres';
	const superPassword =
		process.env.PG_SUPER_PASSWORD ?? (await askHidden(`    Mật khẩu superuser "${superUser}": `));
	const connect = async (database, user = superUser, password = superPassword) => {
		const c = new Client({ host, port, database, user, password, ssl, application_name: 'hrm-setup' });
		await c.connect();
		return c;
	};

	let admin;
	try {
		admin = await connect('postgres');
	} catch (err) {
		fail(
			`Không kết nối được PostgreSQL bằng "${superUser}": ${err.message}\n` +
				'   Kiểm tra service PostgreSQL đang chạy, DB_HOST/DB_PORT, mật khẩu superuser.',
		);
	}
	const { rows: ver } = await admin.query(`SELECT current_setting('server_version_num')::int AS v`);
	if (ver[0].v < 150000) fail('Cần PostgreSQL >= 15 (khuyến nghị 17 hoặc 18) để dùng collation ICU tiếng Việt.');
	ok(`Đã kết nối (PostgreSQL ${Math.floor(ver[0].v / 10000)})`);

	// ── Role + database ──
	step(3, 'Role và database');
	const roleExists = async (name) =>
		(await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name])).rowCount > 0;

	let ownerPassword = null;
	if (!(await roleExists(OWNER_ROLE))) {
		ownerPassword = randomSecret(16);
		await admin.query(`CREATE ROLE ${OWNER_ROLE} LOGIN PASSWORD ${quoteLiteral(ownerPassword)}`);
		ok(`Đã tạo role ${OWNER_ROLE}`);
	} else info(`Role ${OWNER_ROLE} đã có`);

	const appRoleExisted = await roleExists(appUser);
	if (!appRoleExisted) {
		await admin.query(`CREATE ROLE ${quoteIdent(appUser)} LOGIN PASSWORD ${quoteLiteral(env.DB_PASSWORD)}`);
		ok(`Đã tạo role ${appUser}`);
	} else info(`Role ${appUser} đã có`);

	const dbExists = (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])).rowCount > 0;
	if (!dbExists) {
		// UTF8 + ICU tiếng Việt: ORDER BY tên sắp đúng thứ tự a ă â ...
		await admin.query(
			`CREATE DATABASE ${quoteIdent(dbName)} OWNER ${OWNER_ROLE} ENCODING 'UTF8'
			 LOCALE_PROVIDER icu ICU_LOCALE 'vi-VN' TEMPLATE template0`,
		);
		ok(`Đã tạo database ${dbName}`);
	} else info(`Database ${dbName} đã có`);
	await admin.end();

	// ── Quyền (giống phần sau \connect của 000_roles_database.sql) ──
	const db = await connect(dbName);
	const app = quoteIdent(appUser);
	const dbIdent = quoteIdent(dbName);
	await db.query(`
		REVOKE ALL ON DATABASE ${dbIdent} FROM PUBLIC;
		GRANT CONNECT, TEMPORARY ON DATABASE ${dbIdent} TO ${app};
		ALTER SCHEMA public OWNER TO ${OWNER_ROLE};
		REVOKE CREATE ON SCHEMA public FROM PUBLIC;
		GRANT USAGE ON SCHEMA public TO ${app};
		ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER_ROLE} IN SCHEMA public
			GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${app};
		ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER_ROLE} IN SCHEMA public
			GRANT USAGE, SELECT ON SEQUENCES TO ${app};
		ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER_ROLE} IN SCHEMA public
			GRANT EXECUTE ON FUNCTIONS TO ${app};
		ALTER DATABASE ${dbIdent} SET timezone TO 'UTC';
	`);
	ok(`Đã cấp quyền cho ${appUser} (chỉ đọc/ghi dữ liệu)`);

	// ── Bảng, view, hàm — tạo dưới tên hrm_owner để hrm_owner sở hữu ──
	step(4, 'Bảng, view, hàm');
	await db.query(`SET ROLE ${OWNER_ROLE}`);
	const { rows: hasUsers } = await db.query(`SELECT to_regclass('public.users') IS NOT NULL AS ok`);
	if (!hasUsers[0].ok) {
		await runSqlFile(db, '001_init.sql');
		ok('Đã tạo bảng (001_init.sql)');
	} else info('Bảng đã có — bỏ qua 001_init.sql');
	await runSqlFile(db, '002_views_functions.sql');
	ok('Đã tạo/cập nhật view + hàm (002_views_functions.sql)');
	await runSqlFile(db, '003_password_change.sql');
	ok('Đã cập nhật cột đổi mật khẩu bắt buộc (003_password_change.sql)');
	await runSqlFile(db, '004_auth_rate_limits.sql');
	ok('Đã tạo bảng bộ đếm đăng nhập sai (004_auth_rate_limits.sql)');
	// Bảng tạo trước khi có ALTER DEFAULT PRIVILEGES (vd DB cũ) → cấp lại cho chắc.
	await db.query(`
		GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${app};
		GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${app};
		GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${app};
	`);

	// ── Dữ liệu: cài mới (danh mục mẫu) hoặc nhập từ SQL Server ──
	step(5, 'Dữ liệu');
	const counts = await dataCounts(db);
	const choice = await chooseDataMode(counts);
	if (choice.mode === 'fresh') {
		if (counts.roles === 0) {
			await runSqlFile(db, '010_seed_data.sql');
			const c = await dataCounts(db);
			ok(`Đã nạp danh mục: ${c.roles} vai trò, ${c.permissions} quyền, ${c.departments} khoa phòng + hệ số/cấu hình`);
		} else info(`Danh mục đã có (${counts.roles} vai trò, ${counts.departments} khoa phòng) — giữ nguyên`);
	} else if (choice.mode === 'bak' || choice.mode === 'mssql') {
		await db.query('RESET ROLE');
		importFromSqlServer(choice, { host, port, dbName, superUser, superPassword, ssl: env.DB_SSL });
		await db.query(`SET ROLE ${OWNER_ROLE}`);
	} else {
		info(`Database đã có dữ liệu (${counts.users} tài khoản, ${counts.departments} khoa phòng) — giữ nguyên.`);
		info('Muốn nạp lại: thêm --import-bak=<file> hoặc --import-mssql');
	}

	// ── Tài khoản quản trị (chỉ tạo khi chưa có admin nào đang hoạt động) ──
	step(6, 'Tài khoản quản trị');
	const adminPassword = await ensureAdmin(db);
	await db.query('RESET ROLE');

	// ── Kiểm tra bằng đúng tài khoản app sẽ dùng ──
	step(7, `Kiểm tra đăng nhập DB bằng ${appUser}`);
	let check;
	try {
		check = await connect(dbName, appUser, env.DB_PASSWORD);
	} catch (err) {
		if (!appRoleExisted || !/password/i.test(err.message)) throw err;
		// Role có sẵn từ trước với mật khẩu khác file env → đặt theo file env.
		warn(`Mật khẩu ${appUser} trong PostgreSQL khác DB_PASSWORD → đặt lại theo file env.`);
		warn(`File env khác (dev/production) cùng dùng ${appUser} phải có cùng DB_PASSWORD.`);
		await db.query(`ALTER ROLE ${app} PASSWORD ${quoteLiteral(env.DB_PASSWORD)}`);
		check = await connect(dbName, appUser, env.DB_PASSWORD);
	}
	await db.end();
	const { REQUIRED_RELATIONS } = require('../src/config/schemaCheck');
	const { rows: missing } = await check.query(
		`SELECT name FROM unnest($1::text[]) AS name WHERE to_regclass(name) IS NULL`,
		[REQUIRED_RELATIONS],
	);
	await check.query('SELECT 1 FROM users LIMIT 1');
	await check.end();
	if (missing.length) fail(`Thiếu bảng/view: ${missing.map((r) => r.name).join(', ')}`);
	ok(`Đủ ${REQUIRED_RELATIONS.length} bảng/view, ${appUser} đọc được dữ liệu`);

	return { ownerPassword, adminPassword };
}

// ── Docker ──────────────────────────────────────────────────────────────────

const COMPOSE = PROD ? ['compose', '-f', 'docker-compose.prod.yml'] : ['compose'];
const composeCmd = `docker ${COMPOSE.join(' ')}`;

// Cổng web: biến của compose đặt trong .env ở thư mục gốc (xem README).
function webUrl() {
	const rootEnvPath = path.join(ROOT_DIR, '.env');
	const rootEnv = fs.existsSync(rootEnvPath) ? parseEnv(fs.readFileSync(rootEnvPath, 'utf8')) : {};
	return PROD
		? `http://localhost:${rootEnv.WEB_PORT || 8080}`
		: `http://localhost:${rootEnv.DEV_WEB_PORT || 5174}`;
}

const docker = (dockerArgs, stdio = 'inherit') =>
	spawnSync('docker', dockerArgs, { cwd: ROOT_DIR, stdio }).status === 0;

// Trả về true nếu container đã chạy; lỗi thì chỉ cảnh báo (không thoát) để
// vẫn in được mật khẩu vừa tạo ở cuối.
function runDocker(env) {
	step(8, `Build + chạy Docker (${composeCmd})`);
	if (!docker(['compose', 'version'], 'ignore')) {
		warn('Không tìm thấy lệnh "docker compose" — cài Docker Desktop rồi chạy lại.');
		return false;
	}
	if (!docker(['info'], 'ignore')) {
		warn('Docker chưa chạy — mở Docker Desktop rồi chạy lại.');
		return false;
	}
	// --wait: chờ container chạy (production: chờ healthcheck /health của backend)
	if (!docker([...COMPOSE, 'up', '-d', '--build', '--wait', '--wait-timeout', '300'])) {
		warn('Container chưa lên được. Log backend gần nhất:');
		docker([...COMPOSE, 'logs', '--tail', '30', 'backend']);
		warn('Lỗi kết nối DB từ container thường do PostgreSQL chưa nhận kết nối từ mạng Docker');
		warn('(listen_addresses, pg_hba.conf) — xem server/db/README.md mục "Backend chạy trong Docker".');
		return false;
	}
	ok(`Đã chạy — ${webUrl()}`);
	if (PROD && env.COOKIE_SECURE === 'true')
		info('COOKIE_SECURE=true: chỉ đăng nhập được qua HTTPS (proxy), không qua http://localhost.');
	return true;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
	const major = Number(process.versions.node.split('.')[0]);
	if (major < 22) fail(`Cần Node.js >= 22 (đang dùng ${process.versions.node}).`);

	console.log(`🏥 Hospital HRM — cài đặt (${PROD ? 'production' : 'dev'}${DOCKER ? ', Docker' : ''})`);
	const { env, envName } = prepareEnvFile();

	let secrets = {};
	if (SKIP_DB) console.log('\n--skip-db: bỏ qua bước PostgreSQL');
	else secrets = await setupDatabase(env);

	const dockerOk = DOCKER ? runDocker(env) : null;

	console.log('\n════════════════════════════════════════════════════════════');
	console.log(dockerOk === false ? '⚠️  Cài đặt xong, nhưng Docker chưa chạy được (xem ở trên).' : '✅ Cài đặt xong.');
	if (secrets.ownerPassword || secrets.adminPassword) {
		console.log('\n🔑 LƯU LẠI NGAY — chỉ hiện 1 lần, không ghi vào file nào:');
		if (secrets.ownerPassword)
			console.log(`   Role ${OWNER_ROLE} (chạy migration/backup): ${secrets.ownerPassword}`);
		if (secrets.adminPassword) {
			console.log(`   Đăng nhập web: ${ADMIN_USER} / ${secrets.adminPassword}`);
			console.log('   → Đổi mật khẩu và bật xác thực 2 lớp sau lần đăng nhập đầu.');
		}
	}
	console.log('\nBước tiếp theo:');
	if (dockerOk) {
		console.log(`   Mở ${webUrl()}`);
		console.log(`   Xem log:  ${composeCmd} logs -f backend`);
		console.log(`   Dừng:     ${composeCmd} down`);
	} else if (PROD || DOCKER) {
		console.log(`   ${composeCmd} up -d --build`);
		console.log('   (PostgreSQL phải nhận kết nối từ Docker — xem server/db/README.md)');
	} else {
		console.log('   npm run dev     → http://localhost:5173');
	}
	console.log(`   Cấu hình: server/${envName}`);
	if (dockerOk === false) process.exitCode = 1;
}

main().catch((err) => fail(err.message));
