const { sql } = require('../config/db');

// Nạp toàn bộ ngữ cảnh quyền truy cập khoa của 1 user: loại truy cập theo Role
// (all/assigned/own), khoa công tác, và bảng quyền (can_edit/can_delete/can_export)
// theo từng khoa được phân — dùng để kiểm tra quyền trước khi ghi/xoá dữ liệu
// khoa trong reports, cls-records, coordination.
async function loadUserDeptAccess(pool, user) {
	const userRes = await pool
		.request()
		.input('id_user', sql.Int, user.id_user).query(`
			SELECT u.id_department, r.department_access_type
			FROM Users u
			INNER JOIN Roles r ON r.id_role = u.id_role
			WHERE u.id_user = @id_user AND u.status = 'active'
		`);

	if (!userRes.recordset.length) return null;
	const { id_department: ownDepartment, department_access_type: accessType } =
		userRes.recordset[0];

	const assignedRes = await pool
		.request()
		.input('id_user', sql.Int, user.id_user).query(`
			SELECT uda.id_department,
				COALESCE(udp.can_edit,   1) AS can_edit,
				COALESCE(udp.can_delete, 0) AS can_delete,
				COALESCE(udp.can_export, 1) AS can_export
			FROM User_Department_Access uda
			LEFT JOIN User_Dept_Permissions udp
				ON udp.id_department = uda.id_department AND udp.id_user = uda.id_user
			WHERE uda.id_user = @id_user
		`);

	const permsByDept = new Map();
	for (const row of assignedRes.recordset) {
		permsByDept.set(row.id_department, {
			can_edit: !!row.can_edit,
			can_delete: !!row.can_delete,
			can_export: !!row.can_export,
		});
	}

	// Khoa công tác (own) mặc định có quyền sửa/xuất, trừ khi đã có bản ghi
	// quyền riêng (User_Dept_Permissions) ghi đè.
	if (ownDepartment && !permsByDept.has(ownDepartment)) {
		permsByDept.set(ownDepartment, {
			can_edit: true,
			can_delete: false,
			can_export: true,
		});
	}

	return { accessType, ownDepartment, permsByDept };
}

// action: 'can_edit' | 'can_delete' | 'can_export'
function canAccessDept(access, id_department, action) {
	if (!access || !id_department) return false;
	if (access.accessType === 'all') return true;
	const perm = access.permsByDept.get(id_department);
	return !!perm?.[action];
}

module.exports = { loadUserDeptAccess, canAccessDept };
