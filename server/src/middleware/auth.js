const crypto = require('crypto');
const jwt = require('jsonwebtoken');

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
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

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

// Xác thực JWT — chấp nhận token qua header "Authorization: Bearer <token>"
// hoặc query "?token=" (dùng cho EventSource, vốn không set được custom header).
function authenticate(req, res, next) {
	const header = req.headers.authorization || '';
	const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
	const token = bearerToken || req.query.token;

	if (!token) {
		return res
			.status(401)
			.json({ success: false, message: 'Thiếu token xác thực' });
	}

	try {
		req.user = jwt.verify(token, JWT_SECRET);
		next();
	} catch {
		return res
			.status(401)
			.json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
	}
}

// Chỉ cho phép đúng vai trò "Quản trị hệ thống"
function requireAdmin(req, res, next) {
	if (req.user?.name_role !== ADMIN_ROLE_NAME) {
		return res
			.status(403)
			.json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
	}
	next();
}

// Cho phép 3 vai trò quản trị dashboard (quản lý tài khoản/khoa/vai trò)
function requireDashboardRole(req, res, next) {
	if (!DASHBOARD_ROLE_NAMES.includes(req.user?.name_role)) {
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
		if (
			DASHBOARD_ROLE_NAMES.includes(req.user?.name_role) ||
			req.user?.id_user === targetId
		) {
			return next();
		}
		return res
			.status(403)
			.json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
	};
}

module.exports = {
	JWT_SECRET,
	ADMIN_ROLE_NAME,
	DASHBOARD_ROLE_NAMES,
	authenticate,
	requireAdmin,
	requireDashboardRole,
	requireSelfOrAdmin,
};
