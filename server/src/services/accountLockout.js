const crypto = require('crypto');
const { sql } = require('../config/db');
const { logSecurityEvent } = require('../utils/securityEvents');

// Khoá tạm tài khoản sau N lần sai mật khẩu / mã 2FA liên tiếp — chống dò mật
// khẩu theo TÀI KHOẢN, lưu ở DB nên không lách được bằng cách rải request qua
// nhiều IP hay chờ server restart (bổ sung cho loginRateLimit theo IP).
// Chỉ áp dụng cho thiết bị LẠ — thiết bị quen xem services/trustedDevice.js.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

// Thời gian khoá tăng dần theo số lần bị khoá liên tiếp (5 → 15 → 30 → 60
// phút, sau đó giữ 60). Bậc khoá về 0 khi đăng nhập đúng trên thiết bị lạ,
// hoặc khi lần khoá gần nhất đã hết hạn quá LOCKOUT_LEVEL_DECAY_HOURS.
const LOCK_MINUTES_BY_LEVEL = [5, 15, 30, 60];
const LOCKOUT_LEVEL_DECAY_HOURS = 24;

// Số phút còn bị khoá (0 = không bị khoá).
function lockedMinutesLeft(user) {
	if (!user?.locked_until) return 0;
	const ms = new Date(user.locked_until).getTime() - Date.now();
	return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

// Tăng bộ đếm atomically trong DB (tránh 2 request song song cùng đọc 1 giá
// trị cũ) — đủ ngưỡng thì khoá theo bậc hiện tại, tăng bậc và reset bộ đếm.
// Trả về số phút bị khoá nếu lần sai này làm tài khoản bị khoá, ngược lại 0.
async function recordFailedAttempt(pool, req, user, reason) {
	const maxLevel = LOCK_MINUTES_BY_LEVEL.length - 1;
	const result = await pool
		.request()
		.input('id', sql.Int, user.id_user)
		.input('max', sql.Int, MAX_FAILED_LOGIN_ATTEMPTS)
		.input('decay_hours', sql.Int, LOCKOUT_LEVEL_DECAY_HOURS).query(`
			UPDATE u SET
				locked_until = CASE WHEN u.failed_login_count + 1 >= @max
					THEN DATEADD(MINUTE, CHOOSE(x.lvl + 1, ${LOCK_MINUTES_BY_LEVEL.join(', ')}), SYSUTCDATETIME())
					ELSE u.locked_until END,
				lockout_level = CASE WHEN u.failed_login_count + 1 >= @max
					THEN CASE WHEN x.lvl < ${maxLevel} THEN x.lvl + 1 ELSE ${maxLevel} END
					ELSE x.lvl END,
				failed_login_count = CASE WHEN u.failed_login_count + 1 >= @max
					THEN 0 ELSE u.failed_login_count + 1 END
			OUTPUT DELETED.failed_login_count AS prev_count,
				DATEDIFF(SECOND, SYSUTCDATETIME(), INSERTED.locked_until) AS lock_seconds
			FROM Users u
			CROSS APPLY (SELECT CASE
				WHEN u.locked_until IS NULL
					OR u.locked_until < DATEADD(HOUR, -@decay_hours, SYSUTCDATETIME())
				THEN 0 ELSE u.lockout_level END AS lvl) x
			WHERE u.id_user = @id
		`);
	const row = result.recordset[0];
	if (!row || row.prev_count + 1 < MAX_FAILED_LOGIN_ATTEMPTS) return 0;

	const minutes = Math.max(1, Math.ceil(row.lock_seconds / 60));
	await logSecurityEvent(req, {
		eventType: 'login_locked',
		actorId: user.id_user,
		targetId: user.id_user,
		detail: `Khoá ${minutes} phút (thiết bị lạ) sau ${MAX_FAILED_LOGIN_ATTEMPTS} lần ${reason} liên tiếp`,
	});
	return minutes;
}

async function resetFailedAttempts(pool, user) {
	if (!user.failed_login_count && !user.locked_until) return;
	await pool
		.request()
		.input('id', sql.Int, user.id_user)
		.query(
			`UPDATE Users SET failed_login_count = 0, locked_until = NULL, lockout_level = 0
			 WHERE id_user = @id`,
		);
}

// ── Bỏ qua mật khẩu sai lặp lại ─────────────────────────────────
// Cùng 1 mật khẩu sai nhập lại (gõ lại, trình duyệt/điện thoại còn lưu mật
// khẩu cũ tự thử) không cho kẻ tấn công thêm thông tin gì, nên không cộng vào
// bộ đếm khoá. Chỉ giữ HMAC (khoá ngẫu nhiên theo tiến trình, không lưu DB)
// của vài mật khẩu sai gần nhất, trong thời gian ngắn.
const RECENT_WRONG_TTL_MS = 60 * 60 * 1000;
const RECENT_WRONG_PER_USER = 5;
const RECENT_WRONG_MAX_USERS = 10000;
const recentWrongKey = crypto.randomBytes(32);
const recentWrong = new Map(); // id_user -> [{ digest, at }]

// true nếu mật khẩu sai này đã được đếm gần đây (không đếm lại); ngược lại
// ghi nhớ nó và trả false.
function isRepeatedWrongPassword(id_user, password) {
	const now = Date.now();
	const digest = crypto.createHmac('sha256', recentWrongKey).update(password).digest('base64');
	const list = (recentWrong.get(id_user) || []).filter((e) => now - e.at < RECENT_WRONG_TTL_MS);
	if (list.some((e) => e.digest === digest)) {
		recentWrong.set(id_user, list);
		return true;
	}
	list.push({ digest, at: now });
	if (list.length > RECENT_WRONG_PER_USER) list.shift();
	if (!recentWrong.has(id_user) && recentWrong.size >= RECENT_WRONG_MAX_USERS) recentWrong.clear();
	recentWrong.set(id_user, list);
	return false;
}

module.exports = {
	MAX_FAILED_LOGIN_ATTEMPTS,
	lockedMinutesLeft,
	recordFailedAttempt,
	resetFailedAttempts,
	isRepeatedWrongPassword,
};
