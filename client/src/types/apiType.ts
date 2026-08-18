// types/apiType.ts

import type {
	DepartmentAccessType,
	FormulaType,
	RecommendedFormulaType,
} from './commonType';

// ─────────────────────────────────────────────────────────────
// Auth / User / Role
// ─────────────────────────────────────────────────────────────

export interface ApiUser {
	id_user: number;
	full_name: string;
	username: string;
	user_code: string | null;
	position: string | null;
	status: 'active' | 'inactive';
	id_department: number | null;
	department_name: string | null;
	name_department: string | null;
	id_role: number;
	name_role: string;
	department_access_type: DepartmentAccessType;
}

export interface ApiRole {
	id_role: number;
	name_role: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	is_system: boolean;
	department_access_type: DepartmentAccessType;
	permissions?: ApiPermissionGrant[];
}

export interface ApiPermissionGrant {
	id_permission: number;
	code_permission: string;
	label: string;
	group_name: string;
	is_granted: boolean;
}

export interface ApiPermission {
	id_permission: number;
	code_permission: string;
	label: string;
	group_name: string;
	sort_order: number;
}

export interface ApiDeptPerm {
	id_department: number;
	name_department: string;
	can_edit: number | boolean;
	can_delete: number | boolean;
	can_export: number | boolean;
}

// ─────────────────────────────────────────────────────────────
// Departments
// ─────────────────────────────────────────────────────────────

export interface ApiDept {
	id_department: number;
	name_department: string;
	code_department: string | null;
	bed_count: number | null;
	// Hệ số custom_coef (cũ — vẫn giữ để backward compat)
	coef_level_1: number;
	coef_level_2: number;
	coef_level_3: number;
	coef_total: number;
	total_staff: number | null;
	status: 'active' | 'inactive';
	// Cấu hình TT03 (join từ Dept_TT03_Config)
	formula_type: FormulaType | null;
	patient_ratio: number | null;
	shift_divisor: number | null;
	shift_multiplier: number | null;
	fixed_add: number | null;
	tt03_note: string | null;
	// Cấu hình Khuyến nghị (join từ Dept_Recommended_Config)
	rec_formula_type: RecommendedFormulaType | null;
	rec_coef_l1: number | null;
	rec_coef_l2: number | null;
	rec_coef_l3: number | null;
	rec_outpatient_ratio: number | null;
	rec_fixed_add: number | null;
	rec_note: string | null;
	/** 'ward' = khối nội trú (TT03) · 'cls' = hệ Cận lâm sàng */
	dept_group: 'ward' | 'cls';
}

// ─────────────────────────────────────────────────────────────
// TT03 Config
// ─────────────────────────────────────────────────────────────

export interface ApiTT03Config {
	id: number;
	id_department: number;
	name_department: string;
	code_department: string | null;
	formula_type: FormulaType;
	patient_ratio: number;
	shift_divisor: number;
	shift_multiplier: number;
	fixed_add: number;
	note: string | null;
	bed_count: number | null;
	coef_level_1: number;
	coef_level_2: number;
	coef_level_3: number;
	coef_total: number;
}

// ─────────────────────────────────────────────────────────────
// Recommended Config  (Dept_Recommended_Config — MỚI)
// ─────────────────────────────────────────────────────────────

export interface ApiRecommendedConfig {
	id: number;
	id_department: number;
	name_department: string;
	code_department: string | null;
	/** Loại công thức: 'coef' | 'total_ratio' | 'outpatient_count' */
	formula_type: RecommendedFormulaType;
	/** Hệ số ca sáng (L1) — dùng khi formula_type = 'coef' */
	coef_l1: number;
	/** Hệ số ca chiều (L2) — dùng khi formula_type = 'coef' */
	coef_l2: number;
	/** Hệ số ca đêm (L3) — dùng khi formula_type = 'coef' */
	coef_l3: number;
	/** Tỉ lệ nhân — dùng khi formula_type = 'total_ratio' | 'outpatient_count' */
	outpatient_ratio: number | null;
	/** Hằng số cộng thêm */
	fixed_add: number;
	note: string | null;
	created_at: string;
	updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// Reports & Records
// ─────────────────────────────────────────────────────────────

export interface ApiReport {
	id_report: number;
	report_date: string;
	records: ApiRecord[];
	cls_records: ApiClsRecord[];
}

export interface ReportMeta {
	id_report: number;
	report_date: string;
	has_records?: boolean;
}

export interface ApiRecord {
	id: number;
	id_report?: number;
	id_department: number;
	department_name: string;
	sort_order: number | null;

	// Thông tin khoa
	bed_count: number | null;
	coef_level_1: number | null;
	coef_level_2: number | null;
	coef_level_3: number | null;
	coef_total: number | null;

	// Cấu hình TT03 của khoa (từ join)
	formula_type: FormulaType | null;
	patient_ratio: number | null;
	shift_divisor: number | null;
	shift_multiplier: number | null;
	fixed_add: number | null;

	// Số liệu người bệnh
	patient_level_1: number | null;
	patient_level_2: number | null;
	patient_level_3: number | null;
	total_patients: number | null;
	outpatient_cnt: number | null;

	// Nhân lực
	total_staff: number | null;
	staff_on_duty: number | null;
	staff_long_leave: number | null;
	staff_working: number | null;
	tt03_ratio: number | null;
	coordination: number | null;

	// ── Nhân lực khuyến cáo ──────────────────────────────────
	/** TT03 đã lưu vào DB (cột recommended_staff) */
	recommended_staff: number | null;
	/** Khuyến nghị đã lưu vào DB (cột recommended_staff_calc — MỚI) */
	recommended_staff_calc: number | null;
	/** TT03 tính lại từ view (tt03_staff_calc) */
	tt03_staff_calc: number | null;
	/** Khuyến nghị tính lại từ view (rec_staff_calc — MỚI) */
	rec_staff_calc: number | null;
	/** Loại công thức khuyến nghị từ view (rec_formula_type — MỚI) */
	rec_formula_type: RecommendedFormulaType | null;
	/** Hệ số cấp 1 — dùng khi rec_formula_type = 'coef' */
	rec_coef_level_1: number | null;
	/** Hệ số cấp 2 — dùng khi rec_formula_type = 'coef' */
	rec_coef_level_2: number | null;
	/** Hệ số cấp 3 — dùng khi rec_formula_type = 'coef' */
	rec_coef_level_3: number | null;
	/** Tỉ lệ nhân — dùng khi rec_formula_type = 'total_ratio' | 'outpatient_count' */
	rec_outpatient_ratio: number | null;
	/** Hằng số cộng thêm cho công thức khuyến nghị */
	rec_fixed_add: number | null;
	/** Chênh lệch đi làm vs TT03 */
	staff_surplus_deficit: number | null;

	note: string | null;
	created_at: string | null;
	updated_at: string | null;
}

/** Record chi tiết của 1 khoa trong 1 báo cáo (dùng ở DailyStaffingBoard) */
export interface ApiDeptRecord {
	id: number;
	id_report: number;
	id_department: number;
	patient_level_1: number | null;
	patient_level_2: number | null;
	patient_level_3: number | null;
	outpatient_cnt: number | null;
	total_staff: number | null;
	staff_on_duty: number | null;
	staff_long_leave: number | null;
	staff_working: number | null;
	/** TT03 đã lưu */
	recommended_staff: number | null;
	/** Khuyến nghị đã lưu (MỚI) */
	recommended_staff_calc: number | null;
	note: string | null;
}

// ─────────────────────────────────────────────────────────────
// TT03 Calculate  (POST /api/tt03/calculate)
// ─────────────────────────────────────────────────────────────

/** Block kết quả TT03 trong response /api/tt03/calculate */
export interface ApiTT03Block {
	formula_type: FormulaType;
	note: string | null;
	/** Giá trị thô (chưa làm tròn) */
	raw: number | null;
	/** Giá trị làm tròn lên (Math.ceil) */
	staff: number | null;
}

/** Block kết quả Khuyến nghị trong response /api/tt03/calculate (MỚI) */
export interface ApiRecommendedBlock {
	formula_type: RecommendedFormulaType;
	note: string | null;
	raw: number | null;
	staff: number | null;
}

/**
 * Shape mới của /api/tt03/calculate
 * Trả về cả TT03 lẫn Khuyến nghị trong 1 lần gọi.
 */
export interface ApiTT03CalcResult {
	id_department: number;
	patient_level_1: number;
	patient_level_2: number;
	patient_level_3: number;
	total_patients: number;
	outpatient_cnt: number;
	/** Kết quả TT03 — null nếu khoa chưa có cấu hình */
	tt03: ApiTT03Block | null;
	/** Kết quả Nhân lực Khuyến nghị — null nếu chưa có cấu hình (MỚI) */
	recommended: ApiRecommendedBlock | null;
}

/** @deprecated Dùng ApiTT03CalcResult thay thế */
export interface ApiTT03CalcResultLegacy {
	id_department: number;
	formula_type: FormulaType;
	formula_note: string | null;
	patient_level_1: number;
	patient_level_2: number;
	patient_level_3: number;
	total_patients: number;
	recommended_staff_raw: number | null;
	recommended_staff: number | null;
}

// ─────────────────────────────────────────────────────────────
// Report_CLS_Records — báo cáo nhân lực hệ Cận lâm sàng (MỚI)
// ─────────────────────────────────────────────────────────────

export interface ApiClsRecord {
	id: number;
	id_report: number;
	id_department: number;
	department_name: string;
	code_department: string | null;
	sort_order: number | null;

	// Khối lượng công việc đã thực hiện
	sample_or_visit_cnt: number | null;
	xray_us_cnt: number | null;
	ct_endoscopy_cnt: number | null;
	mri_bonedensity_cnt: number | null;
	ecg_intervention_cnt: number | null;
	linen_media_cnt: number | null;
	tool_metal_cnt: number | null;
	tool_plastic_cnt: number | null;
	supervised_dept_cnt: number | null;

	// Số lượng tồn / chờ
	pending_sample_or_visit_cnt: number | null;
	pending_xray_us_cnt: number | null;
	pending_ct_endoscopy_cnt: number | null;
	pending_mri_bonedensity_cnt: number | null;
	pending_ecg_intervention_cnt: number | null;
	pending_linen_cnt: number | null;
	pending_tool_metal_cnt: number | null;
	pending_tool_plastic_cnt: number | null;

	// Nhân lực
	total_staff: number | null;
	staff_on_duty: number | null;
	staff_long_leave: number | null;
	staff_working: number | null;
	work_ratio: number | null;
	recommended_staff: number | null;
	coordination: number | null;

	// Cấu hình khuyến nghị của khoa (từ join, fallback tính lại phía client)
	rec_formula_type: RecommendedFormulaType | null;
	rec_fixed_add: number | null;
	rec_note: string | null;

	note: string | null;
	created_at: string | null;
	updated_at: string | null;
}

// ─────────────────────────────────────────────────────────────
// Điều phối nhân lực giữa các khoa (GET/POST/PUT/DELETE /api/coordination)
// ─────────────────────────────────────────────────────────────

/** Bản ghi điều phối nhân lực — chỉ theo dõi, không đụng số liệu báo cáo gốc */
export interface ApiCoordination {
	id: number;
	id_report: number;
	report_date: string;
	id_department_from: number;
	from_department_name: string;
	id_department_to: number;
	to_department_name: string;
	staff_count: number;
	note: string | null;
	created_by: number | null;
	created_by_name: string | null;
	created_at: string;
	updated_at: string | null;
}
