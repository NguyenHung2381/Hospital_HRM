// types/commonType.ts

export type StatusType = 'active' | 'inactive';

export type DepartmentAccessType = 'all' | 'assigned' | 'own';

export type RoleType =
	| 'admin'
	| 'giam_doc'
	| 'dieu_duong_truong'
	| 'ddt_khoa'
	| 'nhan_vien';

/** Loại công thức Thông tư 03 */
export type FormulaType = 'standard' | 'icu' | 'surgery' | 'custom_coef';

/** Loại công thức Nhân lực Khuyến nghị (Dept_Recommended_Config) */
export type RecommendedFormulaType =
	| 'coef'
	| 'coef_with_total'
	| 'coef_with_outpatient'
	| 'total_ratio'
	| 'outpatient_count';
