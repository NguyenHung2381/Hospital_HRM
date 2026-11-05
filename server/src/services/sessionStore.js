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

// Phiên bỏ không quá SESSION_IDLE_MINUTES (không gọi API nào) thì hết hiệu
// lực, dù JWT chưa hết hạn — máy tính dùng chung ở khoa phòng hay bị bỏ quên
// đang đăng nhập. 0 = tắt (chỉ còn hạn tuyệt đối JWT_EXPIRES).
const SESSION_IDLE_MINUTES = (() => {
	const n = Number(process.env.SESSION_IDLE_MINUTES ?? 60);
	return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 60;
})();

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
			VALUES (@jti, @id_user, @ip_address, @user_agent, @expires_at, now())
		`);
}

// true nếu phiên còn hiệu lực (tồn tại, chưa thu hồi, chưa hết hạn, chưa bỏ
// không quá SESSION_IDLE_MINUTES) và thuộc đúng id_user. Mỗi lần thực sự chạm
// DB thì cập nhật last_seen_at — trừ khi touch=false (kiểm tra nền của luồng
// SSE: tab chỉ mở sẵn không được tính là người dùng đang thao tác).
async function isSessionActive(jti, id_user, { touch = true } = {}) {
	if (typeof jti !== 'string' || jti.length !== 32) return false;
	const now = Date.now();
	const cached = sessionCache.get(jti);
	if (cached && cached.expiresAt > now) return cached.active && cached.id_user === id_user;

	const pool = await getPool();
	const alive = `jti = @jti AND revoked_at IS NULL AND expires_at > now()
		AND (@idle = 0 OR COALESCE(last_seen_at, created_at) > now() - make_interval(mins => @idle))`;
	const request = pool
		.request()
		.input('jti', sql.Char(32), jti)
		.input('idle', sql.Int, SESSION_IDLE_MINUTES);
	const result = await request.query(
		touch
			? `UPDATE UserSessions SET last_seen_at = now() WHERE ${alive} RETURNING id_user`
			: `SELECT id_user FROM UserSessions WHERE ${alive}`,
	);
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
		UPDATE UserSessions SET revoked_at = now()
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
			UPDATE UserSessions SET revoked_at = now()
			WHERE id_user = @id_user AND revoked_at IS NULL
			  AND (@except IS NULL OR jti <> @except)
		`);
	forgetCachedSessions((jti, v) => v.id_user === id_user && jti !== exceptJti);
	return result.rowsAffected[0] || 0;
}

// Điều kiện "phiên chưa bỏ không quá hạn" cho các danh sách phiên (alias s)
const NOT_IDLE = `(@idle = 0 OR COALESCE(s.last_seen_at, s.created_at) > now() - make_interval(mins => @idle))`;

async function listSessions(id_user) {
	const pool = await getPool();
	const result = await pool
		.request()
		.input('id_user', sql.Int, id_user)
		.input('idle', sql.Int, SESSION_IDLE_MINUTES).query(`
		SELECT jti, ip_address, user_agent, created_at, last_seen_at, expires_at
		FROM UserSessions s
		WHERE id_user = @id_user AND revoked_at IS NULL AND expires_at > now() AND ${NOT_IDLE}
		ORDER BY COALESCE(last_seen_at, created_at) DESC
	`);
	return result.recordset;
}

// Phiên còn hiệu lực của mọi tài khoản (hoặc 1 tài khoản) kèm thông tin
// người dùng — cho trang quản trị "Phiên đăng nhập".
async function listActiveSessions({ id_user = null } = {}) {
	const pool = await getPool();
	const result = await pool
		.request()
		.input('id_user', sql.Int, id_user)
		.input('idle', sql.Int, SESSION_IDLE_MINUTES).query(`
		SELECT s.jti, s.id_user, u.username, u.full_name, r.name_role,
			s.ip_address, s.user_agent, s.created_at, s.last_seen_at, s.expires_at
		FROM UserSessions s
		JOIN Users u ON u.id_user = s.id_user
		LEFT JOIN Roles r ON r.id_role = u.id_role
		WHERE s.revoked_at IS NULL AND s.expires_at > now() AND ${NOT_IDLE}
		  AND (@id_user IS NULL OR s.id_user = @id_user)
		ORDER BY COALESCE(s.last_seen_at, s.created_at) DESC
	`);
	return result.recordset;
}

module.exports = {
	SESSION_IDLE_MINUTES,
	createSession,
	isSessionActive,
	revokeSession,
	revokeAllSessions,
	listSessions,
	listActiveSessions,
};
