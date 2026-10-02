import type { DepartmentAccessType, RoleType, StatusType } from './commonType';

export interface CurrentUser {
	hoTen: string;
	chucVu: string;
	khoa: string;
}

export interface UserAccount {
	id: number;
	hoTen: string;
	taiKhoan: string;
	khoa: string;
	chucVu: string;
	vaiTro: RoleType;
	trangThai: StatusType;
	department_access_type: DepartmentAccessType;
}

export interface DeptPerm {
	id_department: number;
	name_department: string;
	can_edit: boolean;
	can_delete: boolean;
	can_export: boolean;
}

export interface UserDraft {
	full_name: string;
	username: string;
	password: string;
	user_code: string;
	id_department: number | null;
	position: string;
	id_role: number | null;
	status: StatusType;
}
