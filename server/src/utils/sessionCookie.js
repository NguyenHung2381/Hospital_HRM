const jwt = require('jsonwebtoken');

// Token đăng nhập được lưu trong cookie HttpOnly (JavaScript trên trang không
// đọc được) thay vì localStorage — nếu trang có lỗi XSS thì kẻ tấn công cũng
// không lấy được token để dùng ở nơi khác.
const SESSION_COOKIE = 'hrm_session';

// Secure = chỉ gửi qua HTTPS. Apache thường không chuyển tiếp
// X-Forwarded-Proto nên Node không tự biết request là HTTPS → khi site chạy
// HTTPS hãy đặt COOKIE_SECURE=true trong .env.
function isSecure(req) {
	if (process.env.COOKIE_SECURE === 'true') return true;
	if (process.env.COOKIE_SECURE === 'false') return false;
	return req.secure;
}

function cookieOptions(req) {
	return {
		httpOnly: true,
		secure: isSecure(req),
		sameSite: 'strict',
		path: '/api',
	};
}

function setSessionCookie(req, res, token) {
	const { exp } = jwt.decode(token);
	res.cookie(SESSION_COOKIE, token, {
		...cookieOptions(req),
		expires: new Date(exp * 1000),
	});
}

function clearSessionCookie(req, res) {
	res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

function readSessionCookie(req) {
	const header = req.headers.cookie;
	if (!header) return null;
	for (const part of header.split(';')) {
		const idx = part.indexOf('=');
		if (idx === -1) continue;
		if (part.slice(0, idx).trim() === SESSION_COOKIE) {
			try {
				return decodeURIComponent(part.slice(idx + 1).trim());
			} catch {
				return null;
			}
		}
	}
	return null;
}

module.exports = { setSessionCookie, clearSessionCookie, readSessionCookie };
