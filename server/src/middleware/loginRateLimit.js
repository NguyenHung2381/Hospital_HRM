const { readDeviceCookie } = require('../utils/sessionCookie');

// Chặn brute-force đăng nhập: giới hạn số lần sai mật khẩu trong 1 cửa sổ
// thời gian theo 2 mức:
//  - cặp (IP + username): chống dò mật khẩu của 1 tài khoản cụ thể;
//  - riêng IP: chống "password spraying" (thử 1 mật khẩu phổ biến trên rất
//    nhiều username khác nhau từ cùng 1 máy).
// Không giới hạn request thành công hay các endpoint khác.
const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const MAX_ATTEMPTS_PER_ACCOUNT = 5;
const MAX_ATTEMPTS_PER_IP = 30;
const MAX_TRACKED_KEYS = 50000; // chặn phình bộ nhớ khi bị spam username ngẫu nhiên

const attempts = new Map(); // key -> { count, firstAttemptAt }

function ipOf(req) {
	return req.ip || req.socket?.remoteAddress || 'unknown';
}

// Kèm mã thiết bị (cookie hrm_device) để người khác cùng IP (NAT bệnh viện)
// cố tình nhập sai không làm cạn lượt thử của thiết bị quen. Tự bịa mã thiết
// bị để lách bộ đếm này vẫn bị chặn bởi bộ đếm theo IP + khoá tài khoản ở DB.
function accountKey(req) {
	const username = String(req.body?.username || '').toLowerCase().slice(0, 100);
	return `acc:${ipOf(req)}:${username}:${readDeviceCookie(req) || '-'}`;
}

function ipKey(req) {
	return `ip:${ipOf(req)}`;
}

function cleanup(now) {
	for (const [key, v] of attempts) {
		if (now - v.firstAttemptAt > WINDOW_MS) attempts.delete(key);
	}
}

function blockedFor(key, max, now) {
	const entry = attempts.get(key);
	if (entry && now - entry.firstAttemptAt < WINDOW_MS && entry.count >= max) {
		return Math.ceil((WINDOW_MS - (now - entry.firstAttemptAt)) / 1000);
	}
	return 0;
}

function loginRateLimit(req, res, next) {
	const now = Date.now();
	cleanup(now);

	const retryAfterSec = Math.max(
		blockedFor(accountKey(req), MAX_ATTEMPTS_PER_ACCOUNT, now),
		blockedFor(ipKey(req), MAX_ATTEMPTS_PER_IP, now),
	);

	if (retryAfterSec > 0) {
		res.set('Retry-After', String(retryAfterSec));
		return res.status(429).json({
			success: false,
			message: 'Bạn đã nhập sai quá nhiều lần, vui lòng thử lại sau ít phút',
		});
	}

	next();
}

function bump(key, now) {
	const entry = attempts.get(key);
	if (entry && now - entry.firstAttemptAt < WINDOW_MS) {
		entry.count += 1;
	} else {
		if (attempts.size >= MAX_TRACKED_KEYS) cleanup(now);
		attempts.set(key, { count: 1, firstAttemptAt: now });
	}
}

function recordLoginFailure(req) {
	const now = Date.now();
	bump(accountKey(req), now);
	bump(ipKey(req), now);
}

// Đăng nhập đúng chỉ xoá bộ đếm của tài khoản đó — bộ đếm theo IP giữ
// nguyên, để kẻ tấn công có 1 tài khoản hợp lệ không thể "reset" giới hạn.
function recordLoginSuccess(req) {
	attempts.delete(accountKey(req));
}

module.exports = { loginRateLimit, recordLoginFailure, recordLoginSuccess };
