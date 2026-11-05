const { sql } = require('../config/db');
const { isDashboardRole } = require('../middleware/auth');
const {
	ACTION_PERMISSION,
	loadRolePermissions,
	hasPermission,
} = require('./rolePermissions');

// Nạp toàn bộ ngữ cảnh quyền truy cập khoa của 1 user: loại truy cập theo Role
// (all/assigned/own), khoa công tác, bảng quyền (can_edit/can_delete/can_export)
// theo từng khoa được phân, và ma trận quyền của vai trò (Role_Permissions) —
// dùng để kiểm tra quyền trước khi ghi/xoá/xuất dữ liệu khoa trong reports,
// cls-records, tt03, export. Đây là NGUỒN DUY NHẤT về quyền khoa: API
// /users/:id/dept-permissions (client dùng để ẩn/hiện nút) cũng tính từ đây.
async function loadUserDeptAccess(pool, user) {
	const userRes = await pool
		.request()
		.input('id_user', sql.Int, user.id_user).query(`
			SELECT u.id_department, r.id_role, r.department_access_type
			FROM Users u
			INNER JOIN Roles r ON r.id_role = u.id_role
			WHERE u.id_user = @id_user AND u.status = 'active'
		`);

	if (!userRes.recordset.length) return null;
	const {
		id_department: ownDepartment,
		id_role,
		department_access_type: accessType,
	} = userRes.recordset[0];

	const [assignedRes, rolePerms] = await Promise.all([
		// Vai trò "own" chỉ làm việc với khoa công tác — bỏ qua khoa được phân
		accessType === 'own'
			? Promise.resolve({ recordset: [] })
			: pool.request().input('id_user', sql.Int, user.id_user).query(`
				SELECT uda.id_department,
					COALESCE(udp.can_edit,   true)  AS can_edit,
					COALESCE(udp.can_delete, false) AS can_delete,
					COALESCE(udp.can_export, true)  AS can_export
				FROM User_Department_Access uda
				LEFT JOIN User_Dept_Permissions udp
					ON udp.id_department = uda.id_department AND udp.id_user = uda.id_user
				WHERE uda.id_user = @id_user
			`),
		loadRolePermissions(pool, id_role),
	]);

	const permsByDept = new Map();
	for (const row of assignedRes.recordset) {
		permsByDept.set(row.id_department, {
			can_edit: !!row.can_edit,
			can_delete: !!row.can_delete,
			can_export: !!row.can_export,
		});
	}

	// Khoa công tác mặc định có quyền sửa (và xuất, trừ vai trò "own"), trừ
	// khi đã có bản ghi quyền riêng (User_Dept_Permissions) ghi đè.
	if (ownDepartment && !permsByDept.has(ownDepartment)) {
		const own = await pool
			.request()
			.input('id_user', sql.Int, user.id_user)
			.input('id_department', sql.Int, ownDepartment).query(`
				SELECT can_edit, can_delete, can_export FROM User_Dept_Permissions
				WHERE id_user = @id_user AND id_department = @id_department
			`);
		const o = own.recordset[0];
		permsByDept.set(ownDepartment, {
			can_edit: o ? !!o.can_edit : true,
			can_delete: o ? !!o.can_delete : false,
			can_export: o ? !!o.can_export : accessType !== 'own',
		});
	}

	return { accessType, ownDepartment, permsByDept, rolePerms };
}

// Vai trò có được cấp quyền tương ứng với thao tác không (Role_Permissions)
function roleAllows(access, action) {
	const code = ACTION_PERMISSION[action];
	return !code || hasPermission(access?.rolePerms, code);
}

// action: 'can_edit' | 'can_delete' | 'can_export'
function canAccessDept(access, id_department, action) {
	if (!access || !id_department) return false;
	if (!roleAllows(access, action)) return false;
	if (access.accessType === 'all') return true;
	const perm = access.permsByDept.get(Number(id_department));
	return !!perm?.[action];
}

// Thao tác trên dữ liệu TOÀN bệnh viện (vd xuất báo cáo gộp mọi khoa)
function canAccessAllDepts(access, action) {
	return !!access && access.accessType === 'all' && roleAllows(access, action);
}

// ── Quyền XEM dữ liệu khoa ─────────────────────────────────────
// Trả về null nếu user được xem toàn bệnh viện (3 vai trò dashboard hoặc
// role có department_access_type = 'all'), ngược lại trả về Set id các khoa
// được xem (khoa công tác + khoa được phân). User không còn active → Set rỗng.
async function loadReadScope(pool, user) {
	if (isDashboardRole(user)) return null;
	const access = await loadUserDeptAccess(pool, user);
	if (!access) return new Set();
	if (access.accessType === 'all') return null;
	return new Set(access.permsByDept.keys());
}

function canReadDept(scope, id_department) {
	return scope === null || scope.has(Number(id_department));
}

// Lọc danh sách bản ghi chỉ giữ các khoa user được xem
function filterByReadScope(scope, rows, key = 'id_department') {
	return scope === null ? rows : rows.filter((r) => scope.has(Number(r[key])));
}

module.exports = {
	loadUserDeptAccess,
	canAccessDept,
	canAccessAllDepts,
	loadReadScope,
	canReadDept,
	filterByReadScope,
};
