const { getPool, sql } = require('../config/db');
const { readSessionCookie } = require('../utils/sessionCookie');
const { JWT_SECRET, passwordFingerprint, verifyAccessToken } = require('../utils/tokens');
const { isSessionActive, touchSession } = require('../services/sessions');

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

// ── Nạp trạng thái tài khoản từ DB (có cache ngắn) ─────────────
// Vai trò và trạng thái KHÔNG lấy từ token mà đọc lại từ DB: tài khoản bị
// khoá/xoá hoặc bị hạ quyền sẽ mất quyền ngay (tối đa sau USER_CACHE_TTL_MS).
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

function unauthorized(res, message = 'Token không hợp lệ hoặc đã hết hạn', code = 'TOKEN_INVALID') {
	return res.status(401).json({ success: false, code, message });
}

// "Authorization: Bearer <token>" → token (client API: Postman, app, hệ thống khác)
function readBearerToken(req) {
	const header = req.get('Authorization');
	if (!header) return null;
	const m = /^Bearer\s+(\S+)$/i.exec(header);
	return m ? m[1] : '';
}

// Chỉ cập nhật last_used_at của phiên tối đa 1 lần / phút / phiên
const TOUCH_INTERVAL_MS = 60 * 1000;
const lastTouched = new Map();

function touchLater(sid) {
	const now = Date.now();
	if ((lastTouched.get(sid) || 0) > now - TOUCH_INTERVAL_MS) return;
	if (lastTouched.size > 10000) lastTouched.clear();
	lastTouched.set(sid, now);
	touchSession(sid).catch(() => {});
}

// Xác thực access token — 2 nguồn:
//  - header Authorization: Bearer (client API). Có header này thì KHÔNG đọc
//    cookie, để request mang header lạ không "mượn" được cookie phiên.
//  - cookie HttpOnly hrm_session (web; trình duyệt tự gửi cho cả fetch lẫn SSE).
// Sau chữ ký còn kiểm tra: tài khoản còn hoạt động, mật khẩu chưa đổi, phiên
// (sid) chưa bị thu hồi / đăng xuất.
function authenticate(req, res, next) {
	const bearer = readBearerToken(req);
	const via = bearer !== null ? 'bearer' : 'cookie';
	const token = bearer !== null ? bearer : readSessionCookie(req);
	if (!token) return unauthorized(res, 'Chưa đăng nhập', 'NO_TOKEN');

	const payload = verifyAccessToken(token);
	if (!payload) return unauthorized(res, 'Token không hợp lệ hoặc đã hết hạn', 'TOKEN_EXPIRED');

	Promise.all([loadAuthUser(payload.id_user), isSessionActive(payload.sid)])
		.then(([user, sessionActive]) => {
			if (!user || user.pwf !== payload.pwf || !sessionActive) {
				return unauthorized(
					res,
					'Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại',
					'SESSION_REVOKED',
				);
			}
			req.user = {
				id_user: user.id_user,
				username: user.username,
				id_role: user.id_role,
				name_role: user.name_role,
			};
			req.auth = { sid: payload.sid, pwf: payload.pwf, via, exp: payload.exp };
			touchLater(payload.sid);
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
// Miễn kiểm tra cho request dùng Bearer token và các endpoint cấp token API:
// chúng không dựa vào cookie nên không có rủi ro CSRF.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set(['/auth/token', '/auth/token/refresh', '/auth/token/revoke']);

function requireCsrfHeader(req, res, next) {
	if (SAFE_METHODS.has(req.method)) return next();
	if (readBearerToken(req) !== null || CSRF_EXEMPT_PATHS.has(req.path)) return next();
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
