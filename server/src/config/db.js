const { Pool, types } = require('pg');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Lớp truy cập PostgreSQL (node-postgres) — GIỮ NGUYÊN API kiểu `mssql` mà code
// đang dùng, để controller/service không phải viết lại phần JS:
//
//   const pool = await getPool();
//   const r = await pool.request()
//     .input('id', sql.Int, id)
//     .query('SELECT * FROM users WHERE id_user = @id');
//   r.recordset / r.recordsets / r.rowsAffected
//
//   const tx = new sql.Transaction(pool);
//   await tx.begin();  tx.request()...  await tx.commit() / tx.rollback();
//
// Tham số @ten được đổi thành $1, $2... (bỏ qua chuỗi '...', "...", comment) và
// ép kiểu theo sql.Type đã khai (vd $1::integer) — tránh lỗi "could not
// determine data type of parameter" ở các mẫu như (@x IS NULL OR col = @x).
// Chỉ thay những @ten đã .input(); @@... và @biến T-SQL khác giữ nguyên.
// ─────────────────────────────────────────────────────────────────────────────

// ── Kiểu dữ liệu trả về: giữ giống driver mssql cũ ──────────────────────────
// numeric/decimal: pg mặc định trả chuỗi → đổi sang number như mssql.
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : parseFloat(v)));
// bigint (gồm COUNT(*), SUM(int)): pg mặc định trả chuỗi → number khi an toàn.
types.setTypeParser(types.builtins.INT8, (v) => {
	if (v === null) return null;
	const n = Number(v);
	return Number.isSafeInteger(n) ? n : v;
});
// date: mssql (useUTC) trả Date lúc 00:00 UTC; pg mặc định lấy 00:00 giờ máy
// → lệch ngày khi TZ=Asia/Ho_Chi_Minh. Giữ đúng hành vi cũ.
types.setTypeParser(types.builtins.DATE, (v) => (v === null ? null : new Date(`${v}T00:00:00Z`)));

// ── Ép giá trị tham số giống driver cũ (tedious) ────────────────────────────
// Int/SmallInt/TinyInt: Number() rồi CẮT phần thập phân (7.6 → 7, '' → 0),
// ngoài khoảng / không phải số → TypeError trước khi gửi DB. Không làm vậy thì
// PostgreSQL làm tròn (7.6 → 8) hoặc báo lỗi cú pháp.
function intCoercer(min, max) {
	return (value) => {
		const n = typeof value === 'number' ? value : Number(value);
		if (Number.isNaN(n)) throw new TypeError('Invalid number.');
		if (n < min || n > max)
			throw new TypeError(`Value must be between ${min} and ${max}, inclusive.`);
		return Math.trunc(n);
	};
}
const COERCE = {
	Int: intCoercer(-2147483648, 2147483647),
	SmallInt: intCoercer(-32768, 32767),
	TinyInt: intCoercer(0, 255),
	BigInt: intCoercer(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
	// Bit: mọi giá trị truthy → true (1, '1', true...), falsy → false
	Bit: (value) => !!value,
};
// BigInt: chuỗi toàn chữ số giữ nguyên (không mất chính xác khi > 2^53)
const coerceBigIntNumber = COERCE.BigInt;
COERCE.BigInt = (value) =>
	typeof value === 'string' && /^-?\d+$/.test(value) ? value : coerceBigIntNumber(value);

// ── sql.Type: gọi được cả dạng sql.Int lẫn sql.NVarChar(50) / sql.Decimal(5, 4) ─
function makeType(name, pgType) {
	const t = () => t;
	Object.defineProperties(t, {
		typeName: { value: name },
		pgType: { value: pgType },
		coerce: { value: COERCE[name] || null },
	});
	return t;
}

const sql = {
	MAX: -1,
	Int: makeType('Int', 'integer'),
	SmallInt: makeType('SmallInt', 'smallint'),
	TinyInt: makeType('TinyInt', 'smallint'),
	// BigInt: giữ chuỗi chữ số dài (vd cursor id) nguyên vẹn, chỉ ép khi là number lẻ
	BigInt: makeType('BigInt', 'bigint'),
	Bit: makeType('Bit', 'boolean'),
	Decimal: makeType('Decimal', 'numeric'),
	Numeric: makeType('Numeric', 'numeric'),
	Float: makeType('Float', 'double precision'),
	Real: makeType('Real', 'real'),
	// varchar ↔ text tương thích nhị phân nên index trên cột varchar vẫn dùng được.
	// Cột có collation không phân biệt hoa thường (username, code_department)
	// vẫn so sánh theo collation của cột.
	NVarChar: makeType('NVarChar', 'text'),
	VarChar: makeType('VarChar', 'text'),
	Text: makeType('Text', 'text'),
	NText: makeType('NText', 'text'),
	// char(n) (jti, device_id) → bpchar để so sánh/index như cột char.
	Char: makeType('Char', 'bpchar'),
	NChar: makeType('NChar', 'bpchar'),
	Date: makeType('Date', 'date'),
	DateTime: makeType('DateTime', 'timestamptz'),
	DateTime2: makeType('DateTime2', 'timestamptz'),
	DateTimeOffset: makeType('DateTimeOffset', 'timestamptz'),
	UniqueIdentifier: makeType('UniqueIdentifier', 'uuid'),
};

// ── Đổi @ten → $n::kiểu ─────────────────────────────────────────────────────
const IDENT_CHAR = /[A-Za-z0-9_]/;

function compile(text, params) {
	const values = [];
	const indexOf = new Map();
	let out = '';
	let i = 0;
	const n = text.length;

	const copyUntil = (end) => {
		const j = text.indexOf(end, i);
		const stop = j === -1 ? n : j + end.length;
		out += text.slice(i, stop);
		i = stop;
	};

	while (i < n) {
		const ch = text[i];
		const next = text[i + 1];

		if (ch === "'") {
			// '...' với '' là dấu nháy thoát
			let j = i + 1;
			while (j < n) {
				if (text[j] === "'") {
					if (text[j + 1] === "'") j += 2;
					else break;
				} else j += 1;
			}
			out += text.slice(i, j + 1);
			i = j + 1;
		} else if (ch === '"') {
			i += 1;
			out += '"';
			copyUntil('"');
		} else if (ch === '-' && next === '-') {
			copyUntil('\n');
		} else if (ch === '/' && next === '*') {
			copyUntil('*/');
		} else if (ch === '@' && next === '@') {
			out += '@@';
			i += 2;
		} else if (ch === '@' && next && IDENT_CHAR.test(next) && !IDENT_CHAR.test(text[i - 1] || '')) {
			let j = i + 1;
			while (j < n && IDENT_CHAR.test(text[j])) j += 1;
			const name = text.slice(i + 1, j);
			const param = params.get(name);
			if (param) {
				let idx = indexOf.get(name);
				if (idx === undefined) {
					values.push(param.value === undefined ? null : param.value);
					idx = values.length;
					indexOf.set(name, idx);
				}
				out += param.pgType ? `$${idx}::${param.pgType}` : `$${idx}`;
			} else {
				out += text.slice(i, j);
			}
			i = j;
		} else {
			out += ch;
			i += 1;
		}
	}
	return { text: out, values };
}

// Giống mssql: recordsets chỉ gồm các câu trả về dòng (SELECT, ... RETURNING);
// recordset = tập đầu tiên trong số đó; rowsAffected = số dòng từng câu.
function toResult(res) {
	const list = Array.isArray(res) ? res : [res];
	const recordsets = list.filter((r) => r.fields && r.fields.length).map((r) => r.rows);
	return {
		recordset: recordsets[0] || [],
		recordsets,
		rowsAffected: list.map((r) => r.rowCount ?? 0),
		rowCount: list.reduce((s, r) => s + (r.rowCount ?? 0), 0),
	};
}

class Request {
	constructor(runner) {
		this._runner = runner; // pg.Pool hoặc pg.Client (trong transaction)
		this._params = new Map();
	}

	input(name, type, value) {
		if (arguments.length === 2) {
			value = type;
			type = null;
		}
		const key = String(name).replace(/^@/, '');
		if (value != null && type?.coerce) value = type.coerce(value);
		this._params.set(key, { value, pgType: type?.pgType ?? null });
		return this;
	}

	async query(text) {
		const compiled = compile(text, this._params);
		const res = await this._runner.query(compiled.text, compiled.values);
		return toResult(res);
	}

	// Chạy nhiều câu lệnh không tham số trong 1 lần gọi (simple query protocol).
	async batch(text) {
		if (this._params.size) throw new Error('batch() không nhận tham số — dùng query()');
		return toResult(await this._runner.query(text));
	}
}

class Transaction {
	constructor(pool) {
		if (!pool || !pool.pg) throw new Error('new sql.Transaction(pool): pool phải lấy từ getPool()');
		this._pool = pool.pg;
		this._client = null;
	}

	async begin() {
		if (this._client) throw new Error('Transaction đã bắt đầu');
		const client = await this._pool.connect();
		try {
			await client.query('BEGIN');
		} catch (err) {
			client.release(err);
			throw err;
		}
		this._client = client;
		return this;
	}

	request() {
		if (!this._client) throw new Error('Transaction chưa begin() hoặc đã kết thúc');
		return new Request(this._client);
	}

	async commit() {
		if (!this._client) throw new Error('Transaction chưa begin() hoặc đã kết thúc');
		const client = this._client;
		this._client = null;
		try {
			await client.query('COMMIT');
			client.release();
		} catch (err) {
			client.release(err);
			throw err;
		}
	}

	// Gọi được cả khi commit() đã chạy/thất bại (mẫu try { ...commit } catch { rollback })
	async rollback() {
		const client = this._client;
		if (!client) return;
		this._client = null;
		try {
			await client.query('ROLLBACK');
			client.release();
		} catch (err) {
			client.release(err);
			throw err;
		}
	}
}

// ── Pool ────────────────────────────────────────────────────────────────────
function buildConfig() {
	const ssl =
		process.env.DB_SSL === 'true'
			? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
			: false;
	return {
		host: process.env.DB_HOST,
		port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
		database: process.env.DB_NAME,
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		ssl,
		application_name: 'hospital-hrm',
		max: 10,
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 15000,
		// Giống requestTimeout mặc định 15s của mssql; tăng qua env nếu export lâu
		statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 15000,
	};
}

let poolPromise = null;

async function createPool() {
	const config = buildConfig();
	const pg = new Pool(config);
	// Lỗi trên kết nối đang rảnh (DB restart, mạng rớt) → pg phát 'error' trên
	// pool; không bắt sẽ làm sập tiến trình. Pool tự bỏ kết nối hỏng.
	pg.on('error', (err) => console.error('[db] Lỗi kết nối PostgreSQL đang rảnh:', err.message));

	// Kiểm tra kết nối ngay (mssql.connect cũ cũng báo lỗi sớm như vậy)
	const client = await pg.connect();
	client.release();
	console.log(`✅ Connected to ${config.host}:${config.port} → ${config.database}`);

	return {
		pg,
		request: () => new Request(pg),
		// Dùng trực tiếp cú pháp pg khi viết code mới: query('... $1', [v])
		query: (text, values) => pg.query(text, values),
		close: () => pg.end(),
	};
}

async function getPool() {
	if (!poolPromise) {
		poolPromise = createPool().catch((err) => {
			poolPromise = null; // lần gọi sau thử kết nối lại
			throw err;
		});
	}
	return poolPromise;
}

async function closePool() {
	if (!poolPromise) return;
	const p = poolPromise;
	poolPromise = null;
	await (await p).close();
}

sql.Transaction = Transaction;

module.exports = { getPool, closePool, sql, _compile: compile };
