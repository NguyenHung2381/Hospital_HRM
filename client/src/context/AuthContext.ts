import type { KhoaItem } from '@/types/staffingType';
import type { UserAccount } from '@/types/userType';
import { createContext } from 'react';

export type LoginResult =
	| { status: 'ok'; user: UserAccount }
	| { status: 'wrong_pass' }
	| { status: 'not_found' };

// Quyền thao tác theo từng khoa
export interface DeptPermission {
	id_department: number;
	name_department: string;
	can_edit: boolean;
	can_delete: boolean;
	can_export: boolean;
}

export interface AuthContextType {
	user: UserAccount | null;
	khoaList: KhoaItem[];
	deptPermissions: DeptPermission[];
	login: (
		taiKhoan: string,
		matKhau: string,
		remember: boolean,
	) => Promise<LoginResult>;
	logout: () => void;
	refresh: () => void;
	loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);
