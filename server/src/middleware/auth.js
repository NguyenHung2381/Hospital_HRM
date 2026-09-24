const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/db');
const { readSessionCookie } = require('../utils/sessionCookie');

// KHÔNG được fallback về 1 chuỗi cố định — nếu thiếu, kẻ tấn công biết trước
// giá trị mặc định có thể tự ký JWT hợp lệ (kể cả token admin) mà không cần
// đăng nhập. Production bắt buộc phải cấu hình JWT_SECRET; môi trường khác
// (dev/local) tự sinh secret ngẫu nhiên mỗi lần khởi động — token cũ sẽ mất
// hiệu lực sau mỗi lần restart, nhưng không bao giờ dùng giá trị đoán được.
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
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// Vai trò "Quản trị hệ thống" — quyền cao nhất, khớp CoordinationPage.tsx
// (client chỉ cho riêng role này quản lý điều phối nhân lực giữa các khoa).
const ADMIN_ROLE_NAME = 'Quản trị hệ thống';

// 3 vai trò được vào Dashboard (đăng nhập trang quản trị: tài khoản, khoa,
// vai trò, báo cáo...) — khớp DASHBOARD_ROLES ở client/src/context/AuthRoles.ts.
const DASHBOARD_ROLE_NAMES = [
	'Quản trị hệ thống',
	'Giám đốc',
	'Điều dưỡng trưởng BV',
];

// Dấu vân tay của hash mật khẩu hiện tại, nhúng vào token. Khi mật khẩu bị
// đổi/đặt lại, dấu vân tay thay đổi → mọi token cũ (kể cả token bị lộ) mất
// hiệu lực ngay, không phải chờ hết hạn. Dùng HMAC để token không chứa bất
// kỳ thông tin nào suy ra được từ hash.
function passwordFingerprint(passwordHash) {
	return crypto
		.createHmac('sha256', JWT_SECRET)
		.update(String(passwordHash || ''))
		.digest('base64url')
		.slice(0, 16);
}

function signAuthToken(user) {
	return jwt.sign(
		{
			id_user: user.id_user,
			username: user.username,
			pwf: passwordFingerprint(user.password),
		},
		JWT_SECRET,
		{
			algorithm: JWT_ALGORITHM,
			expiresIn: JWT_EXPIRES,
			jwtid: crypto.randomBytes(16).toString('hex'),
		},
	);
}

// ── Thu hồi token khi đăng xuất ────────────────────────────────
// Lưu jti của token đã đăng xuất tới khi token hết hạn, để token (nếu từng
// bị sao chép) không dùng lại được sau khi người dùng bấm Đăng xuất.
// Lưu trong bộ nhớ: restart server thì danh sách mất, nhưng mật khẩu đổi/
// tài khoản khoá vẫn luôn chặn được token cũ (xem passwordFingerprint).
const revokedTokens = new Map(); // jti -> exp (giây)

function revokeToken(token) {
	const payload = jwt.decode(token);
	if (!payload?.jti || !payload.exp) return;
	const nowSec = Date.now() / 1000;
	for (const [jti, exp] of revokedTokens) if (exp < nowSec) revokedTokens.delete(jti);
	revokedTokens.set(payload.jti, payload.exp);
}

function isTokenRevoked(jti) {
	return revokedTokens.has(jti);
}

// ── Nạp trạng thái tài khoản từ DB (có cache ngắn) ─────────────
// Vai trò và trạng thái KHÔNG lấy từ token mà đọc lại từ DB: tài khoản bị
// khoá/xoá hoặc bị hạ quyền sẽ mất quyền ngay (tối đa sau USER_CACHE_TTL_MS),
// thay vì vẫn dùng được token cũ tới 8 tiếng.
const USER_CACHE_TTL_MS = 15 * 1000;
const userCache = new Map(); // id_user -> { user, expiresAt }

async function loadAuthUser(id_user) {
	const now = Date.now();
	const cached = userCache.get(id_user);
	if (cached && cached.expiresAt > now) return cached.user;

	const pool = await getPool();
	const result = await pool.request().input('id_user', sql.Int, id_user).query(`
		SELECT u.id_user, u.username, u.password, u.status, r.id_role, r.name_role
		FROM Users u
		LEFT JOIN Roles r ON r.id_role = u.id_role
		WHERE u.id_user = @id_user
	`);
	const row = result.recordset[0];
	const user =
		row && row.status === 'active'
			? {
					id_user: row.id_user,
					username: row.username,
					id_role: row.id_role,
					name_role: row.name_role,
					pwf: passwordFingerprint(row.password),
				}
			: null;

	if (userCache.size > 5000) userCache.clear();
	userCache.set(id_user, { user, expiresAt: now + USER_CACHE_TTL_MS });
	return user;
}

// Gọi sau khi sửa/xoá tài khoản, đổi vai trò, đổi/đặt lại mật khẩu để quyền
// mới có hiệu lực ngay lập tức.
function invalidateUserCache(id_user) {
	if (id_user === undefined) userCache.clear();
	else userCache.delete(Number(id_user));
}

function unauthorized(res, message = 'Token không hợp lệ hoặc đã hết hạn') {
	return res.status(401).json({ success: false, message });
}

// Xác thực JWT lấy từ cookie phiên HttpOnly (xem utils/sessionCookie.js).
// Trình duyệt tự gửi cookie cho cả fetch lẫn EventSource (SSE), nên không
// cần truyền token qua header hay URL.
function authenticate(req, res, next) {
	const token = readSessionCookie(req);
	if (!token) return unauthorized(res, 'Chưa đăng nhập');

	let payload;
	try {
		payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
	} catch {
		return unauthorized(res);
	}
	if (!Number.isInteger(payload.id_user) || isTokenRevoked(payload.jti))
		return unauthorized(res);

	loadAuthUser(payload.id_user)
		.then((user) => {
			if (!user || user.pwf !== payload.pwf) {
				return unauthorized(res, 'Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại');
			}
			req.user = {
				id_user: user.id_user,
				username: user.username,
				id_role: user.id_role,
				name_role: user.name_role,
			};
			req.sessionToken = token;
			next();
		})
		.catch(next);
}

// ── Chống CSRF ─────────────────────────────────────────────────
// Cookie được trình duyệt tự gửi kèm, nên phải chặn trang web khác "mượn"
// phiên đăng nhập để gửi request ghi dữ liệu. Ngoài SameSite=Strict, mọi
// request thay đổi dữ liệu phải có header X-Requested-With — form HTML của
// trang lạ không đặt được header này, còn fetch từ origin khác sẽ bị CORS
// preflight chặn. Client gắn header tự động (lib/httpInterceptor.ts).
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requireCsrfHeader(req, res, next) {
	if (SAFE_METHODS.has(req.method)) return next();
	if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
		return res
			.status(403)
			.json({ success: false, message: 'Yêu cầu không hợp lệ (thiếu header chống CSRF)' });
	}
	next();
}

function isAdmin(user) {
	return user?.name_role === ADMIN_ROLE_NAME;
}

function isDashboardRole(user) {
	return DASHBOARD_ROLE_NAMES.includes(user?.name_role);
}

// Chỉ cho phép đúng vai trò "Quản trị hệ thống"
function requireAdmin(req, res, next) {
	if (!isAdmin(req.user)) {
		return res
			.status(403)
			.json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
	}
	next();
}

// Cho phép 3 vai trò quản trị dashboard (quản lý tài khoản/khoa/vai trò)
function requireDashboardRole(req, res, next) {
	if (!isDashboardRole(req.user)) {
		return res
			.status(403)
			.json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
	}
	next();
}

// Cho phép chính chủ tài khoản (:id trùng id_user trong token) hoặc 1 trong
// 3 vai trò quản trị dashboard (cần xem/sửa dữ liệu tài khoản khác khi quản lý)
function requireSelfOrAdmin(paramName = 'id') {
	return (req, res, next) => {
		const targetId = Number(req.params[paramName]);
		if (isDashboardRole(req.user) || req.user?.id_user === targetId) {
			return next();
		}
		return res
			.status(403)
			.json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
	};
}

// Chỉ cho phép đúng chính chủ tài khoản
function requireSelf(paramName = 'id') {
	return (req, res, next) => {
		if (req.user?.id_user === Number(req.params[paramName])) return next();
		return res
			.status(403)
			.json({ success: false, message: 'Bạn chỉ được thao tác trên tài khoản của chính mình' });
	};
}

module.exports = {
	JWT_SECRET,
	ADMIN_ROLE_NAME,
	DASHBOARD_ROLE_NAMES,
	signAuthToken,
	revokeToken,
	isTokenRevoked,
	invalidateUserCache,
	loadAuthUser,
	authenticate,
	requireCsrfHeader,
	isAdmin,
	isDashboardRole,
	requireAdmin,
	requireDashboardRole,
	requireSelfOrAdmin,
	requireSelf,
};
