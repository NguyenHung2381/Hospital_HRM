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
//   --import-bak=<file>  nhập dữ liệu từ file backup SQL Server (.bak), không hỏi.
//                        Đưa thư mục thay vì file → lấy file .bak mới nhất trong đó.
//   --bak-via=docker|local  cách khôi phục .bak (mặc định tự chọn: SQL Server trên
//                        máy này nếu có, không thì SQL Server tạm trong Docker)
//   --import-mssql[=<db>] nhập từ database SQL Server đang chạy (mặc định HRM_HOSPITAL)
//   --yes                đồng ý xoá dữ liệu PostgreSQL đang có khi nhập lại (không hỏi)
//   --skip-db            chỉ tạo file env, không đụng tới PostgreSQL
//   --admin-user=<tên>   tên đăng nhập admin đầu tiên (mặc định: admin)
//   --pg-user=<tên>      superuser PostgreSQL dùng để cài (mặc định: postgres)
//
// Mật khẩu: script hỏi mật khẩu superuser PostgreSQL (gõ hiện dấu *, sai thì
// cho nhập lại tối đa 3 lần). File env chưa có DB_PASSWORD → hỏi mật khẩu cho
// role hrm_app (Enter = sinh ngẫu nhiên).
//
// Khôi phục .bak cần SQL Server. Máy không cài SQL Server (vd máy chủ mới chỉ có
// PostgreSQL) → script chạy SQL Server Express (bản mới nhất) tạm trong Docker
// (mcr.microsoft.com/mssql/server, cần Docker Desktop ≥ 2 GB RAM), chép file
// .bak vào, chuyển dữ liệu rồi xoá container. SQL Server trên máy báo không đọc
// được file / file từ bản SQL Server mới hơn → tự thử lại bằng Docker.
//
// Nhập từ SQL Server đang chạy cần sqlcmd; MSSQL_SERVER (mặc định localhost\SQLEXPRESS),
// MSSQL_USER / MSSQL_PASSWORD (trống = Windows Authentication).
//
// Biến môi trường (không bắt buộc):
//   PG_SUPER_USER        superuser PostgreSQL (mặc định: postgres; --pg-user ưu tiên hơn)
//   PG_SUPER_PASSWORD    mật khẩu superuser — không đặt thì script hỏi
//   SETUP_DB_HOST        host PostgreSQL nhìn từ máy chạy script (mặc định lấy
//                        DB_HOST; host.docker.internal → localhost)
//   MSSQL_DOCKER_IMAGE   image SQL Server dùng khôi phục .bak
//                        (mặc định mcr.microsoft.com/mssql/server:2025-latest;
//                        backup từ SQL Server quá cũ → đổi sang :2022-latest)
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
const BAK_VIA = argValue('--bak-via');
if (BAK_VIA !== null && !['docker', 'local'].includes(BAK_VIA)) {
	console.error('❌ --bak-via chỉ nhận docker hoặc local');
	process.exit(1);
}
const ADMIN_USER = (args.find((a) => a.startsWith('--admin-user=')) || '--admin-user=admin').split('=')[1];
const PG_USER_ARG = argValue('--pg-user');

const OWNER_ROLE = 'hrm_owner';
const ADMIN_ROLE_NAME = 'Quản trị hệ thống';
const MSSQL_IMAGE = process.env.MSSQL_DOCKER_IMAGE || 'mcr.microsoft.com/mssql/server:2025-latest';

// Dọn dẹp (database / container SQL Server tạm) — chạy cả khi fail() thoát giữa chừng
// hoặc người dùng bấm Ctrl+C.
const cleanups = [];
function runCleanups() {
	while (cleanups.length) {
		try {
			cleanups.pop()();
		} catch {
			// dọn dẹp lỗi thì bỏ qua — đã báo trong từng hàm
		}
	}
}
process.on('exit', runCleanups);
process.on('SIGINT', () => {
	console.log('\nĐã huỷ.');
	process.exit(130);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const timestamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);

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

// Hỏi mật khẩu cho role ứng dụng (hrm_app). Enter bỏ trống / không có terminal → null (sinh ngẫu nhiên).
async function askAppPassword(user) {
	if (!process.stdin.isTTY) return null;
	info(`Đặt mật khẩu PostgreSQL cho role ${user} (app dùng để kết nối DB) — Enter để tự sinh ngẫu nhiên`);
	for (;;) {
		const first = await askPassword(`    Mật khẩu ${user}: `);
		if (!first) return null;
		if (first.length < 12) {
			warn('Mật khẩu tối thiểu 12 ký tự.');
			continue;
		}
		// Ghi vào file env trong dấu nháy đơn → không dùng được nháy đơn bên trong
		if (/['\r\n]/.test(first)) {
			warn("Mật khẩu không được chứa dấu nháy đơn (').");
			continue;
		}
		if ((await askPassword('    Nhập lại để xác nhận: ')) === first) return first;
		warn('Hai lần nhập không khớp — nhập lại.');
	}
}

async function prepareEnvFile() {
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
		const appUser = env.DB_USER || 'hrm_app';
		const chosen = await askAppPassword(appUser);
		// Nháy đơn: dotenv và docker compose (env_file) đọc nguyên văn, không hiểu # hay $ bên trong
		text = setEnv(text, 'DB_PASSWORD', chosen ? `'${chosen}'` : randomSecret(24));
		ok(chosen ? `Đã lưu mật khẩu ${appUser} vừa nhập (DB_PASSWORD)` : `Đã sinh mật khẩu DB cho ${appUser} (DB_PASSWORD)`);
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

// Nhập mật khẩu: mỗi ký tự hiện 1 dấu * (để biết bàn phím đang nhận), Backspace
// xoá được, dán (Ctrl+V / chuột phải) được. Không có terminal thật (vd Git Bash
// mintty không qua winpty) → đọc cả dòng bình thường, chữ sẽ hiện ra màn hình.
function askPassword(question) {
	const stdin = process.stdin;
	if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
		warn('Terminal không hỗ trợ nhập ẩn — mật khẩu sẽ hiện khi gõ.');
		return new Promise((resolve) => {
			const rl = readline.createInterface({ input: stdin, output: process.stdout });
			rl.question(question, (answer) => {
				rl.close();
				resolve(answer);
			});
		});
	}
	return new Promise((resolve) => {
		process.stdout.write(question);
		let chars = [];
		const wasRaw = stdin.isRaw;
		const finish = () => {
			stdin.removeListener('data', onData);
			stdin.setRawMode(wasRaw);
			stdin.pause();
			process.stdout.write('\n');
		};
		const onData = (chunk) => {
			for (const ch of String(chunk)) {
				if (ch === '\r' || ch === '\n') {
					finish();
					return resolve(chars.join(''));
				}
				if (ch === '\u0003') {
					// Ctrl+C
					finish();
					process.emit('SIGINT');
					return;
				}
				if (ch === '\u001b') return; // phím mũi tên, F1... → bỏ cả chuỗi điều khiển
				if (ch === '\b' || ch === '\u007f') {
					if (chars.length) {
						chars.pop();
						process.stdout.write('\b \b');
					}
				} else if (ch === '\u0015') {
					// Ctrl+U: xoá hết
					process.stdout.write('\b \b'.repeat(chars.length));
					chars = [];
				} else if (ch >= ' ') {
					chars.push(ch);
					process.stdout.write('*');
				}
			}
		};
		stdin.setEncoding('utf8');
		stdin.setRawMode(true);
		stdin.resume();
		stdin.on('data', onData);
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
		console.log('      2) Nhập dữ liệu từ file backup SQL Server cũ (.bak) — máy này không cần cài SQL Server');
		console.log(`      3) Nhập dữ liệu từ database SQL Server đang chạy trên ${server}`);
		const pick = (await ask('    Chọn [1]: ')) || '1';
		if (pick === '2') {
			info('Gõ hoặc kéo thả file .bak vào đây. Đưa thư mục → chọn trong các file .bak của thư mục đó.');
			const bak = await ask('    Đường dẫn file .bak / thư mục: ');
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
const BAK_DIR_IN_CONTAINER = '/var/opt/mssql/backup';

const formatSize = (bytes) =>
	bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;

const hasLocalSqlcmd = () => !spawnSync('sqlcmd', ['-?'], { stdio: 'ignore', windowsHide: true }).error;
const dockerReady = () => docker(['info'], 'ignore');

// Đường dẫn gõ / kéo thả vào terminal: bỏ dấu nháy và "& '...'" (PowerShell thêm khi
// kéo thả). npm chạy script ở thư mục gốc repo → đường dẫn tương đối tính theo nơi gõ lệnh.
function cleanPath(input) {
	const s = input.trim().replace(/^&\s*/, '').replace(/^["']|["']$/g, '');
	return path.resolve(process.env.INIT_CWD || process.cwd(), s);
}

// File → giữ nguyên. Thư mục → liệt kê các file .bak (mới nhất trước) cho chọn;
// không hỏi được (--import-bak, không có terminal) → lấy file mới nhất.
async function resolveBakFile(input) {
	const p = cleanPath(input);
	let stat = null;
	try {
		stat = fs.statSync(p);
	} catch {
		// Không thấy: có thể file nằm trong thư mục chỉ dịch vụ SQL Server đọc được
	}
	if (!stat?.isDirectory()) return p;

	const list = fs
		.readdirSync(p, { withFileTypes: true })
		.filter((d) => d.isFile() && /\.bak$/i.test(d.name))
		.map((d) => {
			const full = path.join(p, d.name);
			const st = fs.statSync(full);
			return { full, name: d.name, size: st.size, mtime: st.mtime };
		})
		.sort((a, b) => b.mtime - a.mtime);
	if (!list.length) fail(`Thư mục ${p} không có file .bak nào.`);
	if (list.length === 1 || BAK_ARG || !process.stdin.isTTY) {
		info(`Lấy file .bak mới nhất trong thư mục: ${list[0].name}`);
		return list[0].full;
	}
	const shown = list.slice(0, 20);
	console.log(`    Thư mục có ${list.length} file .bak (mới nhất trước):`);
	shown.forEach((f, i) =>
		console.log(`      ${i + 1}) ${f.name}  —  ${formatSize(f.size)}, ${f.mtime.toLocaleString('vi-VN')}`),
	);
	const pick = Number((await ask('    Chọn file [1]: ')) || '1');
	if (!Number.isInteger(pick) || pick < 1 || pick > shown.length) fail(`Lựa chọn không hợp lệ: ${pick}`);
	return shown[pick - 1].full;
}

// Gắn loại lỗi để quyết định có thử lại bằng Docker không.
function bakError(prefix, err) {
	const e = new Error(`${prefix}: ${err.message}`);
	if (/Operating system error 5|Access is denied/i.test(err.message)) e.kind = 'access';
	else if (/Operating system error (2|3)\b/i.test(err.message)) e.kind = 'missing';
	else if (/version/i.test(err.message) && /backed up/i.test(err.message)) {
		e.kind = 'version';
		// "...backed up on a server running version 16.00... this server, which is running version 15.00..."
		const v = err.message.match(/running version (\d+)[\s\S]*running version (\d+)/i);
		e.newer = v ? Number(v[1]) > Number(v[2]) : true;
	} else if (/incorrectly formed|not a valid|media family|damaged|terminating abnormally/i.test(err.message))
		e.kind = 'corrupt';
	return e;
}

function explainBakError(err, bak, inDocker) {
	const why = {
		missing: `Không có file ${bak} trên máy chạy SQL Server.`,
		access: inDocker
			? 'SQL Server trong container không đọc được file.'
			: 'Dịch vụ SQL Server không đọc được file. Mở Docker Desktop rồi chạy lại với --bak-via=docker,\n' +
				'     hoặc chép file .bak vào thư mục Backup của SQL Server (vd ...\\MSSQL\\Backup) /\n' +
				'     cấp quyền đọc cho NT Service\\MSSQL$SQLEXPRESS.',
		version: !err.newer
			? `File được tạo từ SQL Server quá cũ so với ${inDocker ? `image ${MSSQL_IMAGE}` : 'máy này'} — ` +
				'đặt MSSQL_DOCKER_IMAGE=mcr.microsoft.com/mssql/server:2022-latest rồi chạy lại với --bak-via=docker.'
			: inDocker
				? `File được tạo từ SQL Server mới hơn image ${MSSQL_IMAGE} — đặt MSSQL_DOCKER_IMAGE sang bản mới hơn rồi chạy lại.`
				: 'File được tạo từ SQL Server mới hơn máy này — mở Docker Desktop rồi chạy lại với --bak-via=docker.',
		corrupt: 'File không phải backup SQL Server hợp lệ hoặc bị hỏng khi chép — chép lại file từ máy cũ.',
	}[err.kind];
	return why ? `${err.message}\n   → ${why}` : err.message;
}

// Khôi phục file .bak (đường dẫn nhìn từ SQL Server) thành database tạm
// HRM_IMPORT_<thời gian>. Trả về tên database tạm; lỗi → throw (kèm err.kind).
function restoreBak(disk, { inDocker }) {
	const { mssqlTable, mssqlExec } = require('./lib/migrationCommon');
	let headers;
	try {
		headers = mssqlTable(`RESTORE HEADERONLY FROM DISK = ${mssqlLiteral(disk)}`);
	} catch (err) {
		throw bakError('Không đọc được file backup', err);
	}
	// BackupType 1 = full database; 1 file có thể chứa nhiều bản → lấy bản mới nhất
	const full = headers.filter((h) => h.BackupType === '1');
	if (!full.length) fail('File .bak không chứa bản backup đầy đủ (full) nào.');
	const last = full.reduce((a, b) => (Number(b.Position) > Number(a.Position) ? b : a));
	info(`Bản backup: database ${last.DatabaseName}, lúc ${last.BackupFinishDate}`);

	const position = Number(last.Position);
	const files = mssqlTable(`RESTORE FILELISTONLY FROM DISK = ${mssqlLiteral(disk)} WITH FILE = ${position}`);
	const [dirs] = mssqlTable(`SELECT
		CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400)) AS data_dir,
		CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(400)) AS log_dir`);
	const tempDb = `HRM_IMPORT_${timestamp()}`;
	const join = inDocker ? path.posix.join : path.win32.join;
	const moves = files.map((f, i) => {
		const ext = f.Type === 'L' ? '.ldf' : f.Type === 'D' ? (i === 0 ? '.mdf' : '.ndf') : '';
		const dir = f.Type === 'L' ? dirs.log_dir : dirs.data_dir;
		return `MOVE ${mssqlLiteral(f.LogicalName)} TO ${mssqlLiteral(join(dir, `${tempDb}_${i}${ext}`))}`;
	});
	info(`Đang khôi phục vào database tạm ${tempDb}...`);
	try {
		mssqlExec(
			`RESTORE DATABASE ${mssqlIdent(tempDb)} FROM DISK = ${mssqlLiteral(disk)}
			 WITH FILE = ${position}, ${moves.join(', ')}, RECOVERY`,
		);
	} catch (err) {
		if (!inDocker) dropTempDb(tempDb); // container thì xoá cả container sau
		throw bakError('Khôi phục .bak thất bại', err);
	}
	// Trong Docker: xoá container là xoá luôn database tạm
	if (!inDocker) cleanups.push(() => dropTempDb(tempDb));
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

// SQL Server Express tạm trong Docker — chỉ để đọc file .bak, không mở cổng ra
// ngoài (sqlcmd chạy bên trong container), mật khẩu sa ngẫu nhiên truyền qua biến
// môi trường. Xoá container (kèm dữ liệu) khi xong hoặc khi script dừng giữa chừng.
async function startMssqlContainer() {
	if (!dockerReady()) fail('Docker chưa chạy — mở Docker Desktop rồi chạy lại.');
	const name = `hrm-bak-import-${timestamp().replace('_', '-')}`;
	// Đủ 4 loại ký tự theo chính sách mật khẩu của SQL Server
	const saPassword = `Hrm#${randomSecret(12)}Aa1`;

	if (!docker(['image', 'inspect', MSSQL_IMAGE], 'ignore')) {
		info(`Tải image ${MSSQL_IMAGE} (~650 MB, chỉ lần đầu)...`);
		if (!docker(['pull', MSSQL_IMAGE])) fail('Không tải được image SQL Server — kiểm tra mạng Internet / Docker Desktop.');
	}
	info('Khởi động SQL Server tạm trong Docker...');
	const started = spawnSync(
		'docker',
		['run', '-d', '--name', name, '-e', 'ACCEPT_EULA=Y', '-e', 'MSSQL_PID=Express', '-e', 'MSSQL_SA_PASSWORD', MSSQL_IMAGE],
		{ cwd: ROOT_DIR, env: { ...process.env, MSSQL_SA_PASSWORD: saPassword }, encoding: 'utf8', windowsHide: true },
	);
	if (started.status !== 0) fail(`Không chạy được container SQL Server: ${(started.stderr || '').trim()}`);
	cleanups.push(() => {
		spawnSync('docker', ['rm', '-f', '-v', name], { stdio: 'ignore', windowsHide: true });
		info(`Đã xoá container SQL Server tạm ${name}`);
	});

	const running = () =>
		(spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', name], { encoding: 'utf8', windowsHide: true }).stdout || '').trim() ===
		'true';
	const { mssqlPing } = require('./lib/migrationCommon');
	const deadline = Date.now() + 180_000;
	let sqlcmd = null;
	for (;;) {
		if (!running()) {
			warn('SQL Server trong container đã dừng. Log gần nhất:');
			docker(['logs', '--tail', '20', name]);
			fail('Không chạy được SQL Server trong Docker (thường do Docker Desktop cấp < 2 GB RAM — Settings → Resources).');
		}
		// Image mới: mssql-tools18; image cũ: mssql-tools
		sqlcmd ??= ['/opt/mssql-tools18/bin/sqlcmd', '/opt/mssql-tools/bin/sqlcmd'].find((p) =>
			docker(['exec', name, 'test', '-x', p], 'ignore'),
		);
		if (sqlcmd) {
			Object.assign(process.env, {
				MSSQL_DOCKER_CONTAINER: name,
				MSSQL_DOCKER_SQLCMD: sqlcmd,
				MSSQL_SERVER: 'localhost',
				MSSQL_USER: 'sa',
				MSSQL_PASSWORD: saPassword,
			});
			if (mssqlPing(2)) break;
		}
		if (Date.now() > deadline)
			fail(sqlcmd ? 'SQL Server trong container chưa sẵn sàng sau 3 phút.' : `Image ${MSSQL_IMAGE} không có sqlcmd.`);
		await sleep(3000);
	}
	ok(`SQL Server tạm đã sẵn sàng (container ${name})`);
	return name;
}

// Chép file .bak vào container (đọc bằng tài khoản Windows đang chạy script).
function copyBakIntoContainer(name, bak) {
	if (!fs.existsSync(bak)) fail(`Không thấy file ${bak} (hoặc tài khoản Windows hiện tại không có quyền đọc).`);
	const dest = `${BAK_DIR_IN_CONTAINER}/import.bak`;
	docker(['exec', '-u', '0', name, 'mkdir', '-p', BAK_DIR_IN_CONTAINER], 'ignore');
	info(`Chép ${path.basename(bak)} (${formatSize(fs.statSync(bak).size)}) vào container...`);
	if (!docker(['cp', bak, `${name}:${dest}`], 'ignore')) fail('Không chép được file .bak vào container.');
	// docker cp giữ chủ sở hữu root → cho user mssql trong container đọc được
	docker(['exec', '-u', '0', name, 'chmod', '-R', 'a+rX', BAK_DIR_IN_CONTAINER], 'ignore');
	return dest;
}

// Khôi phục .bak: SQL Server trên máy này (nếu có) hoặc SQL Server tạm trong Docker.
async function restoreBakFile(input) {
	const bak = await resolveBakFile(input);
	info(`File: ${bak}`);

	let via = BAK_VIA;
	if (!via) {
		if (hasLocalSqlcmd() && require('./lib/migrationCommon').mssqlPing(5)) via = 'local';
		else if (dockerReady()) {
			via = 'docker';
			info('Máy này không có SQL Server → dùng SQL Server tạm trong Docker');
		} else
			fail(
				'Cần SQL Server để đọc file .bak, máy này không có. Chọn 1 trong 2:\n' +
					'   • Cài Docker Desktop và mở lên (khuyến nghị) — script tự chạy SQL Server tạm trong container rồi xoá.\n' +
					'   • Cài SQL Server Express + sqlcmd. SQL Server ở máy khác / SQL login: đặt MSSQL_SERVER, MSSQL_USER, MSSQL_PASSWORD.',
			);
	}

	if (via === 'local') {
		if (!hasLocalSqlcmd()) fail('Không tìm thấy sqlcmd — cài SQL Server / sqlcmd, hoặc dùng --bak-via=docker.');
		info(`Khôi phục trên SQL Server ${process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS'}`);
		// File do dịch vụ SQL Server đọc, không phải tài khoản đang chạy script — thư mục
		// Backup của SQL Server thường không mở được với user thường nhưng SQL Server vẫn đọc được.
		if (!fs.existsSync(bak)) info('Tài khoản hiện tại không thấy file — để SQL Server tự đọc');
		try {
			return restoreBak(bak, { inDocker: false });
		} catch (err) {
			const retry =
				!BAK_VIA && (err.kind === 'access' || (err.kind === 'version' && err.newer)) && fs.existsSync(bak) && dockerReady();
			if (!retry) fail(explainBakError(err, bak, false));
			warn(err.kind === 'access' ? 'SQL Server trên máy không đọc được file.' : 'File từ bản SQL Server mới hơn máy này.');
			warn('Thử lại bằng SQL Server tạm trong Docker...');
		}
	}

	const container = await startMssqlContainer();
	const disk = copyBakIntoContainer(container, bak);
	try {
		return restoreBak(disk, { inDocker: true });
	} catch (err) {
		fail(explainBakError(err, bak, true));
	}
}

// Chuyển dữ liệu bằng 2 script có sẵn (migrate-from-mssql.js --truncate rồi
// verify-migration.js), ghi PostgreSQL bằng superuser vừa nhập.
async function importFromSqlServer(choice, pg) {
	let database;
	if (choice.mode === 'bak') database = await restoreBakFile(choice.bak);
	else {
		if (!hasLocalSqlcmd()) fail('Không tìm thấy sqlcmd — cài SQL Server Management Studio / sqlcmd rồi chạy lại.');
		database = choice.database;
	}
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

	let error = null;
	info(`Chuyển dữ liệu từ SQL Server ${database} (xoá dữ liệu PostgreSQL cũ trước khi nạp)...`);
	if (!run('migrate-from-mssql.js', ['--truncate'])) {
		error = 'Chuyển dữ liệu thất bại — PostgreSQL không bị thay đổi.';
	} else {
		info('Đối chiếu từng ô dữ liệu giữa 2 database...');
		if (!run('verify-migration.js')) error = 'Dữ liệu sau khi chuyển chưa khớp hoàn toàn — xem chi tiết ở trên.';
	}
	runCleanups(); // xoá database / container tạm ngay, không đợi hết script
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
	const superUser = PG_USER_ARG || process.env.PG_SUPER_USER || 'postgres';
	let superPassword = process.env.PG_SUPER_PASSWORD;
	// Mật khẩu lấy từ biến môi trường mà sai → báo lỗi luôn, không hỏi lại
	const canRetry = superPassword === undefined && process.stdin.isTTY;
	const connect = async (database, user = superUser, password = superPassword) => {
		const c = new Client({ host, port, database, user, password, ssl, application_name: 'hrm-setup' });
		await c.connect();
		return c;
	};

	const MAX_TRIES = 3;
	let admin;
	for (let attempt = 1; !admin; attempt++) {
		if (superPassword === undefined) {
			if (!process.stdin.isTTY)
				fail('Không có terminal để nhập mật khẩu PostgreSQL — đặt biến PG_SUPER_PASSWORD rồi chạy lại.');
			superPassword = await askPassword(`    Mật khẩu superuser "${superUser}" (đặt lúc cài PostgreSQL): `);
		}
		try {
			admin = await connect('postgres');
		} catch (err) {
			// 28P01: sai mật khẩu; SASL: mật khẩu rỗng với scram-sha-256
			const badPassword = err.code === '28P01' || /SASL|password must be/i.test(err.message);
			if (badPassword && canRetry && attempt < MAX_TRIES) {
				warn(`Sai mật khẩu "${superUser}" (lần ${attempt}/${MAX_TRIES}) — nhập lại.`);
				superPassword = undefined;
				continue;
			}
			let hint = '   Kiểm tra service PostgreSQL đang chạy, DB_HOST/DB_PORT, mật khẩu superuser.';
			if (badPassword)
				hint =
					`   Sai mật khẩu "${superUser}" — là mật khẩu đặt lúc cài PostgreSQL. Superuser tên khác: thêm --pg-user=<tên>.\n` +
					'   Quên mật khẩu: xem server/db/README.md, mục "Quên mật khẩu superuser postgres".';
			else if (err.code === '28000' || /role .* does not exist/i.test(err.message))
				hint = `   Không có role "${superUser}" — thêm --pg-user=<tên superuser> (hoặc đặt PG_SUPER_USER).`;
			else if (err.code === 'ECONNREFUSED')
				hint = `   PostgreSQL không nhận kết nối ở ${host}:${port} — service chưa chạy (Get-Service postgresql*) hoặc sai DB_HOST/DB_PORT.`;
			fail(`Không kết nối được PostgreSQL bằng "${superUser}": ${err.message}\n${hint}`);
		}
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
		await importFromSqlServer(choice, { host, port, dbName, superUser, superPassword, ssl: env.DB_SSL });
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
		? `http://localhost:${rootEnv.WEB_PORT || 8081}`
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
	const { env, envName } = await prepareEnvFile();

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
