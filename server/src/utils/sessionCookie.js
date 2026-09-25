const jwt = require('jsonwebtoken');

// Token được lưu trong cookie HttpOnly (JavaScript trên trang không đọc được)
// thay vì localStorage — nếu trang có lỗi XSS thì kẻ tấn công cũng không lấy
// được token để dùng ở nơi khác.
//  - hrm_session: access token ngắn hạn, gửi kèm mọi request /api.
//  - hrm_refresh: refresh token, CHỈ gửi tới /api/auth (làm mới / đăng xuất)
//    → không đi kèm các request nghiệp vụ, giảm bề mặt lộ.
const SESSION_COOKIE = 'hrm_session';
const REFRESH_COOKIE = 'hrm_refresh';
const REFRESH_PATH = '/api/auth';

// Secure = chỉ gửi qua HTTPS. Reverse proxy thường không chuyển tiếp
// X-Forwarded-Proto nên Node không tự biết request là HTTPS → khi site chạy
// HTTPS hãy đặt COOKIE_SECURE=true trong .env.
function isSecure(req) {
	if (process.env.COOKIE_SECURE === 'true') return true;
	if (process.env.COOKIE_SECURE === 'false') return false;
	return req.secure;
}

function baseOptions(req, path) {
	return {
		httpOnly: true,
		secure: isSecure(req),
		sameSite: 'strict',
		path,
	};
}

function setSessionCookie(req, res, accessToken) {
	const { exp } = jwt.decode(accessToken);
	res.cookie(SESSION_COOKIE, accessToken, {
		...baseOptions(req, '/api'),
		expires: new Date(exp * 1000),
	});
}

// Phiên không "ghi nhớ" → cookie phiên trình duyệt (mất khi đóng trình duyệt);
// phía server phiên vẫn tự hết hạn theo REFRESH_TOKEN_TTL.
function setRefreshCookie(req, res, refreshToken, { expiresAt, remember }) {
	res.cookie(REFRESH_COOKIE, refreshToken, {
		...baseOptions(req, REFRESH_PATH),
		...(remember ? { expires: expiresAt } : {}),
	});
}

function clearAuthCookies(req, res) {
	res.clearCookie(SESSION_COOKIE, baseOptions(req, '/api'));
	res.clearCookie(REFRESH_COOKIE, baseOptions(req, REFRESH_PATH));
}

function readCookie(req, name) {
	const header = req.headers.cookie;
	if (!header) return null;
	for (const part of header.split(';')) {
		const idx = part.indexOf('=');
		if (idx === -1) continue;
		if (part.slice(0, idx).trim() === name) {
			try {
				return decodeURIComponent(part.slice(idx + 1).trim());
			} catch {
				return null;
			}
		}
	}
	return null;
}

const readSessionCookie = (req) => readCookie(req, SESSION_COOKIE);
const readRefreshCookie = (req) => readCookie(req, REFRESH_COOKIE);

module.exports = {
	setSessionCookie,
	setRefreshCookie,
	clearAuthCookies,
	readSessionCookie,
	readRefreshCookie,
};
