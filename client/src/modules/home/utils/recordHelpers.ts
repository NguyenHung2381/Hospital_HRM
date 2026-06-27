// src/modules/home/utils/recordHelpers.ts

import type { DailyRecord } from '@/types/staffingType';

/**
 * Hàm tạo bản ghi trống cho một ngày cụ thể
 */
export const createEmptyRecord = (date: string): DailyRecord => ({
	date,
	nb: { cap1: null, cap2: null, cap3: null },
	nbKhamPT: null,
	nl: { tong: null, nghiTruc: null, nghiTren2Ngay: null },
	ghiChu: '',
});

/**
 * Hàm tạo dữ liệu mẫu (mock data) cho 10 ngày gần nhất
 */
export const generateMockRecords = (): DailyRecord[] => {
	const rng = (a: number, b: number) =>
		a + Math.floor(Math.random() * (b - a + 1));

	return Array.from({ length: 10 }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() - (9 - i));
		const tong = rng(8, 14);
		return {
			date: d.toISOString().slice(0, 10),
			nb: { cap1: rng(2, 6), cap2: rng(1, 4), cap3: rng(0, 3) },
			nbKhamPT: rng(1, 8),
			nl: { tong, nghiTruc: rng(0, 2), nghiTren2Ngay: rng(0, 1) },
			ghiChu: i === 9 ? 'Bình thường' : '',
		};
	});
};
