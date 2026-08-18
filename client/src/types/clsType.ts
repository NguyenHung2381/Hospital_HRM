// types/clsType.ts
// Báo cáo nhân lực hệ Cận lâm sàng (CLS) — theo mẫu
// "12.8. P.ĐD_Biểu mẫu báo nhân lực hệ CLS.xlsx"

/** Khối lượng công việc đã thực hiện (cột C–K trong mẫu) */
export interface ClsWorkload {
	sampleOrVisit: number | null;
	xrayUs: number | null;
	ctEndoscopy: number | null;
	mriBoneDensity: number | null;
	ecgIntervention: number | null;
	linenMedia: number | null;
	toolMetal: number | null;
	toolPlastic: number | null;
	supervisedDept: number | null;
}

/** Số lượng tồn / chờ (cột L–S trong mẫu) — không có "khoa giám sát" */
export interface ClsPending {
	sampleOrVisit: number | null;
	xrayUs: number | null;
	ctEndoscopy: number | null;
	mriBoneDensity: number | null;
	ecgIntervention: number | null;
	linen: number | null;
	toolMetal: number | null;
	toolPlastic: number | null;
}

export interface ClsStaff {
	tong: number | null;
	nghiTruc: number | null;
	nghiTren2Ngay: number | null;
}

export const BLANK_CLS_WORKLOAD: ClsWorkload = {
	sampleOrVisit: null,
	xrayUs: null,
	ctEndoscopy: null,
	mriBoneDensity: null,
	ecgIntervention: null,
	linenMedia: null,
	toolMetal: null,
	toolPlastic: null,
	supervisedDept: null,
};

export const BLANK_CLS_PENDING: ClsPending = {
	sampleOrVisit: null,
	xrayUs: null,
	ctEndoscopy: null,
	mriBoneDensity: null,
	ecgIntervention: null,
	linen: null,
	toolMetal: null,
	toolPlastic: null,
};

export const BLANK_CLS_STAFF: ClsStaff = {
	tong: null,
	nghiTruc: null,
	nghiTren2Ngay: null,
};

/** Draft dùng trong form thêm/sửa 1 bản ghi khoa CLS cho 1 ngày */
export interface DailyClsRecord {
	date: string;
	daLam: ClsWorkload;
	tonCho: ClsPending;
	nl: ClsStaff;
	ghiChu: string;
}

export const blankDailyClsRecord = (date: string): DailyClsRecord => ({
	date,
	daLam: { ...BLANK_CLS_WORKLOAD },
	tonCho: { ...BLANK_CLS_PENDING },
	nl: { ...BLANK_CLS_STAFF },
	ghiChu: '',
});

/** Kết quả tính toán derived (đi làm / tỷ lệ / chênh lệch) */
export interface ComputedClsStats {
	/** Tổng khối lượng công việc đã thực hiện (Σ 9 chỉ tiêu) */
	tongKhoiLuong: number;
	/** Cột W — Nhân lực đi làm = Tổng - (nghỉ trực + nghỉ ≥2 ngày) */
	diLam: number;
	/** Cột X — Tỷ lệ NL đi làm / Khối lượng CV, null nếu khối lượng = 0 */
	tyLe: number | null;
	/** Cột Y — Nhân lực khuyến cáo (cố định theo khoa), null nếu chưa cấu hình */
	khuyenCao: number | null;
	/** Cột Z — Chênh lệch = đi làm - khuyến cáo, null nếu chưa có khuyến cáo */
	chenhLech: number | null;
}

/** 1 dòng khoa CLS đã tính toán, dùng để hiển thị bảng tổng hợp */
export interface KhoaClsRecord {
	tt: number;
	id_department: number;
	/** code_department (vd. CLS01..CLS10) — dùng để xác định cột nào áp dụng cho khoa này */
	code: string | null;
	ten: string;
	daLam: ClsWorkload;
	tonCho: ClsPending;
	nlTong: number | null;
	nghiTruc: number | null;
	nghiTren2: number | null;
	diLam: number | null;
	tongKhoiLuong: number | null;
	tyLe: number | null;
	khuyenCao: number | null;
	chenhLech: number | null;
	ghiChu: string | null;
}
