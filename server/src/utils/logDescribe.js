// Diễn giải dòng log thô thành thông tin nghiệp vụ dễ đọc cho trang Nhật ký
// hệ thống: thuộc phân hệ nào, là loại thao tác gì, mô tả tiếng Việt.

const MODULE_LABELS = {
	auth: 'Đăng nhập / phiên',
	sessions: 'Phiên đăng nhập',
	users: 'Tài khoản',
	departments: 'Khoa / Phòng',
	roles: 'Phân quyền',
	permissions: 'Phân quyền',
	reports: 'Báo cáo',
	tt03: 'Cấu hình TT03',
	coordination: 'Điều phối nhân lực',
	logs: 'Nhật ký hệ thống',
	system: 'Hệ thống',
	other: 'Khác',
};

// Hành động được controller ghi rõ qua audit(req, action) — ưu tiên hơn loại
// suy ra từ HTTP method.
const ACTION_LABELS = {
	'auth.login': 'Đăng nhập',
	'auth.login_failed': 'Đăng nhập thất bại',
	'auth.logout': 'Đăng xuất',
	'auth.logout_all': 'Đăng xuất thiết bị khác',
	'auth.login_blocked_locked': 'Đăng nhập khi tài khoản đang khoá',
	'security.login_2fa_failed': 'Sai mã xác thực 2 lớp',
	'security.login_locked': 'Khoá tạm tài khoản',
	'security.device_untrusted': 'Bỏ tin cậy thiết bị',
	'security.2fa_enabled': 'Bật xác thực 2 lớp',
	'security.2fa_disabled': 'Tắt xác thực 2 lớp',
	'security.2fa_reset_by_admin': 'Đặt lại xác thực 2 lớp',
	'security.password_changed': 'Đổi mật khẩu',
	'security.password_reset_by_admin': 'Đặt lại mật khẩu',
	'security.session_revoked': 'Đăng xuất thiết bị khác',
	'security.logout_all_sessions': 'Đăng xuất mọi thiết bị khác',
	'session.revoke': 'Thu hồi phiên đăng nhập',
	'session.revoke_user': 'Thu hồi mọi phiên của tài khoản',
	'user.reset_password': 'Đặt lại mật khẩu',
	'user.change_password': 'Đổi mật khẩu',
	'system.error': 'Lỗi hệ thống',
	view: 'Xem',
	create: 'Thêm mới',
	update: 'Cập nhật',
	delete: 'Xoá',
	export: 'Xuất Excel',
	denied: 'Bị từ chối quyền',
};

// Nhóm hành động — dùng cho bộ lọc "loại thao tác" và thống kê.
function actionKind(action) {
	if (!action) return 'other';
	if (action === 'auth.login') return 'login';
	if (
		action === 'auth.login_failed' ||
		action === 'auth.login_blocked_locked' ||
		action === 'security.login_2fa_failed'
	)
		return 'login_failed';
	if (action.startsWith('auth.') || action.startsWith('session.') || action.startsWith('security.'))
		return 'auth';
	if (action.startsWith('user.')) return 'update';
	if (action === 'system.error') return 'error';
	return action; // view | create | update | delete | export | denied
}

// /api/users/:id/reset-password → users
function moduleOf(pathOrRoute) {
	const seg = String(pathOrRoute || '')
		.replace(/^\/api\/?/, '')
		.split(/[/?]/)[0];
	if (seg === 'health') return 'system';
	return MODULE_LABELS[seg] ? seg : 'other';
}

function methodVerb(method, route) {
	if (method === 'GET' || method === 'HEAD') return /export/.test(route || '') ? 'export' : 'view';
	if (method === 'POST') return 'create';
	if (method === 'DELETE') return 'delete';
	return 'update';
}

function describe(o) {
	const module = o.module || moduleOf(o.route || o.path);
	const action = o.action || (o.method ? methodVerb(o.method, o.route || o.path) : null);
	const kind = actionKind(action);
	const label = ACTION_LABELS[action] ?? action ?? '—';
	return {
		module,
		module_label: MODULE_LABELS[module] ?? module,
		action,
		action_kind: kind,
		action_label: label,
		summary: `${label} · ${MODULE_LABELS[module] ?? module}`,
	};
}

// ::ffff:10.0.0.1 → 10.0.0.1
function normalizeIp(ip) {
	if (!ip) return null;
	const s = String(ip).trim();
	return s.startsWith('::ffff:') ? s.slice(7) : s;
}

module.exports = { describe, moduleOf, methodVerb, normalizeIp, MODULE_LABELS, ACTION_LABELS };
