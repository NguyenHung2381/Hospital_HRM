import type { RoleType } from '@/types/commonType';
import type { ReportConfig } from '@/types/reportType';

export const VAI_TRO_LABELS: Record<
	RoleType,
	{ label: string; shortLabel: string; color: string }
> = {
	admin: {
		label: 'Quản trị hệ thống',
		shortLabel: 'Admin',
		color: 'var-red',
	},
	giam_doc: {
		label: 'Giám đốc',
		shortLabel: 'GĐ',
		color: 'var-blue',
	},
	dieu_duong_truong: {
		label: 'Điều dưỡng trưởng BV',
		shortLabel: 'ĐDT BV',
		color: 'var-purple',
	},
	ddt_khoa: {
		label: 'Điều dưỡng trưởng khoa',
		shortLabel: 'ĐDT Khoa',
		color: 'var-teal',
	},
	nhan_vien: {
		label: 'Nhân viên',
		shortLabel: 'NV',
		color: 'var-gray',
	},
};

// ── Màu vai trò ───────────────────────────────────────────
export const COLOR_MAP: Record<
	string,
	{ bg: string; text: string; border: string }
> = {
	blue: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
	teal: { bg: '#ccfbf1', text: '#0f766e', border: '#5eead4' },
	green: { bg: '#d3f1df', text: '#087c3b', border: '#6ee7b7' },
	purple: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
	orange: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
	red: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
	gray: { bg: '#f0f4f6', text: '#4a6070', border: '#cbd5dc' },
};

export const COLOR_OPTIONS = Object.keys(COLOR_MAP);

// ── Config mặc định trang Báo cáo ─────────────────────────
export const defaultReportConfig = (): ReportConfig => ({
	rScope: 'all',
	rKhoa: 'all',
	rFrom: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
	rTo: new Date().toISOString().slice(0, 10),
});
