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
//   Sau đó đối chiếu: node scripts/verify-migration.js
//
// Biến môi trường:
//   MSSQL_SERVER   (mặc định localhost\SQLEXPRESS)   MSSQL_DATABASE (HRM_HOSPITAL)
//   MSSQL_USER / MSSQL_PASSWORD  — bỏ trống = Windows Authentication (sqlcmd -E);
//                  mật khẩu chuyển cho sqlcmd qua SQLCMDPASSWORD, không lên dòng lệnh
//   PG_HOST PG_PORT PG_DATABASE PG_USER PG_PASSWORD (PG_SSL) — mặc định lấy DB_* trong .env,
//   nhưng PG_USER nên là hrm_owner (hrm_app không TRUNCATE được).
// ============================================================================
const { TABLES, readTable, pgClient } = require('./lib/migrationCommon');

const BATCH_ROWS = 1000;

async function main() {
	const truncate = process.argv.includes('--truncate');
	const pg = pgClient('hrm-migrate-from-mssql');
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
