const { getPool, sql } = require('../config/db');
const { readDeviceCookie } = require('../utils/sessionCookie');

// Chặn brute-force đăng nhập: giới hạn số lần sai mật khẩu trong 1 cửa sổ
// thời gian theo 2 mức:
//  - cặp (IP + username + thiết bị): chống dò mật khẩu của 1 tài khoản cụ thể;
//  - riêng IP: chống "password spraying" (thử 1 mật khẩu phổ biến trên rất
//    nhiều username khác nhau từ cùng 1 máy).
// Không giới hạn request thành công hay các endpoint khác.
//
// Bộ đếm lưu ở bảng auth_rate_limits (004_auth_rate_limits.sql) → không mất
// khi restart server và dùng chung khi chạy nhiều tiến trình. DB chưa có bảng
// (chưa chạy migration) thì tạm đếm trong bộ nhớ và cảnh báo 1 lần.
const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const MAX_ATTEMPTS_PER_ACCOUNT = 5;
const MAX_ATTEMPTS_PER_IP = 30;
const MAX_TRACKED_KEYS = 50000; // chặn phình bộ nhớ (chế độ dự phòng)

function ipOf(req) {
	return req.ip || req.socket?.remoteAddress || 'unknown';
}

// Kèm mã thiết bị (cookie hrm_device) để người khác cùng IP (NAT bệnh viện)
// cố tình nhập sai không làm cạn lượt thử của thiết bị quen. Tự bịa mã thiết
// bị để lách bộ đếm này vẫn bị chặn bởi bộ đếm theo IP + khoá tài khoản ở DB.
function accountKey(req) {
	const username = String(req.body?.username || '').toLowerCase().slice(0, 100);
	return `acc:${ipOf(req)}:${username}:${readDeviceCookie(req) || '-'}`.slice(0, 200);
}

function ipKey(req) {
	return `ip:${ipOf(req)}`.slice(0, 200);
}

// ── Kho lưu bộ đếm ─────────────────────────────────────────────
const memory = new Map(); // key -> { count, firstAttemptAt }

const memoryStore = {
	async get(keys) {
		const now = Date.now();
		return keys.map((k) => {
			const e = memory.get(k);
			return e && now - e.firstAttemptAt < WINDOW_MS ? e : null;
		});
	},
	async bump(keys) {
		const now = Date.now();
		if (memory.size >= MAX_TRACKED_KEYS) {
			for (const [k, v] of memory) if (now - v.firstAttemptAt > WINDOW_MS) memory.delete(k);
		}
		for (const k of keys) {
			const e = memory.get(k);
			if (e && now - e.firstAttemptAt < WINDOW_MS) e.count += 1;
			else memory.set(k, { count: 1, firstAttemptAt: now });
		}
	},
	async remove(key) {
		memory.delete(key);
	},
};

const dbStore = {
	async get(keys) {
		const pool = await getPool();
		const req = pool.request().input('win', sql.Int, WINDOW_MS / 1000);
		keys.forEach((k, i) => req.input(`k${i}`, sql.VarChar(200), k));
		const r = await req.query(`
			SELECT key, count, (EXTRACT(EPOCH FROM window_start) * 1000)::bigint AS started
			FROM auth_rate_limits
			WHERE key IN (${keys.map((_, i) => `@k${i}`).join(', ')})
			  AND window_start > now() - make_interval(secs => @win)
		`);
		const byKey = new Map(r.recordset.map((row) => [row.key, row]));
		return keys.map((k) => {
			const row = byKey.get(k);
			return row ? { count: row.count, firstAttemptAt: Number(row.started) } : null;
		});
	},
	async bump(keys) {
		const pool = await getPool();
		for (const k of keys) {
			await pool
				.request()
				.input('key', sql.VarChar(200), k)
				.input('win', sql.Int, WINDOW_MS / 1000).query(`
					INSERT INTO auth_rate_limits AS a (key, count, window_start)
					VALUES (@key, 1, now())
					ON CONFLICT (key) DO UPDATE SET
						count = CASE WHEN a.window_start <= now() - make_interval(secs => @win)
							THEN 1 ELSE a.count + 1 END,
						window_start = CASE WHEN a.window_start <= now() - make_interval(secs => @win)
							THEN now() ELSE a.window_start END
				`);
		}
	},
	async remove(key) {
		const pool = await getPool();
		await pool
			.request()
			.input('key', sql.VarChar(200), key)
			.query(`DELETE FROM auth_rate_limits WHERE key = @key`);
	},
};

let storePromise = null;
function getStore() {
	if (!storePromise) {
		storePromise = getPool()
			.then((pool) => pool.request().query(`SELECT to_regclass('auth_rate_limits') AS t`))
			.then((r) => {
				if (r.recordset[0]?.t) return dbStore;
				console.warn(
					'⚠️  Thiếu bảng auth_rate_limits — giới hạn đăng nhập tạm đếm trong bộ nhớ ' +
						'(mất khi restart). Chạy server/db/postgres/004_auth_rate_limits.sql bằng hrm_owner.',
				);
				return memoryStore;
			})
			.catch((err) => {
				storePromise = null; // thử lại ở request sau
				throw err;
			});
	}
	return storePromise;
}

// Lỗi DB khi đếm không được làm hỏng đăng nhập — tạm dùng bộ nhớ cho lần đó
async function withStore(fn) {
	try {
		return await fn(await getStore());
	} catch (err) {
		console.error('[loginRateLimit]', err.message);
		return fn(memoryStore);
	}
}

function retryAfter(entry, max, now) {
	if (entry && now - entry.firstAttemptAt < WINDOW_MS && entry.count >= max)
		return Math.ceil((WINDOW_MS - (now - entry.firstAttemptAt)) / 1000);
	return 0;
}

function loginRateLimit(req, res, next) {
	withStore((store) => store.get([accountKey(req), ipKey(req)]))
		.then(([acc, ip]) => {
			const now = Date.now();
			const retryAfterSec = Math.max(
				retryAfter(acc, MAX_ATTEMPTS_PER_ACCOUNT, now),
				retryAfter(ip, MAX_ATTEMPTS_PER_IP, now),
			);
			if (retryAfterSec > 0) {
				res.set('Retry-After', String(retryAfterSec));
				return res.status(429).json({
					success: false,
					message: 'Bạn đã nhập sai quá nhiều lần, vui lòng thử lại sau ít phút',
				});
			}
			next();
		})
		.catch(next);
}

function recordLoginFailure(req) {
	return withStore((store) => store.bump([accountKey(req), ipKey(req)]));
}

// Đăng nhập đúng chỉ xoá bộ đếm của tài khoản đó — bộ đếm theo IP giữ
// nguyên, để kẻ tấn công có 1 tài khoản hợp lệ không thể "reset" giới hạn.
function recordLoginSuccess(req) {
	return withStore((store) => store.remove(accountKey(req)));
}

// Dọn bộ đếm đã hết cửa sổ (gọi từ tác vụ nền)
async function pruneRateLimits() {
	const now = Date.now();
	for (const [k, v] of memory) if (now - v.firstAttemptAt > WINDOW_MS) memory.delete(k);
	const store = await getStore().catch(() => memoryStore);
	if (store !== dbStore) return;
	const pool = await getPool();
	await pool
		.request()
		.input('win', sql.Int, WINDOW_MS / 1000)
		.query(`DELETE FROM auth_rate_limits WHERE window_start < now() - make_interval(secs => @win)`);
}

module.exports = { loginRateLimit, recordLoginFailure, recordLoginSuccess, pruneRateLimits };
