import type { RoleType } from '@/types/commonType';
import type { ReportConfig } from '@/types/reportType';
import type { VaiTroItem } from '@/types/userType';

export const VAI_TRO_LABELS: Record<
	RoleType,
	{ label: string; shortLabel: string; color: string; icon: string }
> = {
	admin: {
		label: 'Quản trị hệ thống',
		shortLabel: 'Admin',
		color: 'var-red',
		icon: '🔑',
	},
	giam_doc: {
		label: 'Giám đốc',
		shortLabel: 'GĐ',
		color: 'var-blue',
		icon: '👔',
	},
	dieu_duong_truong: {
		label: 'Điều dưỡng trưởng BV',
		shortLabel: 'ĐDT BV',
		color: 'var-purple',
		icon: '🏥',
	},
	ddt_khoa: {
		label: 'Điều dưỡng trưởng khoa',
		shortLabel: 'ĐDT Khoa',
		color: 'var-teal',
		icon: '🩺',
	},
	nhan_vien: {
		label: 'Nhân viên',
		shortLabel: 'NV',
		color: 'var-gray',
		icon: '👤',
	},
};

// ── Phân quyền ────────────────────────────────────────────────────────
export const ALL_QUYEN = [
	'Xem dữ liệu khoa được phân',
	'Nhập / sửa dữ liệu ngày',
	'Xoá bản ghi',
	'Xem dữ liệu tất cả khoa',
	'Sửa thông tin khoa',
	'Quản lý tài khoản',
	'Phân quyền',
	'Xuất báo cáo',
	'Quản lý khoa phòng',
];

export const VAI_TRO_RANK: Record<RoleType, number> = {
	admin: 1,
	giam_doc: 2,
	dieu_duong_truong: 3,
	ddt_khoa: 4,
	nhan_vien: 5,
};

export const INIT_VAI_TRO: VaiTroItem[] = [
	{
		id: 1,
		ten: 'Quản trị hệ thống',
		moTa: 'Xem toàn bộ tất cả các khoa',
		icon: '👔',
		mauSac: 'blue',
		isSystem: true,
		loaiKhoaAccess: 'all',
		quyen: Object.fromEntries(ALL_QUYEN.map((q) => [q, true])),
		khoaDuocPhep: [], // không cần – loaiKhoaAccess = 'all'
	},
	{
		id: 2,
		ten: 'Giám đốc',
		moTa: 'Xem toàn bộ tất cả các khoa',
		icon: '👔',
		mauSac: 'teal',
		isSystem: true,
		loaiKhoaAccess: 'all',
		quyen: Object.fromEntries(ALL_QUYEN.map((q) => [q, true])),
		khoaDuocPhep: [], // không cần – loaiKhoaAccess = 'all'
	},
	{
		id: 3,
		ten: 'Điều dưỡng trưởng',
		moTa: 'Xem các khoa được Admin phân quyền',
		icon: '🩺',
		mauSac: 'green',
		isSystem: false,
		loaiKhoaAccess: 'assigned',
		quyen: {
			'Xem dữ liệu khoa của mình': false,
			'Xem dữ liệu khoa được phân': true,
			'Xem dữ liệu tất cả khoa': false,
			'Nhập / sửa dữ liệu ngày': true,
			'Xoá bản ghi': false,
			'Sửa thông tin khoa': false,
			'Quản lý tài khoản': false,
			'Phân quyền': false,
			'Xuất báo cáo': true,
			'Quản lý khoa phòng': false,
		},
		khoaDuocPhep: [1, 2, 5], // phân quyền cụ thể cho từng người
	},
	{
		id: 4,
		ten: 'Điều dưỡng trưởng khoa',
		moTa: 'Xem các khoa được Admin phân quyền',
		icon: '🩺',
		mauSac: 'purple',
		isSystem: false,
		loaiKhoaAccess: 'assigned',
		quyen: {
			'Xem dữ liệu khoa của mình': false,
			'Xem dữ liệu khoa được phân': true,
			'Xem dữ liệu tất cả khoa': false,
			'Nhập / sửa dữ liệu ngày': true,
			'Xoá bản ghi': false,
			'Sửa thông tin khoa': false,
			'Quản lý tài khoản': false,
			'Phân quyền': false,
			'Xuất báo cáo': true,
			'Quản lý khoa phòng': false,
		},
		khoaDuocPhep: [1, 2, 5], // phân quyền cụ thể cho từng người
	},
	{
		id: 5,
		ten: 'Nhân viên',
		moTa: 'Chỉ xem khoa đang công tác của mình',
		icon: '👤',
		mauSac: 'gray',
		isSystem: false,
		loaiKhoaAccess: 'own',
		quyen: {
			'Xem dữ liệu khoa của mình': true,
			'Xem dữ liệu khoa được phân': false,
			'Xem dữ liệu tất cả khoa': false,
			'Nhập / sửa dữ liệu ngày': false,
			'Xoá bản ghi': false,
			'Sửa thông tin khoa': false,
			'Quản lý tài khoản': false,
			'Phân quyền': false,
			'Xuất báo cáo': false,
			'Quản lý khoa phòng': false,
		},
		khoaDuocPhep: [], // không cần – loaiKhoaAccess = 'own'
	},
];

export const COLOR_MAP: Record<
	string,
	{ bg: string; text: string; border: string }
> = {
	blue: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
	teal: { bg: '#ccfbf1', text: '#0f766e', border: '#5eead4' },
	green: { bg: '#d1fae5', text: '#065f2b', border: '#6ee7b7' },
	purple: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
	orange: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
	red: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
	gray: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
};

export const COLOR_OPTIONS = Object.keys(COLOR_MAP);

export const QUYEN_GROUPS: { nhom: string; icon: string; items: string[] }[] = [
	{
		nhom: 'Xem dữ liệu',
		icon: '👁️',
		items: [
			'Xem dữ liệu khoa của mình',
			'Xem dữ liệu các khoa được phân',
			'Xem dữ liệu toàn viện',
		],
	},
	{
		nhom: 'Thao tác dữ liệu',
		icon: '✏️',
		items: ['Nhập / sửa dữ liệu ngày', 'Xoá bản ghi', 'Xuất báo cáo'],
	},
	{
		nhom: 'Quản trị hệ thống',
		icon: '⚙️',
		items: [
			'Quản lý tài khoản',
			'Phân quyền vai trò',
			'Quản lý khoa phòng',
			'Cấu hình hệ thống',
		],
	},
];

// ── Dữ liệu Excel (37 Khoa) ──────────────────────────────────────────

// export const DRAFT_KHOA_DEFAULT: Omit<Department, 'id'> = {
// 	ten: '',
// 	giuong: null,
// 	heSo: { cap1: 0.5, cap2: 0.104, cap3: 0.104, tong: 0.12 },
// 	tongNhanLuc: null,
// 	trangThai: 'active',
// };

export const HE_SO_INFO = [
	{
		key: 'cap1' as const,
		label: 'HS Cấp 1 (CSC1)',
		hint: 'NB nặng, nguy kịch',
	},
	{ key: 'cap2' as const, label: 'HS Cấp 2 (CSC2)', hint: 'NB trung bình' },
	{ key: 'cap3' as const, label: 'HS Cấp 3 (CSC3)', hint: 'NB nhẹ' },
	{ key: 'tong' as const, label: 'HS Tổng NB', hint: 'Tổng người bệnh' },
];

// ── Types ─────────────────────────────────────────────────

// ── Loại báo cáo ──────────────────────────────────────────
export const REPORT_TYPES: { value: ReportConfig['rType']; label: string }[] = [
	{ value: 'daily', label: 'Báo cáo theo ngày' },
	{ value: 'weekly', label: 'Báo cáo theo tuần' },
	{ value: 'monthly', label: 'Báo cáo theo tháng' },
	{ value: 'custom', label: 'Khoảng thời gian tùy chọn' },
];

// ── Config mặc định ───────────────────────────────────────
export const defaultReportConfig = (): ReportConfig => ({
	rType: 'daily',
	rKhoa: 'all',
	rFrom: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
	rTo: new Date().toISOString().slice(0, 10),
});

// ── Các cột báo cáo (dùng hiển thị preview) ──────────────
export const REPORT_COLS = [
	{ key: 'tongNB', label: 'Tổng NB', color: '#2563eb' },
	{ key: 'nlTong', label: 'Tổng NL', color: '#7c3aed' },
	{ key: 'diLam', label: 'Đi làm', color: '#079341' },
	{ key: 'tt03', label: 'KC TT03', color: '#0d9488' },
	{ key: 'khuyenCao', label: 'Thiếu (KC)', color: '#dc2626' },
] as const;

/** Format số: null → '—', có decimal → rút gọn trailing zeros */
export const n = (v: number | null, dec = 0): string => {
	if (v === null || v === undefined) return '—';
	return dec ? v.toFixed(dec).replace(/\.?0+$/, '') : String(v);
};
