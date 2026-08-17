// types/staffingType.ts

import type {
	FormulaType,
	RecommendedFormulaType,
	StatusType,
} from './commonType';

// ─────────────────────────────────────────────────────────────
// Hệ số công thức TT03 (cột M)
// ─────────────────────────────────────────────────────────────

export interface HeSoTT03 {
	// custom_coef
	cap1: number;
	cap2: number;
	cap3: number;
	tong: number;
	// standard / icu / surgery
	patientRatio: number;
	shiftDivisor: number;
	shiftMultiplier: number;
	fixedAdd: number;
}

/**
 * Hệ số công thức Nhân lực Khuyến nghị (cột N)
 * Tương ứng với Dept_Recommended_Config
 */
export interface HeSoRecommended {
	/** Hệ số ca sáng (L1 / CSC1) */
	coefL1: number;
	/** Hệ số ca chiều (L2 / CSC2) */
	coefL2: number;
	/** Hệ số ca đêm (L3 / CSC3) */
	coefL3: number;
	/** Tỉ lệ nhân — dùng cho total_ratio hoặc outpatient_count */
	outpatientRatio: number | null;
	fixedAdd: number;
	note: string;
}

// ─────────────────────────────────────────────────────────────
// Department / KhoaItem / DeptConfig
// ─────────────────────────────────────────────────────────────

export interface Department {
	id: number;
	ten: string;
	giuong: number | null;
	heSo: HeSoTT03;
	formulaType: FormulaType;
	tongNhanLuc: number | null;
	trangThai: StatusType;
}

export interface KhoaItem {
	id: number;
	ten: string;
	giuong: number | null;
<<<<<<< HEAD
=======
	/** 'ward' = khối nội trú (TT03) · 'cls' = hệ Cận lâm sàng */
	deptGroup: 'ward' | 'cls';
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
	/** Hệ số TT03 (cột M) */
	heSo: HeSoTT03;
	formulaType: FormulaType;
	tt03Note?: string | null;
	/** Hệ số khuyến nghị (cột N) — optional, có thể chưa cấu hình */
	heSoRec?: HeSoRecommended | null;
	recFormulaType?: RecommendedFormulaType | null;
}

export interface DeptConfig {
	ten: string;
	giuongMay: number | null;
	/** Hệ số TT03 (cột M) */
	heSo: HeSoTT03;
	formulaType: FormulaType;
	tt03Note?: string | null;
	/** Hệ số khuyến nghị (cột N) — optional */
	heSoRec?: HeSoRecommended | null;
	recFormulaType?: RecommendedFormulaType | null;
}

// ─────────────────────────────────────────────────────────────
// Daily records
// ─────────────────────────────────────────────────────────────

export interface DailyRecord {
	date: string;
	nb: { cap1: number | null; cap2: number | null; cap3: number | null };
	nbKhamPT: number | null;
	nl: {
		tong: number | null;
		nghiTruc: number | null;
		nghiTren2Ngay: number | null;
	};
	ghiChu: string;
}

export interface ComputedStats {
	tongNB: number;
	/** Kết quả TT03 raw (cột M) */
	tt03: number;
	/** Kết quả khuyến nghị raw (cột N) — null nếu chưa có config */
	khuyenNghi: number | null;
	/**
	 * Giá trị dùng để tính điều phối:
	 * = khuyenNghi nếu có, fallback về tt03
	 */
	khuyenCao: number;
	diLam: number;
	/** diLam - khuyenCao (raw, không làm tròn) */
	dieuPhoi: number;
}

// ─────────────────────────────────────────────────────────────
// Draft forms
// ─────────────────────────────────────────────────────────────

/** Draft chỉnh sửa thông tin khoa + cấu hình TT03 (cột M) */
export interface DraftDept {
	name: string;
	code_department: string;
	bed_count: number | null;
	coef_level_1: number;
	coef_level_2: number;
	coef_level_3: number;
	coef_total: number;
	total_staff: number | null;
	status: StatusType;
	formula_type: FormulaType;
	patient_ratio: number;
	shift_divisor: number;
	shift_multiplier: number;
	fixed_add: number;
	tt03_note: string;
}

/** Draft chỉnh sửa cấu hình Nhân lực Khuyến nghị (cột N) */
export interface DraftRecommendedConfig {
	formula_type: RecommendedFormulaType;
	coef_l1: number;
	coef_l2: number;
	coef_l3: number;
	outpatient_ratio: number | null;
	fixed_add: number;
	note: string;
}

export const BLANK_RECOMMENDED_CONFIG: DraftRecommendedConfig = {
	formula_type: 'coef',
	coef_l1: 0.5,
	coef_l2: 0.104,
	coef_l3: 0.104,
	outpatient_ratio: null,
	fixed_add: 0,
	note: '',
};

export interface RecordDraft {
	id_department: number;
	department_name: string;
	patient_level_1: number | null;
	patient_level_2: number | null;
	patient_level_3: number | null;
	outpatient_cnt: number | null;
	total_staff: number | null;
	staff_on_duty: number | null;
	staff_long_leave: number | null;
	note: string;
}

export interface RowInput {
	csc1: string;
	csc2: string;
	csc3: string;
	nbKham: string;
	nlTong: string;
	nghiTruc: string;
	nghiTren2: string;
	note: string;
}

export const BLANK_ROW_INPUT: RowInput = {
	csc1: '',
	csc2: '',
	csc3: '',
	nbKham: '',
	nlTong: '',
	nghiTruc: '',
	nghiTren2: '',
	note: '',
};
