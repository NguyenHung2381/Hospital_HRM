const { getPool, sql } = require('../config/db');
const { ensureSchema } = require('../config/schema');
const {
	REFRESH_TTL_MS,
	REFRESH_REMEMBER_TTL_MS,
	SESSION_MAX_AGE_MS,
	passwordFingerprint,
	newRefreshToken,
	hashToken,
	newSessionId,
} = require('../utils/tokens');

// Quản lý phiên đăng nhập (bảng Auth_Sessions — xem config/schema.js).
// Mỗi lần đăng nhập tạo 1 phiên; access token mang sid của phiên nên thu hồi
// phiên là access token đang dùng cũng mất hiệu lực (sau tối đa
// STATE_CACHE_TTL_MS trên các tiến trình khác, ngay lập tức trên tiến trình này).

// Khoảng thời gian token vừa bị xoay vẫn được chấp nhận — 2 tab cùng làm mới
// một lúc thì tab chậm hơn gửi token cũ; không coi đó là tấn công.
const REUSE_GRACE_MS = 30 * 1000;
const STATE_CACHE_TTL_MS = 15 * 1000;

async function db() {
	await ensureSchema();
	return getPool();
}

function ttlFor(clientType, remember) {
	return clientType === 'api' || remember ? REFRESH_REMEMBER_TTL_MS : REFRESH_TTL_MS;
}

// ── Cache trạng thái phiên cho middleware authenticate ─────────
const stateCache = new Map(); // sid -> { active, expiresAt }

async function isSessionActive(sid) {
	const now = Date.now();
	const cached = stateCache.get(sid);
	if (cached && cached.expiresAt > now) return cached.active;
	const pool = await db();
	const r = await pool.request().input('sid', sql.Char(32), sid).query(`
		SELECT 1 AS ok FROM Auth_Sessions
		WHERE id_session = @sid AND revoked_at IS NULL
			AND expires_at > SYSUTCDATETIME() AND max_expires_at > SYSUTCDATETIME()
	`);
	const active = r.recordset.length > 0;
	if (stateCache.size > 10000) stateCache.clear();
	stateCache.set(sid, { active, expiresAt: now + STATE_CACHE_TTL_MS });
	return active;
}

function forgetSessionState(sid) {
	if (sid === undefined) stateCache.clear();
	else stateCache.delete(sid);
}

/**
 * Tạo phiên mới sau khi đăng nhập đúng.
 * @returns {{ sid: string, refreshToken: string, refreshExpiresAt: Date, remember: boolean }}
 */
async function createSession({ user, clientType, remember, ip, userAgent }) {
	const sid = newSessionId();
	const refreshToken = newRefreshToken();
	const now = Date.now();
	const maxExpiresAt = new Date(now + SESSION_MAX_AGE_MS);
	const refreshExpiresAt = new Date(Math.min(now + ttlFor(clientType, remember), maxExpiresAt.getTime()));

	const pool = await db();
	await pool
		.request()
		.input('sid', sql.Char(32), sid)
		.input('id_user', sql.Int, user.id_user)
		.input('client_type', sql.VarChar(10), clientType)
		.input('remember', sql.Bit, remember ? 1 : 0)
		.input('refresh_hash', sql.Char(64), hashToken(refreshToken))
		.input('pwf', sql.VarChar(32), passwordFingerprint(user.password))
		.input('ip', sql.VarChar(64), ip ? String(ip).slice(0, 64) : null)
		.input('ua', sql.NVarChar(300), userAgent ? String(userAgent).slice(0, 300) : null)
		.input('expires_at', sql.DateTime2(0), refreshExpiresAt)
		.input('max_expires_at', sql.DateTime2(0), maxExpiresAt).query(`
			INSERT INTO Auth_Sessions
				(id_session, id_user, client_type, remember, refresh_hash, pwf,
				 ip_address, user_agent, expires_at, max_expires_at)
			VALUES
				(@sid, @id_user, @client_type, @remember, @refresh_hash, @pwf,
				 @ip, @ua, @expires_at, @max_expires_at)
		`);
	return { sid, refreshToken, refreshExpiresAt, remember: !!remember };
}

const SESSION_USER_SELECT = `
	SELECT s.id_session, s.id_user, s.client_type, s.remember, s.refresh_hash,
		s.prev_refresh_hash, s.rotated_at, s.pwf, s.expires_at, s.max_expires_at,
		s.revoked_at, u.username, u.password, u.status, r.name_role
	FROM Auth_Sessions s
	JOIN Users u ON u.id_user = s.id_user
	LEFT JOIN Roles r ON r.id_role = u.id_role
`;

/**
 * Dùng refresh token để xin access token mới; refresh token được XOAY (cấp
 * token mới, token cũ hết giá trị).
 * @returns {Promise<
 *   | { status: 'ok', session: object, refreshToken: string, refreshExpiresAt: Date }
 *   | { status: 'grace', session: object }
 *   | { status: 'reuse', session: object }
 *   | { status: 'invalid', reason: string, session?: object }>}
 */
async function rotateRefreshToken(refreshToken, { clientType, ip, userAgent }) {
	if (typeof refreshToken !== 'string' || refreshToken.length < 32 || refreshToken.length > 200)
		return { status: 'invalid', reason: 'malformed' };
	const hash = hashToken(refreshToken);
	const pool = await db();

	const found = await pool.request().input('h', sql.Char(64), hash).query(`
		${SESSION_USER_SELECT}
		WHERE s.refresh_hash = @h OR s.prev_refresh_hash = @h
	`);
	const s = found.recordset[0];
	if (!s) return { status: 'invalid', reason: 'unknown' };
	if (s.revoked_at) return { status: 'invalid', reason: 'revoked', session: s };
	if (s.client_type !== clientType) return { status: 'invalid', reason: 'client_mismatch', session: s };

	const now = Date.now();
	if (s.expires_at.getTime() <= now || s.max_expires_at.getTime() <= now)
		return { status: 'invalid', reason: 'expired', session: s };
	if (s.status !== 'active' || s.pwf !== passwordFingerprint(s.password)) {
		await revokeSession(s.id_session, s.status !== 'active' ? 'account_inactive' : 'password_changed');
		return { status: 'invalid', reason: 'credentials_changed', session: s };
	}

	// Token cũ (đã bị xoay) được gửi lại
	if (s.refresh_hash !== hash) {
		if (s.rotated_at && now - s.rotated_at.getTime() <= REUSE_GRACE_MS)
			return { status: 'grace', session: s };
		await revokeSession(s.id_session, 'refresh_reuse');
		return { status: 'reuse', session: s };
	}

	const nextToken = newRefreshToken();
	const refreshExpiresAt = new Date(
		Math.min(now + ttlFor(s.client_type, s.remember), s.max_expires_at.getTime()),
	);
	const upd = await pool
		.request()
		.input('sid', sql.Char(32), s.id_session)
		.input('old', sql.Char(64), hash)
		.input('new', sql.Char(64), hashToken(nextToken))
		.input('expires_at', sql.DateTime2(0), refreshExpiresAt)
		.input('ip', sql.VarChar(64), ip ? String(ip).slice(0, 64) : null)
		.input('ua', sql.NVarChar(300), userAgent ? String(userAgent).slice(0, 300) : null).query(`
			UPDATE Auth_Sessions
			SET prev_refresh_hash = refresh_hash, refresh_hash = @new,
				rotated_at = SYSUTCDATETIME(), last_used_at = SYSUTCDATETIME(),
				expires_at = @expires_at,
				ip_address = COALESCE(@ip, ip_address), user_agent = COALESCE(@ua, user_agent)
			WHERE id_session = @sid AND refresh_hash = @old AND revoked_at IS NULL
		`);
	// Request khác vừa xoay cùng token này trước — coi như trường hợp "grace"
	if (!upd.rowsAffected[0]) return { status: 'grace', session: s };

	return { status: 'ok', session: s, refreshToken: nextToken, refreshExpiresAt };
}

// Đánh dấu phiên còn được dùng (không cần chính xác tuyệt đối → không await ở nơi gọi)
async function touchSession(sid) {
	const pool = await db();
	await pool
		.request()
		.input('sid', sql.Char(32), sid)
		.query(
			`UPDATE Auth_Sessions SET last_used_at = SYSUTCDATETIME() WHERE id_session = @sid AND revoked_at IS NULL`,
		);
}

async function revokeSession(sid, reason, { id_user } = {}) {
	const pool = await db();
	const req = pool
		.request()
		.input('sid', sql.Char(32), sid)
		.input('reason', sql.NVarChar(50), reason);
	if (id_user !== undefined) req.input('id_user', sql.Int, id_user);
	const r = await req.query(`
		UPDATE Auth_Sessions SET revoked_at = SYSUTCDATETIME(), revoked_reason = @reason
		WHERE id_session = @sid AND revoked_at IS NULL
		${id_user !== undefined ? 'AND id_user = @id_user' : ''}
	`);
	forgetSessionState(sid);
	return r.rowsAffected[0] > 0;
}

// Đăng xuất bằng refresh token (khi access token đã hết hạn). Trả về
// { id_session, id_user } của phiên vừa thu hồi hoặc null.
async function revokeByRefreshToken(refreshToken, reason, clientType) {
	if (typeof refreshToken !== 'string' || refreshToken.length < 32 || refreshToken.length > 200)
		return null;
	const pool = await db();
	const r = await pool
		.request()
		.input('h', sql.Char(64), hashToken(refreshToken))
		.input('reason', sql.NVarChar(50), reason)
		.input('client_type', sql.VarChar(10), clientType).query(`
			UPDATE Auth_Sessions SET revoked_at = SYSUTCDATETIME(), revoked_reason = @reason
			OUTPUT INSERTED.id_session, INSERTED.id_user
			WHERE refresh_hash = @h AND client_type = @client_type AND revoked_at IS NULL
		`);
	const row = r.recordset[0];
	if (row) forgetSessionState(row.id_session);
	return row ?? null;
}

// Thu hồi mọi phiên của 1 tài khoản (trừ phiên exceptSid nếu có)
async function revokeUserSessions(id_user, reason, exceptSid = null) {
	const pool = await db();
	const r = await pool
		.request()
		.input('id_user', sql.Int, id_user)
		.input('reason', sql.NVarChar(50), reason)
		.input('except', sql.Char(32), exceptSid).query(`
			UPDATE Auth_Sessions SET revoked_at = SYSUTCDATETIME(), revoked_reason = @reason
			OUTPUT INSERTED.id_session
			WHERE id_user = @id_user AND revoked_at IS NULL
				AND (@except IS NULL OR id_session <> @except)
		`);
	for (const row of r.recordset) forgetSessionState(row.id_session);
	return r.recordset.length;
}

// Sau khi đổi mật khẩu: phiên hiện tại vẫn giữ nhưng phải mang dấu vân tay mới
async function updateSessionFingerprint(sid, passwordHash) {
	const pool = await db();
	await pool
		.request()
		.input('sid', sql.Char(32), sid)
		.input('pwf', sql.VarChar(32), passwordFingerprint(passwordHash))
		.query(`UPDATE Auth_Sessions SET pwf = @pwf WHERE id_session = @sid`);
}

/**
 * Danh sách phiên còn hiệu lực. id_user = null → mọi tài khoản (trang admin).
 */
async function listActiveSessions({ id_user = null } = {}) {
	const pool = await db();
	const r = await pool.request().input('id_user', sql.Int, id_user).query(`
		SELECT s.id_session, s.id_user, s.client_type, s.remember, s.ip_address,
			s.user_agent, s.created_at, s.last_used_at, s.expires_at,
			u.username, u.full_name, r.name_role
		FROM Auth_Sessions s
		JOIN Users u ON u.id_user = s.id_user
		LEFT JOIN Roles r ON r.id_role = u.id_role
		WHERE s.revoked_at IS NULL
			AND s.expires_at > SYSUTCDATETIME() AND s.max_expires_at > SYSUTCDATETIME()
			AND (@id_user IS NULL OR s.id_user = @id_user)
		ORDER BY s.last_used_at DESC
	`);
	return r.recordset;
}

// Xoá dòng phiên đã hết hạn / đã thu hồi quá SESSION_RETENTION_DAYS ngày
async function cleanupSessions() {
	const days = Math.max(1, parseInt(process.env.SESSION_RETENTION_DAYS, 10) || 30);
	const pool = await db();
	const r = await pool.request().input('days', sql.Int, days).query(`
		DELETE FROM Auth_Sessions
		WHERE COALESCE(revoked_at, CASE WHEN expires_at < max_expires_at THEN expires_at ELSE max_expires_at END)
			< DATEADD(DAY, -@days, SYSUTCDATETIME())
	`);
	return r.rowsAffected[0];
}

module.exports = {
	isSessionActive,
	forgetSessionState,
	createSession,
	rotateRefreshToken,
	touchSession,
	revokeSession,
	revokeByRefreshToken,
	revokeUserSessions,
	updateSessionFingerprint,
	listActiveSessions,
	cleanupSessions,
};
