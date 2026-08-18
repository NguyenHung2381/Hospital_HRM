import type { RecommendedFormulaType } from '@/types/commonType';
import type { DraftDept } from '@/types/staffingType';

export interface DraftRec {
	formula_type: RecommendedFormulaType;
	coef_l1: number;
	coef_l2: number;
	coef_l3: number;
	outpatient_ratio: number | null;
	fixed_add: number;
	note: string;
}

export const DRAFT_DEFAULT: DraftDept = {
	name: '',
	code_department: '',
	bed_count: null,
	coef_level_1: 0.5,
	coef_level_2: 0.104,
	coef_level_3: 0.104,
	coef_total: 0.12,
	total_staff: null,
	status: 'active',
	formula_type: 'custom_coef',
	patient_ratio: 0.6,
	shift_divisor: 3,
	shift_multiplier: 2,
	fixed_add: 0,
	tt03_note: '',
};

export const REC_DEFAULT: DraftRec = {
	formula_type: 'coef',
	coef_l1: 0.5,
	coef_l2: 0.104,
	coef_l3: 0.104,
	outpatient_ratio: null,
	fixed_add: 0,
	note: '',
};

export const COEF_FIELDS: { label: string; key: keyof DraftDept; hint?: string }[] = [
	{ label: 'HS Cấp 1 (CSC1)', key: 'coef_level_1', hint: 'Nặng / Nguy kịch' },
	{ label: 'HS Cấp 2 (CSC2)', key: 'coef_level_2', hint: 'Trung bình' },
	{ label: 'HS Cấp 3 (CSC3)', key: 'coef_level_3', hint: 'Nhẹ / Ổn định' },
	{ label: 'HS Tổng NB', key: 'coef_total', hint: 'Nhân với tổng NB' },
];

export const REC_FORMULA_OPTIONS: {
	value: RecommendedFormulaType;
	label: string;
	hint: string;
}[] = [
	{
		value: 'coef',
		label: 'Hệ số theo cấp độ NB',
		hint: '= (L1 × coef_l1) + (L2 × coef_l2) + (L3 × coef_l3) + fixed_add',
	},
	{
		value: 'coef_with_total',
		label: 'Hệ số cấp độ + Tổng NB',
		hint: '= (L1 × coef_l1) + (L2 × coef_l2) + (L3 × coef_l3) + (Tổng NB × outpatient_ratio) + fixed_add',
	},
	{
		value: 'total_ratio',
		label: 'Tỉ lệ tổng NB (cấp cứu)',
		hint: '= (L1 + L2 + L3) × outpatient_ratio + fixed_add',
	},
	{
		value: 'outpatient_count',
		label: 'Lượt khám ngoại trú',
		hint: '= outpatient_cnt × outpatient_ratio + fixed_add',
	},
	{
		value: 'fixed',
		label: 'Số cố định (hệ CLS)',
		hint: '= fixed_add (không phụ thuộc dữ liệu bản ghi)',
	},
];

export type FormTab = 'info' | 'tt03' | 'rec';
