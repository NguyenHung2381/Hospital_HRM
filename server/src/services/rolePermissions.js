const { getPool, sql } = require('../config/db');

// Ma trận quyền theo vai trò (bảng Role_Permissions, trang "Phân quyền").
// Trước đây bảng này chỉ hiển thị ở giao diện, server không đọc → bỏ quyền
// "Xoá bản ghi" / "Xuất báo cáo"... của 1 vai trò nhưng gọi API thẳng vẫn làm
// được. Giờ server kiểm tra quyền ở đây.
//
// Vai trò hệ thống (is_system — Quản trị hệ thống, Giám đốc) không sửa được
// ma trận quyền trên giao diện → luôn được đủ quyền. Vai trò khác: chỉ quyền
// có dòng is_granted = true (vai trò mới chưa lưu ma trận = không có quyền).
// Quyền xem dữ liệu (view_*) đi theo department_access_type, không xét ở đây.

const CACHE_TTL_MS = 15 * 1000;
const cache = new Map(); // id_role -> { perms, expiresAt }

// Quyền thao tác dữ liệu khoa (User_Dept_Permissions) ↔ quyền vai trò tương ứng
const ACTION_PERMISSION = {
	can_edit: 'edit_daily_data',
	can_delete: 'delete_record',
	can_export: 'export_report',
};

// Trả về null nếu vai trò có toàn quyền, ngược lại Set mã quyền được cấp.
async function loadRolePermissions(pool, id_role) {
	if (id_role == null) return new Set();
	const now = Date.now();
	const cached = cache.get(id_role);
	if (cached && cached.expiresAt > now) return cached.perms;

	const db = pool || (await getPool());
	const [roleRes, permRes] = await Promise.all([
		db.request().input('id_role', sql.Int, id_role)
			.query(`SELECT is_system FROM Roles WHERE id_role = @id_role`),
		db.request().input('id_role', sql.Int, id_role).query(`
			SELECT p.code_permission
			FROM Role_Permissions rp
			INNER JOIN Permissions p ON p.id_permission = rp.id_permission
			WHERE rp.id_role = @id_role AND rp.is_granted = true
		`),
	]);
	const role = roleRes.recordset[0];
	const perms = !role
		? new Set()
		: role.is_system
			? null
			: new Set(permRes.recordset.map((r) => r.code_permission));

	if (cache.size > 1000) cache.clear();
	cache.set(id_role, { perms, expiresAt: now + CACHE_TTL_MS });
	return perms;
}

function hasPermission(perms, code) {
	return perms === null || !!perms?.has(code);
}

// Gọi sau khi sửa vai trò / ma trận quyền để có hiệu lực ngay.
function invalidateRolePermissionCache() {
	cache.clear();
}

module.exports = {
	ACTION_PERMISSION,
	loadRolePermissions,
	hasPermission,
	invalidateRolePermissionCache,
};
