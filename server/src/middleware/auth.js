const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/db');
const { readSessionCookie } = require('../utils/sessionCookie');
const sessionStore = require('../services/sessionStore');

// KHÔNG được fallback về 1 chuỗi cố định hay secret ngẫu nhiên — nếu thiếu,
// kẻ tấn công biết trước giá trị mặc định có thể tự ký JWT hợp lệ (kể cả
// token admin). Giống RMS: thiếu JWT_SECRET thì server không khởi động (kiểm
// tra ở index.js trước khi nạp module này); ở đây kiểm tra lại cho chắc.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
	throw new Error(
		`JWT_SECRET chưa được cấu hình hoặc quá ngắn (< 32 ký tự). Tạo bằng: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
	);
}
const JWT_SECRET = process.env.JWT_SECRET;

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

// Mục đích đặc biệt của token (vd bước trung gian 2FA) — token có "purpose"
// KHÔNG bao giờ được chấp nhận làm phiên đăng nhập.
const PRE_AUTH_2FA_PURPOSE = '2fa_pre_auth';
const PRE_AUTH_2FA_TTL = '5m';

function tokenExpiresAt(token) {
	const { exp } = jwt.decode(token);
	return new Date(exp * 1000);
}

// Tạo phiên đăng nhập mới: ký JWT (jti ngẫu nhiên) + ghi phiên vào
// UserSessions kèm IP/thiết bị. Trả về token để đặt vào cookie HttpOnly.
async function createAuthSession(req, user) {
	const jti = crypto.randomBytes(16).toString('hex');
	const token = jwt.sign(
		{
			id_user: user.id_user,
			username: user.username,
			pwf: passwordFingerprint(user.password),
		},
		JWT_SECRET,
		{
			algorithm: JWT_ALGORITHM,
			expiresIn: JWT_EXPIRES,
			jwtid: jti,
		},
	);
	await sessionStore.createSession({
		jti,
		id_user: user.id_user,
		expiresAt: tokenExpiresAt(token),
		ip: req.ip,
		userAgent: req.get('user-agent'),
	});
	return token;
}

// Token trung gian giữa bước 1 (mật khẩu đúng) và bước 2 (mã OTP) của tài
// khoản đã bật 2FA — không mang quyền truy cập, chỉ xác nhận "đã qua bước mật
// khẩu cho user này" trong 5 phút. Gắn pwf để đổi mật khẩu giữa chừng là vô hiệu.
function signPreAuthToken(user) {
	return jwt.sign(
		{
			sub: String(user.id_user),
			purpose: PRE_AUTH_2FA_PURPOSE,
			pwf: passwordFingerprint(user.password),
		},
		JWT_SECRET,
		{ algorithm: JWT_ALGORITHM, expiresIn: PRE_AUTH_2FA_TTL },
	);
}

// Trả về { id_user, pwf } nếu pre-auth token hợp lệ, ngược lại null.
function verifyPreAuthToken(token) {
	if (typeof token !== 'string' || token.length > 2000) return null;
	try {
		const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
		if (payload.purpose !== PRE_AUTH_2FA_PURPOSE) return null;
		const id_user = Number(payload.sub);
		if (!Number.isInteger(id_user)) return null;
		return { id_user, pwf: payload.pwf };
	} catch {
		return null;
	}
}

// Thu hồi phiên gắn với token (đăng xuất). Token không hợp lệ thì bỏ qua.
async function revokeToken(token) {
	const payload = jwt.decode(token);
	if (!payload?.jti) return;
	await sessionStore.revokeSession(payload.jti, Number.isInteger(payload.id_user) ? payload.id_user : null);
}

// ── Nạp trạng thái tài khoản từ DB (có cache ngắn) ─────────────
// Vai trò và trạng thái KHÔNG lấy từ token mà đọc lại từ DB: tài khoản bị
// vô hiệu hoá (status)/xoá hoặc bị hạ quyền sẽ mất quyền ngay (tối đa sau
// USER_CACHE_TTL_MS), thay vì vẫn dùng được token cũ tới 8 tiếng.
// Cố ý KHÔNG xét locked_until (khoá tạm do đăng nhập sai) — khác RMS: nếu đá
// phiên đang mở ra thì kẻ tấn công chỉ cần cố tình nhập sai mật khẩu là đẩy
// được người dùng thật ra khỏi hệ thống. Khoá tạm chỉ chặn đăng nhập MỚI.
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
	// Token có purpose (vd pre-auth 2FA) không phải phiên đăng nhập
	if (payload.purpose || !Number.isInteger(payload.id_user) || !payload.jti)
		return unauthorized(res);

	Promise.all([
		loadAuthUser(payload.id_user),
		sessionStore.isSessionActive(payload.jti, payload.id_user),
	])
		.then(([user, sessionActive]) => {
			if (!user || user.pwf !== payload.pwf || !sessionActive) {
				return unauthorized(res, 'Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại');
			}
			req.user = {
				id_user: user.id_user,
				username: user.username,
				id_role: user.id_role,
				name_role: user.name_role,
			};
			req.sessionToken = token;
			req.sessionJti = payload.jti;
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
	createAuthSession,
	signPreAuthToken,
	verifyPreAuthToken,
	revokeToken,
	passwordFingerprint,
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
