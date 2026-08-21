// Chặn brute-force đăng nhập: giới hạn số lần sai mật khẩu theo cặp
// (IP + username) trong 1 cửa sổ thời gian — không giới hạn request thành
// công hay các endpoint khác (không phải rate-limit chung, chỉ chống dò mật khẩu).
const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const MAX_ATTEMPTS = 5;

const attempts = new Map(); // key -> { count, firstAttemptAt }

function keyOf(req) {
	const ip = req.ip || req.socket?.remoteAddress || 'unknown';
	const username = String(req.body?.username || '').toLowerCase();
	return `${ip}:${username}`;
}

function cleanup(now) {
	for (const [key, v] of attempts) {
		if (now - v.firstAttemptAt > WINDOW_MS) attempts.delete(key);
	}
}

function loginRateLimit(req, res, next) {
	const now = Date.now();
	cleanup(now);

	const key = keyOf(req);
	const entry = attempts.get(key);

	if (entry && now - entry.firstAttemptAt < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
		const retryAfterSec = Math.ceil((WINDOW_MS - (now - entry.firstAttemptAt)) / 1000);
		res.set('Retry-After', String(retryAfterSec));
		return res.status(429).json({
			success: false,
			message: 'Bạn đã nhập sai quá nhiều lần, vui lòng thử lại sau ít phút',
		});
	}

	next();
}

function recordLoginFailure(req) {
	const now = Date.now();
	const key = keyOf(req);
	const entry = attempts.get(key);
	if (entry && now - entry.firstAttemptAt < WINDOW_MS) {
		entry.count += 1;
	} else {
		attempts.set(key, { count: 1, firstAttemptAt: now });
	}
}

function recordLoginSuccess(req) {
	attempts.delete(keyOf(req));
}

module.exports = { loginRateLimit, recordLoginFailure, recordLoginSuccess };
