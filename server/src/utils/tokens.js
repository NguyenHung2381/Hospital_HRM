const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ── Bí mật ký JWT ──────────────────────────────────────────────
// KHÔNG được fallback về 1 chuỗi cố định — nếu thiếu, kẻ tấn công biết trước
// giá trị mặc định có thể tự ký JWT hợp lệ (kể cả token admin) mà không cần
// đăng nhập. Production bắt buộc phải cấu hình JWT_SECRET; môi trường khác
// (dev/local) tự sinh secret ngẫu nhiên mỗi lần khởi động.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
	throw new Error(
		'Thiếu biến môi trường JWT_SECRET — bắt buộc phải cấu hình trước khi chạy production.',
	);
}
if (!process.env.JWT_SECRET) {
	console.warn(
		'⚠️  JWT_SECRET chưa được cấu hình — dùng secret ngẫu nhiên tạm thời cho phiên chạy này (token sẽ mất hiệu lực khi restart server). Hãy đặt JWT_SECRET trong .env.',
	);
} else if (process.env.JWT_SECRET.length < 32) {
	console.warn(
		'⚠️  JWT_SECRET quá ngắn (< 32 ký tự) — dễ bị dò ngược. Hãy dùng chuỗi ngẫu nhiên dài, vd: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
	);
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Cố định thuật toán — không để thư viện tự suy ra từ header của token.
const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'hospital-hrm';

// "15m" | "12h" | "7d" | "3600" (giây) → mili-giây
function parseDuration(value, fallback) {
	const m = /^(\d+)\s*([smhd]?)$/i.exec(String(value ?? '').trim());
	if (!m) return parseDuration(fallback);
	const unit = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2].toLowerCase()];
	return Number(m[1]) * unit * 1000;
}

// Access token: ngắn hạn, dùng cho mọi API. Refresh token: dùng để xin access
// token mới, xoay vòng mỗi lần dùng. Phiên không "ghi nhớ" hết hạn sau
// REFRESH_TOKEN_TTL không hoạt động; phiên "ghi nhớ" / client API sau
// REFRESH_TOKEN_TTL_REMEMBER. SESSION_MAX_AGE: tuổi thọ tối đa 1 phiên dù có
// làm mới liên tục (buộc đăng nhập lại định kỳ).
const ACCESS_TTL_MS = parseDuration(process.env.ACCESS_TOKEN_TTL, '15m');
const REFRESH_TTL_MS = parseDuration(process.env.REFRESH_TOKEN_TTL, '12h');
const REFRESH_REMEMBER_TTL_MS = parseDuration(process.env.REFRESH_TOKEN_TTL_REMEMBER, '7d');
const SESSION_MAX_AGE_MS = parseDuration(process.env.SESSION_MAX_AGE, '30d');

// Dấu vân tay của hash mật khẩu hiện tại, nhúng vào token và phiên. Khi mật
// khẩu bị đổi/đặt lại, dấu vân tay thay đổi → token/phiên cũ mất hiệu lực
// ngay. Dùng HMAC để không suy ra được gì từ hash.
function passwordFingerprint(passwordHash) {
	return crypto
		.createHmac('sha256', JWT_SECRET)
		.update(String(passwordHash || ''))
		.digest('base64url')
		.slice(0, 16);
}

function signAccessToken({ id_user, username, pwf, sid }) {
	return jwt.sign({ id_user, username, pwf, sid, typ: 'access' }, JWT_SECRET, {
		algorithm: JWT_ALGORITHM,
		issuer: JWT_ISSUER,
		expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
		jwtid: crypto.randomBytes(12).toString('hex'),
	});
}

// Trả payload hoặc null (sai chữ ký / hết hạn / sai loại token)
function verifyAccessToken(token) {
	try {
		const payload = jwt.verify(token, JWT_SECRET, {
			algorithms: [JWT_ALGORITHM],
			issuer: JWT_ISSUER,
		});
		if (payload.typ !== 'access' || !Number.isInteger(payload.id_user) || !payload.sid)
			return null;
		return payload;
	} catch {
		return null;
	}
}

// Refresh token là chuỗi ngẫu nhiên (không phải JWT) — chỉ có giá trị khi
// khớp hash trong bảng Auth_Sessions, nên thu hồi được tức thì.
function newRefreshToken() {
	return crypto.randomBytes(48).toString('base64url');
}

function hashToken(token) {
	return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newSessionId() {
	return crypto.randomBytes(16).toString('hex');
}

module.exports = {
	JWT_SECRET,
	ACCESS_TTL_MS,
	REFRESH_TTL_MS,
	REFRESH_REMEMBER_TTL_MS,
	SESSION_MAX_AGE_MS,
	passwordFingerprint,
	signAccessToken,
	verifyAccessToken,
	newRefreshToken,
	hashToken,
	newSessionId,
};
