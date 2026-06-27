export const DAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const MONTHS_VI = [
	'Tháng 1',
	'Tháng 2',
	'Tháng 3',
	'Tháng 4',
	'Tháng 5',
	'Tháng 6',
	'Tháng 7',
	'Tháng 8',
	'Tháng 9',
	'Tháng 10',
	'Tháng 11',
	'Tháng 12',
];

export const getTodayDateString = (): string => {
	const d = new Date();
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

export const parseYMDToDate = (dateString: string): Date => {
	const [y, m, d] = dateString.split('-').map(Number);
	return new Date(y, m - 1, d);
};

export const formatDateToVN = (dateString: string): string => {
	if (!dateString) return '';
	// Xử lý cả ISO string "2026-03-18T00:00:00.000Z" lẫn "2026-03-18"
	const ymd = dateString.slice(0, 10);
	const dt = parseYMDToDate(ymd);
	const dayName = DAYS_VI[dt.getDay()];
	const dd = String(dt.getDate()).padStart(2, '0');
	const mm = String(dt.getMonth() + 1).padStart(2, '0');
	const yyyy = dt.getFullYear();

	return `${dayName}, ${dd}/${mm}/${yyyy}`;
};

export const getTodayDateStringVNLong = (): string => {
	return new Date().toLocaleDateString('vi-VN', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};

export const formatShortDay = (dateString: string): string => {
	const d = new Date(dateString + 'T00:00:00');
	return DAYS_VI[d.getDay()];
};

export const diffDays = (from: string, to: string): number => {
	return Math.max(
		0,
		Math.round(
			(new Date(to).getTime() - new Date(from).getTime()) / 86_400_000,
		) + 1,
	);
};

export const fmtUpdatedAt = (iso: string | null | undefined): string => {
	if (!iso) return '—';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '—';
	return d.toLocaleString('vi-VN', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

export const getNextAvailableDate = (existingDates: string[]): string => {
	const existingSet = new Set(existingDates);
	const d = new Date();
	for (let i = 0; i <= 365; i++) {
		const candidate = d.toISOString().slice(0, 10);
		if (!existingSet.has(candidate)) return candidate;
		d.setDate(d.getDate() + 1);
	}
	// getTodayDateString() đã có sẵn trong dateUtils.ts
	return getTodayDateString();
};

// Thêm vào utils/dateUtils.ts
export const validateRecordDate = (
	dateStr: string,
	existingDates: string[],
): string => {
	if (!dateStr) return 'Vui lòng chọn ngày';
	const todayStr = new Date().toISOString().slice(0, 10);
	if (dateStr < todayStr)
		return 'Không thể thêm bản ghi cho ngày trong quá khứ';
	if (new Set(existingDates).has(dateStr))
		return 'Ngày này đã có bản ghi, vui lòng chọn ngày khác';
	return '';
};
