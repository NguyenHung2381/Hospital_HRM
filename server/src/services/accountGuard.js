const { sql } = require('../config/db');
const { DASHBOARD_ROLE_NAMES, isAdmin } = require('../middleware/auth');

// Quyền được xác định theo TÊN vai trò (xem middleware/auth.js), nên phải chặn
// các đường leo thang đặc quyền qua trang quản lý tài khoản / vai trò.
//
// Thứ bậc 3 vai trò dashboard (cao → thấp): Quản trị hệ thống > Giám đốc >
// Điều dưỡng trưởng BV; mọi vai trò khác ở bậc 0. Ngoài Quản trị hệ thống
// (toàn quyền), một tài khoản dashboard chỉ được:
//  - tạo / sửa / xoá / đặt lại mật khẩu / tắt 2FA / phân khoa / phân quyền
//    khoa cho tài khoản có vai trò THẤP HƠN mình (không đụng tài khoản ngang
//    hoặc cao hơn — nếu không, đặt lại mật khẩu là chiếm được tài khoản đó);
//  - gán vai trò THẤP HƠN vai trò của mình (không tự nâng / nâng người khác
//    lên ngang hoặc cao hơn mình);
//  - sửa thông tin của chính mình nhưng KHÔNG tự đổi vai trò, khoa công tác,
//    trạng thái, phân khoa hay quyền khoa của mình;
//  - không sửa vai trò dashboard (đổi department_access_type / quyền của vai
//    trò đó là tự cấp thêm quyền cho chính mình).
// Không ai được tạo vai trò mới hoặc đổi tên vai trò trùng tên 3 vai trò
// dashboard (sẽ nhận nguyên quyền của vai trò đó).

const ROLE_RANK = new Map(
	DASHBOARD_ROLE_NAMES.map((name, i) => [name, DASHBOARD_ROLE_NAMES.length - i]),
);

function roleRank(name_role) {
	return ROLE_RANK.get(name_role) ?? 0;
}

const LOWER_ROLE_ONLY = 'Bạn chỉ được thao tác trên tài khoản có vai trò thấp hơn vai trò của mình';

// Trả về thông báo lỗi nếu actor không được thao tác trên tài khoản target
// (target cần có id_user + name_role). allowSelf: cho phép chính chủ (sửa
// thông tin cá nhân) — các kiểm tra riêng cho chính chủ do nơi gọi đảm nhận.
function assertCanManageUser(actor, target, { allowSelf = false } = {}) {
	if (isAdmin(actor)) return null;
	if (allowSelf && target?.id_user === actor?.id_user) return null;
	if (roleRank(target?.name_role) >= roleRank(actor?.name_role)) return LOWER_ROLE_ONLY;
	return null;
}

async function getRoleName(pool, id_role) {
	if (id_role == null) return null;
	const r = await pool
		.request()
		.input('id_role', sql.Int, id_role)
		.query(`SELECT name_role FROM Roles WHERE id_role = @id_role`);
	return r.recordset[0]?.name_role ?? null;
}

// Trả về thông báo lỗi nếu actor không được gán vai trò id_role cho người khác.
async function assertCanAssignRole(pool, actor, id_role) {
	if (isAdmin(actor)) return null;
	const name = await getRoleName(pool, id_role);
	if (roleRank(name) >= roleRank(actor?.name_role))
		return 'Bạn chỉ được gán vai trò thấp hơn vai trò của mình';
	return null;
}

// Nạp tài khoản đích kèm vai trò (để kiểm tra quyền quản lý), null nếu không có.
async function findUserWithRole(pool, id_user) {
	const r = await pool.request().input('id', sql.Int, id_user).query(`
		SELECT u.id_user, u.username, u.id_role, u.id_department, u.status, r.name_role
		FROM Users u LEFT JOIN Roles r ON r.id_role = u.id_role
		WHERE u.id_user = @id
	`);
	return r.recordset[0] ?? null;
}

function normalizeRoleName(name) {
	return String(name ?? '').normalize('NFC').trim().toLowerCase();
}

function isReservedRoleName(name) {
	const n = normalizeRoleName(name);
	return DASHBOARD_ROLE_NAMES.some((r) => normalizeRoleName(r) === n);
}

module.exports = {
	roleRank,
	assertCanManageUser,
	assertCanAssignRole,
	findUserWithRole,
	isReservedRoleName,
};
