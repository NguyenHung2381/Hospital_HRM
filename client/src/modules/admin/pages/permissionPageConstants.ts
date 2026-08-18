export const ACCESS_INFO: Record<
	string,
	{ icon: string; text: string; sub: string; color: string; bg: string }
> = {
	all: {
		icon: '🏥',
		text: 'Toàn bộ tất cả các khoa',
		sub: 'Không giới hạn - xem được dữ liệu toàn bệnh viện',
		color: '#1d4ed8',
		bg: '#dbeafe',
	},
	assigned: {
		icon: '🗂️',
		text: 'Các khoa được Admin phân quyền',
		sub: 'Phân khoa cụ thể cho từng người dùng trong trang Tài khoản',
		color: '#0f766e',
		bg: '#ccfbf1',
	},
	own: {
		icon: '👤',
		text: 'Chỉ khoa đang công tác của mình',
		sub: 'Tự động theo trường khoa công tác trong hồ sơ tài khoản',
		color: '#475569',
		bg: '#f1f5f9',
	},
};

// Map department_access_type → code quyền xem tương ứng (chỉ tích 1)
export const VIEW_PERM_MAP: Record<string, string> = {
	all: 'view_all_depts',
	assigned: 'view_assigned_depts',
	own: 'view_own_dept',
};
export const VIEW_PERM_CODES = new Set(Object.values(VIEW_PERM_MAP));
