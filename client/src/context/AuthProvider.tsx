import {
	AuthContext,
	type DeptPermission,
	type LoginResult,
} from '@/context/AuthContext';
import type { ApiDept, ApiDeptPerm, ApiUser } from '@/types/apiType';
import type { RoleType } from '@/types/commonType';
import type { KhoaItem } from '@/types/staffingType';
import type { UserAccount } from '@/types/userType';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'auth_user';
const TOKEN_KEY = 'auth_token';

// ── Map role ──────────────────────────────
const ROLE_MAP: Record<string, RoleType> = {
	'Quản trị hệ thống': 'admin',
	'Giám đốc': 'giam_doc',
	'Điều dưỡng trưởng BV': 'dieu_duong_truong',
	'Điều dưỡng trưởng khoa': 'ddt_khoa',
	'Nhân viên': 'nhan_vien',
};

function mapApiUser(raw: ApiUser): UserAccount {
	return {
		id: raw.id_user,
		hoTen: raw.full_name,
		taiKhoan: raw.username,
		khoa: raw.department_name ?? '',
		chucVu: raw.position ?? '',
		vaiTro: ROLE_MAP[raw.name_role] ?? 'nhan_vien',
		trangThai: raw.status === 'active' ? 'active' : 'inactive',
		department_access_type: raw.department_access_type,
	};
}

function mapApiDept(d: ApiDept): KhoaItem {
	return {
		id: d.id_department,
		ten: d.name_department,
		giuong: d.bed_count,
<<<<<<< HEAD
=======
		deptGroup: d.dept_group ?? 'ward',
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
		formulaType: d.formula_type ?? 'standard',
		tt03Note: d.tt03_note,
		heSo: {
			cap1: d.coef_level_1 ?? 0,
			cap2: d.coef_level_2 ?? 0,
			cap3: d.coef_level_3 ?? 0,
			patientRatio: d.patient_ratio ?? 0,
			shiftDivisor: d.shift_divisor ?? 0,
			shiftMultiplier: d.shift_multiplier ?? 0,
			fixedAdd: d.fixed_add ?? 0,
			tong: d.coef_total ?? 0,
		},
		recFormulaType: d.rec_formula_type ?? null,
		heSoRec: d.rec_formula_type
			? {
					coefL1: d.rec_coef_l1 ?? 0,
					coefL2: d.rec_coef_l2 ?? 0,
					coefL3: d.rec_coef_l3 ?? 0,
					outpatientRatio: d.rec_outpatient_ratio ?? null,
					fixedAdd: d.rec_fixed_add ?? 0,
					note: d.rec_note ?? '',
				}
			: null,
	};
}

// ── Load user từ storage ─────────────────────────
function loadUser(): UserAccount | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

// ── AuthProvider ────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<UserAccount | null>(loadUser);
	const [khoaList, setKhoaList] = useState<KhoaItem[]>([]);
	const [deptPermissions, setDeptPermissions] = useState<DeptPermission[]>([]);
	const [loading, setLoading] = useState(false);

	// 🔥 Hàm fetch chung (quan trọng)
	const fetchAllData = async (userId: number) => {
		setLoading(true);
		try {
			const [deptRes, permRes] = await Promise.all([
				fetch(`/api/users/${userId}/departments`),
				fetch(`/api/users/${userId}/dept-permissions`),
			]);

			const deptData = await deptRes.json();
			const permData = await permRes.json();

			if (deptData.success) setKhoaList(deptData.data.map(mapApiDept));

			if (permData.success)
				setDeptPermissions(
					permData.data.map((p: ApiDeptPerm) => ({
						id_department: p.id_department,
						name_department: p.name_department,
						can_edit: !!p.can_edit,
						can_delete: !!p.can_delete,
						can_export: !!p.can_export,
					})),
				);
		} catch (err) {
			console.error('Fetch error:', err);
		} finally {
			setLoading(false);
		}
	};

	// 🔥 AUTO SYNC khi reload hoặc user change
	useEffect(() => {
		if (user?.id) {
			fetchAllData(user.id);
		}
	}, [user]);

	// 🔥 LOGIN
	const login = async (
		taiKhoan: string,
		matKhau: string,
	): Promise<LoginResult> => {
		try {
			const res = await fetch(`/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: taiKhoan, password: matKhau }),
			});

			if (res.status === 404) return { status: 'not_found' };
			if (res.status === 401) return { status: 'wrong_pass' };
			if (!res.ok) return { status: 'not_found' };

			const data = await res.json();
			const loggedInUser = mapApiUser(data.data.user);
			const token = data.data.token;

			setUser(loggedInUser);

			// lưu user + token
			localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser));
			localStorage.setItem(TOKEN_KEY, token);

			return { status: 'ok', user: loggedInUser };
		} catch {
			return { status: 'not_found' };
		}
	};

	// 🔥 LOGOUT
	const logout = () => {
		setUser(null);
		setKhoaList([]);
		setDeptPermissions([]);

		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(TOKEN_KEY);
	};

	// 🔥 MANUAL REFRESH (rất hữu ích)
	const refresh = () => {
		if (user?.id) {
			fetchAllData(user.id);
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				khoaList,
				deptPermissions,
				login,
				logout,
				refresh, // 👈 thêm cái này
				loading, // 👈 optional
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
