#!/usr/bin/env node
/* eslint-disable no-console */
// ============================================================================
// Đối chiếu dữ liệu SQL Server ↔ PostgreSQL sau khi chạy migrate-from-mssql.js.
// CHỈ ĐỌC — không ghi gì vào 2 database.
//
//   node scripts/verify-migration.js         # in tối đa 20 sai khác
//   node scripts/verify-migration.js --all   # in mọi sai khác
//
// Kiểm tra:
//  1. Từng bảng: cùng tập cột, cùng số dòng, khớp theo khoá chính và so TỪNG Ô
//     (chuỗi so đúng từng ký tự; số so theo giá trị; thời gian so theo micro-giây,
//     cho lệch ≤ 1µs vì SQL Server lưu tới 100ns còn PostgreSQL tới 1µs).
//  2. View vw_TT03_Recommended (công thức TT03 / Khuyến nghị) cho cùng kết quả.
//  3. Sequence IDENTITY đã ≥ MAX(id) (INSERT tiếp theo không trùng khoá).
// Có sai khác → in chi tiết và thoát mã 1.
// Biến môi trường giống migrate-from-mssql.js.
// ============================================================================
const { TABLES, mssqlJson, readTable, pgClient } = require('./lib/migrationCommon');

// --all: in mọi sai khác (mặc định 20 dòng đầu)
const MAX_DIFFS_SHOWN = process.argv.includes('--all') ? Infinity : 20;

// Nhận giá trị THÔ (chuỗi) từ PostgreSQL để tự chuẩn hoá — tránh sai số do
// parser mặc định (numeric → float, timestamptz → Date mất micro-giây).
const RAW_TYPES = { getTypeParser: () => (v) => v };

// '2026-03-26T08:12:33.1234567+07:00' | '2026-03-26 01:12:33.123456+00' | '...Z' → µs (BigInt)
function toMicros(s) {
	const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(s);
	if (!m) throw new Error(`Không đọc được thời gian: ${s}`);
	const [, y, mo, d, h, mi, se, frac = '', tz = 'Z'] = m;
	const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
	// phần lẻ giây → micro-giây, làm tròn chữ số thứ 7 (100ns) như PostgreSQL
	const f = (frac + '0000000').slice(0, 7);
	let micro = BigInt(f.slice(0, 6));
	if (+f[6] >= 5) micro += 1n;
	let offsetMin = 0;
	if (tz !== 'Z') {
		// '+07:00' | '+0700' | '+07' | '-03:30'
		const sign = tz[0] === '-' ? -1 : 1;
		const body = tz.slice(1).replace(':', '');
		offsetMin = sign * (Number(body.slice(0, 2)) * 60 + Number(body.slice(2) || 0));
	}
	return BigInt(ms - offsetMin * 60000) * 1000n + micro;
}

// Chuẩn hoá 1 giá trị theo kiểu cột PostgreSQL → so sánh được giữa 2 DB.
function normalize(value, pgType) {
	if (value === null || value === undefined) return null;
	switch (pgType) {
		case 'smallint':
		case 'integer':
		case 'bigint':
		case 'numeric':
		case 'real':
		case 'double precision':
			return Number(value);
		case 'boolean':
			return value === true || value === 't' || value === 'true' || value === 1;
		case 'date':
			return String(value).slice(0, 10);
		case 'timestamp with time zone':
		case 'timestamp without time zone':
			return toMicros(String(value));
		default:
			return String(value); // text, varchar, char: so đúng từng ký tự
	}
}

function same(a, b) {
	if (a === null || b === null) return a === b;
	if (typeof a === 'bigint') {
		const d = a - b;
		return d <= 1n && d >= -1n;
	}
	return a === b;
}

async function pgColumns(pg, relation) {
	const { rows } = await pg.query(
		`SELECT column_name, data_type FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
		[relation],
	);
	return rows;
}

async function pgPrimaryKey(pg, table) {
	const { rows } = await pg.query(
		`SELECT a.attname FROM pg_index i
		 JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		 WHERE i.indrelid = $1::regclass AND i.indisprimary
		 ORDER BY array_position(i.indkey, a.attnum)`,
		[table],
	);
	return rows.map((r) => r.attname);
}

// So 2 tập dòng (key = tên cột PostgreSQL). Trả về danh sách sai khác.
function diffRows(label, srcRows, dstRows, columns, keyCols) {
	const diffs = [];
	const typeOf = Object.fromEntries(columns.map((c) => [c.column_name, c.data_type]));
	const colNames = columns.map((c) => c.column_name);

	const srcCols = new Set(srcRows.length ? Object.keys(srcRows[0]) : colNames);
	const missing = colNames.filter((c) => !srcCols.has(c));
	const extra = [...srcCols].filter((c) => !typeOf[c]);
	if (missing.length || extra.length)
		diffs.push(`${label}: lệch cột — thiếu ở SQL Server: [${missing}] / thừa: [${extra}]`);

	const keyOf = (r) => keyCols.map((k) => String(normalize(r[k], typeOf[k]))).join('|');
	const dst = new Map(dstRows.map((r) => [keyOf(r), r]));
	if (dst.size !== dstRows.length) diffs.push(`${label}: PostgreSQL có khoá trùng`);

	const seen = new Set();
	for (const s of srcRows) {
		const k = keyOf(s);
		seen.add(k);
		const d = dst.get(k);
		if (!d) {
			diffs.push(`${label} [${keyCols}=${k}]: thiếu ở PostgreSQL`);
			continue;
		}
		for (const c of colNames) {
			if (!srcCols.has(c)) continue;
			const a = normalize(s[c], typeOf[c]);
			const b = normalize(d[c], typeOf[c]);
			if (!same(a, b))
				diffs.push(`${label} [${keyCols}=${k}].${c}: SQL Server=${JSON.stringify(s[c])} ≠ PostgreSQL=${JSON.stringify(d[c])}`);
		}
	}
	for (const k of dst.keys()) if (!seen.has(k)) diffs.push(`${label} [${keyCols}=${k}]: thừa ở PostgreSQL`);
	return diffs;
}

async function main() {
	const pg = pgClient('hrm-verify-migration', { types: RAW_TYPES });
	await pg.connect();
	console.log(`SQL Server ${process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS'}/${process.env.MSSQL_DATABASE || 'HRM_HOSPITAL'}`);
	console.log(`PostgreSQL ${pg.host}:${pg.port}/${pg.database}\n`);
	const all = [];
	const summary = [];
	try {
		await pg.query("SET TimeZone = 'UTC'");

		// 1. Bảng
		for (const t of TABLES) {
			const columns = await pgColumns(pg, t.dst);
			const key = await pgPrimaryKey(pg, t.dst);
			const src = readTable(t);
			const { rows: dst } = await pg.query(`SELECT * FROM ${t.dst}`);
			const diffs = diffRows(t.dst, src, dst, columns, key);
			summary.push({ table: t.dst, mssql: src.length, postgres: dst.length, cells: src.length * columns.length, diffs: diffs.length });
			all.push(...diffs);
		}

		// 2. View công thức
		{
			const columns = await pgColumns(pg, 'vw_tt03_recommended');
			const src = mssqlJson('SELECT * FROM dbo.vw_TT03_Recommended FOR JSON PATH, INCLUDE_NULL_VALUES').map((r) =>
				Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])),
			);
			const { rows: dst } = await pg.query('SELECT * FROM vw_tt03_recommended');
			const diffs = diffRows('vw_tt03_recommended', src, dst, columns, ['record_id']);
			summary.push({ table: 'vw_tt03_recommended (view)', mssql: src.length, postgres: dst.length, cells: src.length * columns.length, diffs: diffs.length });
			all.push(...diffs);
		}

		// 3. Sequence
		const { rows: seqs } = await pg.query(`
			SELECT c.table_name, c.column_name,
			       pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
			FROM information_schema.columns c
			WHERE c.table_schema = 'public' AND c.is_identity = 'YES'`);
		for (const s of seqs) {
			const { rows: [m] } = await pg.query(`SELECT MAX(${s.column_name}) AS max FROM ${s.table_name}`);
			const { rows: [q] } = await pg.query(`SELECT last_value, is_called FROM ${s.seq}`);
			const next = BigInt(q.last_value) + (q.is_called === 't' || q.is_called === true ? 1n : 0n);
			if (m.max !== null && next <= BigInt(m.max))
				all.push(`sequence ${s.seq}: giá trị kế tiếp ${next} ≤ MAX(${s.table_name}.${s.column_name}) = ${m.max} → chạy 900_reset_sequences.sql`);
		}
	} finally {
		await pg.end();
	}

	console.table(summary);
	if (all.length) {
		console.log(`\n❌ ${all.length} sai khác (hiện ${Math.min(all.length, MAX_DIFFS_SHOWN)} đầu tiên):`);
		for (const d of all.slice(0, MAX_DIFFS_SHOWN)) console.log('  - ' + d);
		process.exit(1);
	}
	const cells = summary.reduce((s, r) => s + r.cells, 0);
	console.log(`\n✅ Khớp hoàn toàn: ${summary.length} bảng/view, ${cells} ô dữ liệu, sequence hợp lệ.`);
}

main().catch((err) => {
	console.error('❌ Không đối chiếu được:', err.message);
	process.exit(2);
});
