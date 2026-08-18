// ── Kiểu dữ liệu cho Recommended Config (DeptConfigModal) ─────────────────
export type RecFormulaType =
	| 'coef'
	| 'coef_with_total'
	| 'total_ratio'
	| 'outpatient_count';

export interface HeSoRec {
	coefL1: number;
	coefL2: number;
	coefL3: number;
	outpatientRatio: number | null;
	fixedAdd: number;
	note: string;
}

export const REC_FORMULA_OPTIONS: { value: RecFormulaType; label: string }[] = [
	{ value: 'coef', label: 'Hệ số theo cấp độ NB' },
	{ value: 'coef_with_total', label: 'Hệ số cấp độ + Tổng NB' },
	{ value: 'total_ratio', label: 'Tỉ lệ tổng NB (cấp cứu)' },
	{ value: 'outpatient_count', label: 'Lượt khám ngoại trú' },
];

export const DEFAULT_HE_SO_REC: HeSoRec = {
	coefL1: 0.5,
	coefL2: 0.104,
	coefL3: 0.104,
	outpatientRatio: null,
	fixedAdd: 0,
	note: '',
};
