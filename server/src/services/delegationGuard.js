const { sql } = require('../config/db');
const { isAdmin } = require('../middleware/auth');
const { hasPermission, ACTION_PERMISSION } = require('./rolePermissions');
const { loadUserDeptAccess, canAccessDept, canAccessAllDepts } = require('./deptAccess');

// Giới hạn ỦY QUYỀN của tài khoản quản lý không phải Quản trị hệ thống (vd
// "Điều dưỡng trưởng BV" có manage_accounts/manage_roles nhưng chỉ được phân
// một số khoa): chỉ được cấp cho người khác những quyền thao tác dữ liệu khoa
// mà CHÍNH MÌNH đang có. accountGuard.js chỉ so cấp bậc vai trò; thiếu bước
// này thì người quản lý cấp quyền sửa/xoá/xuất khoa khác (hoặc vai trò phạm vi
// "all") cho một tài khoản cấp thấp rồi đặt lại mật khẩu để dùng tài khoản đó.
//
// So sánh quyền THỰC TẾ của tài khoản đích trước và sau khi ghi (tính bằng
// đúng hàm các controller dữ liệu dùng — gồm cả mặc định COALESCE của khoa
// được phân / khoa công tác), chỉ chặn quyền MỚI có thêm. Thu hồi quyền, hay
// sửa tài khoản vốn đã có quyền ngoài phạm vi người sửa, vẫn làm được.
const DATA_ACTIONS = ['can_edit', 'can_delete', 'can_export'];
const DENIED_MESSAGE = 'Không thể cấp quyền thao tác khoa vượt quá quyền của chính bạn';

function rightsOf(access) {
	const rights = new Set();
	if (!access) return rights;
	for (const a of DATA_ACTIONS) if (canAccessAllDepts(access, a)) rights.add(`all:${a}`);
	for (const d of access.permsByDept.keys())
		for (const a of DATA_ACTIONS) if (canAccessDept(access, d, a)) rights.add(`${d}:${a}`);
	return rights;
}

// db: pool hoặc transaction (đọc trạng thái chưa commit của chính transaction)
async function snapshotUserRights(db, id_user) {
	return rightsOf(await loadUserDeptAccess(db, { id_user: Number(id_user) }));
}

// Trả về thông báo lỗi nếu `after` có quyền mới (so với `before`) mà actor
// không có; null nếu hợp lệ.
async function checkGainedRights(pool, actor, before, after) {
	if (isAdmin(actor)) return null;
	const gained = [...after].filter((k) => !before.has(k));
	if (!gained.length) return null;
	const mine = await loadUserDeptAccess(pool, actor);
	for (const key of gained) {
		const [scope, action] = key.split(':');
		const ok =
			scope === 'all' ? canAccessAllDepts(mine, action) : canAccessDept(mine, Number(scope), action);
		if (!ok) return DENIED_MESSAGE;
	}
	return null;
}

// Dòng quyền của khoa CHƯA được phân thì chưa có hiệu lực (checkGainedRights
// không thấy), nhưng sẽ có hiệu lực khi khoa đó được phân sau này → cũng không
// cho bật cờ mà người thao tác không có, trừ cờ đã bật sẵn từ trước (gửi lại
// nguyên danh sách quyền hiện có vẫn được).
async function checkPermissionFlags(pool, actor, id_user, permissions) {
	if (isAdmin(actor)) return null;
	const existing = await pool
		.request()
		.input('id', sql.Int, id_user)
		.query(
			`SELECT id_department, can_edit, can_delete, can_export FROM User_Dept_Permissions WHERE id_user = @id`,
		);
	const prev = new Map(existing.recordset.map((r) => [Number(r.id_department), r]));
	let mine;
	for (const p of permissions) {
		for (const a of DATA_ACTIONS) {
			if (!p[a] || prev.get(Number(p.id_department))?.[a]) continue;
			mine = mine || (await loadUserDeptAccess(pool, actor));
			if (!canAccessDept(mine, Number(p.id_department), a)) return DENIED_MESSAGE;
		}
	}
	return null;
}

// Cấp phạm vi "all" (toàn viện) cho một vai trò: chỉ người cũng có phạm vi "all"
async function checkRoleAccessType(pool, actor, department_access_type) {
	if (isAdmin(actor) || department_access_type !== 'all') return null;
	const mine = await loadUserDeptAccess(pool, actor);
	return mine?.accessType === 'all'
		? null
		: 'Chỉ người có phạm vi toàn viện mới được tạo/sửa vai trò phạm vi toàn viện';
}

// Cấp quyền thao tác dữ liệu (nhập/xoá/xuất) cho một vai trò: chỉ những quyền
// vai trò của chính actor đang có. grantedCodes: mã quyền sẽ được bật.
async function checkRoleDataPermissions(pool, actor, grantedCodes) {
	if (isAdmin(actor)) return null;
	const dataCodes = Object.values(ACTION_PERMISSION).filter((c) => grantedCodes.includes(c));
	if (!dataCodes.length) return null;
	const mine = await loadUserDeptAccess(pool, actor);
	const missing = dataCodes.filter((c) => !hasPermission(mine?.rolePerms, c));
	return missing.length ? 'Không thể cấp cho vai trò quyền thao tác dữ liệu mà bạn không có' : null;
}

module.exports = {
	snapshotUserRights,
	checkGainedRights,
	checkPermissionFlags,
	checkRoleAccessType,
	checkRoleDataPermissions,
	DENIED_MESSAGE,
};
