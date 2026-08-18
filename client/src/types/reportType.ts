// types/reportType.ts

import type { RecommendedFormulaType } from './commonType';

export interface ReportConfig {
	/** Phạm vi xuất: toàn viện (2 file) · chỉ khối nội trú · chỉ hệ CLS · 1 khoa nội trú */
	rScope: 'all' | 'ward' | 'cls' | 'one';
	rKhoa: string;
	rFrom: string;
	rTo: string;
}

export interface KhoaRecord {
	tt: number;
	id_department: number;
	ten: string;
	giuong: number | null;
	csc1: number | null;
	csc2: number | null;
	csc3: number | null;
	tongNB: number | null;
	nbKhamPT: number | null;
	nlTong: number | null;
	nghiTruc: number | null;
	nghiTren2: number | null;
	diLam: number | null;

	/**
	 * Cột M — Nhân lực theo TT03
	 * Công thức: (Tổng NB × ratio) / shiftDivisor × shiftMultiplier [+ fixedAdd]
	 * Giá trị raw float, KHÔNG làm tròn
	 */
	tt03: number | null;

	/**
	 * Cột N — Nhân lực khuyến nghị
	 * Công thức: L1×coef_l1 + L2×coef_l2 + L3×coef_l3 + fixedAdd
	 * Giá trị raw float, KHÔNG làm tròn
	 * null nếu khoa chưa có cấu hình Dept_Recommended_Config
	 */
	khuyenNghi: number | null;

	/**
	 * Giá trị dùng để tính điều phối:
	 * = khuyenNghi nếu có, fallback về tt03
	 * Giá trị raw float, KHÔNG làm tròn
	 */
	khuyenCao: number | null;

	/** diLam - khuyenCao (raw, không làm tròn) */
	dieuPhoi: number | null;

	/** Loại công thức khuyến nghị đã áp dụng */
	recFormulaType?: RecommendedFormulaType | null;

	ghiChu: string | null;
}

export interface DateRecord {
	date: string;
	data: KhoaRecord[];
}
