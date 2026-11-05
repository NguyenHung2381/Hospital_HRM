import type { RoleType } from '@/types/commonType';
import type { ReportConfig } from '@/types/reportType';
import { toLocalYMD } from '@/utils/dateUtils';

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
	blue: { bg: 'var(--color-info-bg)', text: 'var(--color-info)', border: 'var(--color-info-border)' },
	teal: { bg: 'var(--teal-l)', text: 'var(--teal)', border: '#5eead4' },
	green: { bg: 'var(--color-primary-border)', text: 'var(--pd)', border: 'var(--color-primary-border)' },
	purple: { bg: 'var(--purple-l)', text: 'var(--purple)', border: '#c4b5fd' },
	orange: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', border: 'var(--color-warning-border)' },
	red: { bg: 'var(--color-error-bg)', text: 'var(--color-error-dark)', border: 'var(--color-error-border)' },
	gray: { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)', border: 'var(--color-gray-300)' },
};

export const COLOR_OPTIONS = Object.keys(COLOR_MAP);

// ── Config mặc định trang Báo cáo ─────────────────────────
export const defaultReportConfig = (): ReportConfig => ({
	rScope: 'all',
	rKhoa: 'all',
	rFrom: toLocalYMD(new Date(Date.now() - 7 * 86_400_000)),
	rTo: toLocalYMD(new Date()),
});

/** Interceptor phát sự kiện này khi server trả 403 PASSWORD_CHANGE_REQUIRED */
export const PASSWORD_CHANGE_REQUIRED_EVENT = 'hrm:password-change-required';
