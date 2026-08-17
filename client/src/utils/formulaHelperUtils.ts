import type { FormulaType, RecommendedFormulaType } from '@/types/commonType';
import type { DeptConfig, DraftDept } from '@/types/staffingType';

// ── Hằng hiển thị UI cho FormulaType TT03 ───────────────────────────────
export const FORMULA_LABELS: Record<FormulaType, string> = {
	standard: 'Nội trú thông thường',
	icu: 'Hồi sức / Chống độc',
	surgery: 'Gây mê / Phẫu thuật',
	custom_coef: 'Hệ số từng cấp',
};

export const FORMULA_BADGE_COLOR: Record<
	FormulaType,
	{ bg: string; color: string }
> = {
	standard: { bg: '#eff6ff', color: '#1d4ed8' },
	icu: { bg: '#fef2f2', color: '#b91c1c' },
	surgery: { bg: '#fdf4ff', color: '#7c3aed' },
	custom_coef: { bg: '#f0fdfa', color: '#0f766e' },
};

// ── Hằng hiển thị UI cho RecommendedFormulaType (Khuyến nghị) ───────────
export const REC_FORMULA_LABELS: Record<RecommendedFormulaType, string> = {
	coef: 'Hệ số theo ca (Nội/Ngoại)',
	coef_with_total: 'Hệ số theo người bệnh, phẫu thuật',
	coef_with_outpatient: 'Hệ theo ca + theo người khám bệnh, phẫu thuật',
	total_ratio: 'Tỉ lệ tổng NB (Cấp cứu)',
	outpatient_count: 'Số PT kế hoạch (Gây mê)',
	fixed: 'Số cố định (hệ CLS)',
};

export const REC_FORMULA_BADGE_COLOR: Record<
	RecommendedFormulaType,
	{ bg: string; color: string }
> = {
	coef: { bg: '#ecfeff', color: '#0891b2' }, // xanh cyan
	coef_with_total: { bg: '#f0fdf4', color: '#15803d' }, // xanh lá
	coef_with_outpatient: { bg: '#eff6ff', color: '#1d4ed8' }, // xanh dương
	total_ratio: { bg: '#fff7ed', color: '#c2410c' }, // cam
	outpatient_count: { bg: '#fdf4ff', color: '#7c3aed' }, // tím
	fixed: { bg: '#f1f5f9', color: '#334155' }, // xám
};

export interface TT03Block {
	formula_type: FormulaType;
	note: string | null;
	raw: number | null;
	staff: number | null;
}

export interface RecommendedBlock {
	formula_type: RecommendedFormulaType;
	note: string | null;
	raw: number | null;
	staff: number | null;
	fixed_add: number | null;
}

export interface TT03Preview {
	id_department: number;
	patient_level_1: number;
	patient_level_2: number;
	patient_level_3: number;
	total_patients: number;
	outpatient_cnt: number;
	/** Kết quả TT03 (Thông tư 03) */
	tt03: TT03Block | null;
	/** Kết quả Nhân lực khuyến nghị */
	recommended: RecommendedBlock | null;
}

export interface TT03PreviewLegacy {
	formula_type: FormulaType;
	formula_note: string | null;
	total_patients: number;
	patient_ratio: number | null;
	shift_divisor: number | null;
	shift_multiplier: number | null;
	fixed_add: number | null;
	bed_count: number | null;
	recommended_staff_raw: number | null;
	recommended_staff: number | null;
	coef_level_1: number | null;
	coef_level_2: number | null;
	coef_level_3: number | null;
	coef_total: number | null;
}

// ── 1. Tên tiếng Việt của loại công thức TT03 ────────────────────────────
export const getFormulaTypeName = (
	formulaType: FormulaType | string,
): string => {
	switch (formulaType) {
		case 'icu':
			return 'Hồi sức tích cực';
		case 'surgery':
			return 'Gây mê / Phẫu thuật';
		case 'standard':
			return 'Nội trú thông thường';
		case 'custom_coef':
			return 'Hệ số theo cấp độ NB';
		default:
			return String(formulaType);
	}
};

// ── 2. Tên tiếng Việt của loại công thức Khuyến nghị ────────────────────
export const getRecFormulaTypeName = (
	formulaType: RecommendedFormulaType | string,
): string => {
	switch (formulaType) {
		case 'coef':
			return 'Hệ số ca (Nội/Ngoại)';
		case 'coef_with_total':
			return 'Hệ số theo người bệnh';
		case 'total_ratio':
			return 'Tỉ lệ tổng NB (Cấp cứu)';
		case 'outpatient_count':
			return 'Số PT kế hoạch (Gây mê)';
		default:
			return String(formulaType);
	}
};

// ── 3. Chuỗi mô tả công thức chung (chưa thế số) ─────────────────────────
export const getFormulaLabel = (dept: DeptConfig): string => {
	const hs = dept.heSo;
	switch (dept.formulaType) {
		case 'icu':
			return `(Tổng NB × ${hs.patientRatio}) / ${hs.shiftDivisor ?? 3} × ${hs.shiftMultiplier ?? 2}`;
		case 'surgery':
			return `(Giường/Bàn × ${hs.patientRatio}) / ${hs.shiftDivisor ?? 3} × ${hs.shiftMultiplier ?? 2}`;
		case 'standard':
			return `(Tổng NB × ${hs.patientRatio}) / ${hs.shiftDivisor ?? 3} × ${hs.shiftMultiplier ?? 2}${(hs.fixedAdd ?? 0) > 0 ? ` + ${hs.fixedAdd}` : ''}`;
		case 'custom_coef':
		default:
			return `(CSC1 × ${hs.cap1}) + (CSC2 × ${hs.cap2}) + (CSC3 × ${hs.cap3}) + (Tổng × ${hs.tong})`;
	}
};

// ── 4. Chuỗi diễn giải phép tính cụ thể (đã thế số) ─────────────────────
export const getFormulaCalcDetail = (
	dept: DeptConfig,
	nb: { cap1: number | null; cap2: number | null; cap3: number | null },
): string => {
	const hs = dept.heSo;
	const c1 = nb.cap1 ?? 0;
	const c2 = nb.cap2 ?? 0;
	const c3 = nb.cap3 ?? 0;
	const tong = c1 + c2 + c3;
	switch (dept.formulaType) {
		case 'icu':
			return `= (${tong} × ${hs.patientRatio}) / ${hs.shiftDivisor ?? 3} × ${hs.shiftMultiplier ?? 2}`;
		case 'surgery':
			return `= (${dept.giuongMay ?? 0} × ${hs.patientRatio}) / ${hs.shiftDivisor ?? 3} × ${hs.shiftMultiplier ?? 2}`;
		case 'standard':
			return `= (${tong} × ${hs.patientRatio}) / ${hs.shiftDivisor ?? 3} × ${hs.shiftMultiplier ?? 2}${(hs.fixedAdd ?? 0) > 0 ? ` + ${hs.fixedAdd}` : ''}`;
		case 'custom_coef':
		default:
			return `= (${c1} × ${hs.cap1}) + (${c2} × ${hs.cap2}) + (${c3} × ${hs.cap3}) + (${tong} × ${hs.tong})`;
	}
};

// ── 5. Chuỗi diễn giải TT03 từ API Response (preview trong Form) ─────────
// Dùng TT03Preview.tt03 — block mới
export const getPreviewFormulaDetail = (
	preview: TT03Preview | null | undefined,
	nb: { cap1: number | null; cap2: number | null; cap3: number | null },
): string | null => {
	const p = preview?.tt03;
	if (!p) return null;
	const raw = p.raw?.toFixed(2) ?? '—';
	const tong = preview!.total_patients;
	// Lấy thêm thông tin từ note nếu cần — block mới không có shift_divisor trực tiếp
	// nên chỉ hiển thị raw result
	switch (p.formula_type) {
		case 'icu':
		case 'surgery':
		case 'standard':
			return `${p.note ?? p.formula_type} = ${raw}`;
		case 'custom_coef':
		default: {
			const c1 = nb.cap1 ?? 0;
			const c2 = nb.cap2 ?? 0;
			const c3 = nb.cap3 ?? 0;
			return `CSC1(${c1}) + CSC2(${c2}) + CSC3(${c3}) + Tổng(${tong}) = ${raw}`;
		}
	}
};

// ── 6. Chuỗi diễn giải Khuyến nghị từ API Response (preview trong Form) ──
export const getPreviewRecDetail = (
	preview: TT03Preview | null | undefined,
	nb: { cap1: number | null; cap2: number | null; cap3: number | null },
): string | null => {
	const p = preview?.recommended;

	if (!p) return null;
	const raw = p.raw?.toFixed(2) ?? '—';
	const c1 = nb.cap1 ?? 0;
	const c2 = nb.cap2 ?? 0;
	const c3 = nb.cap3 ?? 0;
	const outpatient = preview?.outpatient_cnt ?? 0;

	switch (p.formula_type) {
		case 'coef':
			return `CSC1(${c1}) × hs1 + CSC2(${c2}) × hs2 + CSC3(${c3}) × hs3 = ${raw}`;
		case 'coef_with_total':
			return `CSC1(${c1}) × hs1 + CSC2(${c2}) × hs2 + CSC3(${c3}) × hs3 + TNB(${c1 + c2 + c3}) + = ${raw}`;
		case 'coef_with_outpatient':
			return `CSC1(${c1}) × hs1 + CSC2(${c2}) × hs2 + CSC3(${c3}) × hs3 + TNB(${outpatient}) + +  = ${raw}`;
		case 'total_ratio':
			return `(${c1}+${c2}+${c3}) × tỉ lệ = ${raw}`;
		case 'outpatient_count':
			return `PT kế hoạch (${outpatient}) × tỉ lệ = ${raw}`;
		default:
			return `${p.note ?? p.formula_type} = ${raw}`;
	}
};

// ── 7. Chuỗi xem trước công thức từ DraftDept (màn hình Cấu hình Khoa) ───
export const getDraftFormulaPreview = (draft: DraftDept): string => {
	const {
		formula_type,
		patient_ratio,
		shift_divisor,
		shift_multiplier,
		fixed_add,
		coef_level_1,
		coef_level_2,
		coef_level_3,
		coef_total,
		bed_count,
	} = draft;
	const beds = bed_count ?? 0;
	switch (formula_type) {
		case 'icu':
			return `(Tổng NB × ${patient_ratio}) / ${shift_divisor} × ${shift_multiplier}`;
		case 'surgery':
			return `(${beds} giường × ${patient_ratio}) / ${shift_divisor} × ${shift_multiplier}`;
		case 'standard':
			return `(Tổng NB × ${patient_ratio}) / ${shift_divisor} × ${shift_multiplier}${fixed_add > 0 ? ` + ${fixed_add}` : ''}`;
		case 'custom_coef':
		default:
			return `(CSC1 × ${coef_level_1}) + (CSC2 × ${coef_level_2}) + (CSC3 × ${coef_level_3}) + (Tổng × ${coef_total})`;
	}
};
