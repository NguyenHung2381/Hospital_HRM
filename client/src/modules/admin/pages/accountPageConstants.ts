import type { RoleType } from '@/types/commonType';
import type { UserDraft } from '@/types/userType';

export const DRAFT_DEFAULT: UserDraft = {
	full_name: '',
	username: '',
	password: '',
	user_code: '',
	id_department: null,
	position: '',
	id_role: null,
	status: 'active',
};

export const ROLE_CSS: Record<string, string> = {
	admin: 'role-admin',
	giam_doc: 'role-giam-doc',
	dieu_duong_truong: 'role-ddt-bv',
	ddt_khoa: 'role-ddt-khoa',
	nhan_vien: 'role-nhan-vien',
};

export const ROLE_MAP: Record<string, RoleType> = {
	'Quản trị hệ thống': 'admin',
	'Giám đốc': 'giam_doc',
	'Điều dưỡng trưởng BV': 'dieu_duong_truong',
	'Điều dưỡng trưởng khoa': 'ddt_khoa',
	'Nhân viên': 'nhan_vien',
};

export type DeptPermMap = Record<
	number,
	{ can_edit: boolean; can_delete: boolean; can_export: boolean }
>;
