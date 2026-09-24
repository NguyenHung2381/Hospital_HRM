const { getPool, sql } = require('../config/db');

// Phiên đăng nhập lưu ở bảng UserSessions (khoá = jti của JWT trong cookie).
// Thay cho danh sách token thu hồi trong bộ nhớ trước đây: đăng xuất / thu hồi
// không mất khi restart server, và người dùng xem được mình đang đăng nhập ở
// những thiết bị nào để đăng xuất từ xa.
//
// Kiểm tra phiên được cache ngắn (SESSION_CACHE_TTL_MS) để không query DB mỗi
// request; mọi thao tác thu hồi đều xoá cache tương ứng nên có hiệu lực ngay.
const SESSION_CACHE_TTL_MS = 15 * 1000;
const sessionCache = new Map(); // jti -> { active, id_user, expiresAt }

async function createSession({ jti, id_user, expiresAt, ip, userAgent }) {
	const pool = await getPool();
	await pool
		.request()
		.input('jti', sql.Char(32), jti)
		.input('id_user', sql.Int, id_user)
		.input('expires_at', sql.DateTime2, expiresAt)
		.input('ip_address', sql.VarChar(64), ip ? String(ip).slice(0, 64) : null)
		.input('user_agent', sql.NVarChar(255), userAgent ? String(userAgent).slice(0, 255) : null)
		.query(`
			INSERT INTO UserSessions (jti, id_user, ip_address, user_agent, expires_at, last_seen_at)
			VALUES (@jti, @id_user, @ip_address, @user_agent, @expires_at, SYSUTCDATETIME())
		`);
}

// true nếu phiên còn hiệu lực (tồn tại, chưa thu hồi, chưa hết hạn) và thuộc
// đúng id_user. Mỗi lần thực sự chạm DB thì cập nhật last_seen_at luôn.
async function isSessionActive(jti, id_user) {
	if (typeof jti !== 'string' || jti.length !== 32) return false;
	const now = Date.now();
	const cached = sessionCache.get(jti);
	if (cached && cached.expiresAt > now) return cached.active && cached.id_user === id_user;

	const pool = await getPool();
	const result = await pool.request().input('jti', sql.Char(32), jti).query(`
		UPDATE UserSessions SET last_seen_at = SYSUTCDATETIME()
		OUTPUT INSERTED.id_user
		WHERE jti = @jti AND revoked_at IS NULL AND expires_at > SYSUTCDATETIME()
	`);
	const row = result.recordset[0];
	const active = !!row;
	if (sessionCache.size > 10000) sessionCache.clear();
	sessionCache.set(jti, {
		active,
		id_user: row?.id_user ?? null,
		expiresAt: now + SESSION_CACHE_TTL_MS,
	});
	return active && row.id_user === id_user;
}

function forgetCachedSessions(predicate) {
	for (const [jti, v] of sessionCache) if (predicate(jti, v)) sessionCache.delete(jti);
}

async function revokeSession(jti, id_user = null) {
	if (typeof jti !== 'string') return 0;
	const pool = await getPool();
	const request = pool.request().input('jti', sql.Char(32), jti);
	let filter = '';
	if (id_user != null) {
		request.input('id_user', sql.Int, id_user);
		filter = ' AND id_user = @id_user';
	}
	const result = await request.query(`
		UPDATE UserSessions SET revoked_at = SYSUTCDATETIME()
		WHERE jti = @jti AND revoked_at IS NULL${filter}
	`);
	sessionCache.delete(jti);
	return result.rowsAffected[0] || 0;
}

// Thu hồi mọi phiên của 1 tài khoản (trừ exceptJti nếu có) — dùng cho
// "đăng xuất các thiết bị khác", đổi/đặt lại mật khẩu, khoá tài khoản.
async function revokeAllSessions(id_user, exceptJti = null) {
	const pool = await getPool();
	const result = await pool
		.request()
		.input('id_user', sql.Int, id_user)
		.input('except', sql.Char(32), exceptJti).query(`
			UPDATE UserSessions SET revoked_at = SYSUTCDATETIME()
			WHERE id_user = @id_user AND revoked_at IS NULL
			  AND (@except IS NULL OR jti <> @except)
		`);
	forgetCachedSessions((jti, v) => v.id_user === id_user && jti !== exceptJti);
	return result.rowsAffected[0] || 0;
}

async function listSessions(id_user) {
	const pool = await getPool();
	const result = await pool.request().input('id_user', sql.Int, id_user).query(`
		SELECT jti, ip_address, user_agent, created_at, last_seen_at, expires_at
		FROM UserSessions
		WHERE id_user = @id_user AND revoked_at IS NULL AND expires_at > SYSUTCDATETIME()
		ORDER BY COALESCE(last_seen_at, created_at) DESC
	`);
	return result.recordset;
}

module.exports = {
	createSession,
	isSessionActive,
	revokeSession,
	revokeAllSessions,
	listSessions,
};
