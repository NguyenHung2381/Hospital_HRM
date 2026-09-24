const { sql } = require('../config/db');
const { ADMIN_ROLE_NAME, DASHBOARD_ROLE_NAMES, isAdmin } = require('../middleware/auth');

// Quyền được xác định theo TÊN vai trò (xem middleware/auth.js), nên phải chặn
// các đường leo thang đặc quyền qua trang quản lý tài khoản / vai trò:
//  - Giám đốc / Điều dưỡng trưởng BV không được tạo, sửa, xoá, đặt lại mật
//    khẩu tài khoản "Quản trị hệ thống", cũng không được gán vai trò đó.
//  - Không ai được tạo vai trò mới hoặc đổi tên vai trò trùng tên 3 vai trò
//    dashboard (sẽ nhận nguyên quyền của vai trò đó).

// Trả về thông báo lỗi nếu actor không được thao tác trên tài khoản target.
function assertCanManageUser(actor, target) {
	if (target?.name_role === ADMIN_ROLE_NAME && !isAdmin(actor))
		return 'Chỉ Quản trị hệ thống mới được thao tác trên tài khoản quản trị';
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
	const name = await getRoleName(pool, id_role);
	if (name === ADMIN_ROLE_NAME && !isAdmin(actor))
		return 'Chỉ Quản trị hệ thống mới được gán vai trò quản trị';
	return null;
}

function normalizeRoleName(name) {
	return String(name ?? '').normalize('NFC').trim().toLowerCase();
}

function isReservedRoleName(name) {
	const n = normalizeRoleName(name);
	return DASHBOARD_ROLE_NAMES.some((r) => normalizeRoleName(r) === n);
}

module.exports = {
	assertCanManageUser,
	assertCanAssignRole,
	isReservedRoleName,
};
