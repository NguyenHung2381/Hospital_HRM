import { useState } from 'react';
import type { ApiDept, ApiRole, ApiUser } from '@/types/apiType';
import type { DeptPerm, UserDraft } from '@/types/userType';
import {
	DRAFT_DEFAULT,
	type DeptPermMap,
} from '@/modules/admin/pages/accountPageConstants';

export type AccountModal = 'add' | 'edit' | 'del' | 'reset' | null;
export type AccountModalStep = 'form' | 'assign' | null;

/** State + handlers cho modal thêm/sửa/xoá/reset tài khoản (AccountPage). */
export function useAccountActions(roles: ApiRole[], refetchUsers: () => Promise<void>) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const [modal, setModal] = useState<AccountModal>(null);
	const [step, setStep] = useState<AccountModalStep>(null);
	const [draft, setDraft] = useState<UserDraft>(DRAFT_DEFAULT);
	const [target, setTarget] = useState<ApiUser | null>(null);
	const [newUserId, setNewUserId] = useState<number | null>(null);

	// Phân khoa + quyền (cho bước 2 khi assigned)
	const [assignedDepts, setAssignedDepts] = useState<number[]>([]);
	const [deptPerms, setDeptPerms] = useState<DeptPermMap>({});

	const selectedRole = roles.find((r) => r.id_role === draft.id_role);

	const openAdd = () => {
		setDraft(DRAFT_DEFAULT);
		setError('');
		setStep('form');
		setModal('add');
	};

	const openEdit = (u: ApiUser) => {
		setDraft({
			full_name: u.full_name,
			username: u.username,
			password: '',
			user_code: u.user_code ?? '',
			id_department: u.id_department,
			position: u.position ?? '',
			id_role: u.id_role,
			status: u.status,
		});
		setTarget(u);
		setError('');
		setStep('form');
		setModal('edit');
	};

	const closeModal = () => {
		setModal(null);
		setStep(null);
	};

	// Lưu bước 1 (thông tin cơ bản)
	const saveStep1 = async () => {
		if (!draft.full_name.trim() || !draft.username.trim() || !draft.id_role) {
			setError('Vui lòng điền đầy đủ họ tên, tên đăng nhập và vai trò');
			return;
		}
		if (modal === 'add' && !draft.password.trim()) {
			setError('Vui lòng nhập mật khẩu');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const isAdd = modal === 'add';
			const url = isAdd ? `/api/users` : `/api/users/${target!.id_user}`;
			const body = isAdd ? draft : { ...draft, password: undefined };
			const res = await fetch(url, {
				method: isAdd ? 'POST' : 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const data = (await res.json()) as {
				success: boolean;
				data?: { id_user: number };
				message?: string;
			};
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi lưu');
				return;
			}

			// Nếu role = assigned → bước 2 phân khoa
			if (selectedRole?.department_access_type === 'assigned') {
				const uid = isAdd ? data.data!.id_user : target!.id_user;
				setNewUserId(uid);
				// Load khoa đã phân nếu edit
				if (!isAdd) {
					const aRes = await fetch(`/api/users/${uid}/assigned-departments`);
					const aData = (await aRes.json()) as {
						success: boolean;
						data: ApiDept[];
					};
					if (aData.success)
						setAssignedDepts(aData.data.map((d) => d.id_department));

					const pRes = await fetch(`/api/users/${uid}/dept-permissions`);
					const pData = (await pRes.json()) as {
						success: boolean;
						data: DeptPerm[];
					};
					if (pData.success) {
						const map: DeptPermMap = {};
						pData.data.forEach((p) => {
							map[p.id_department] = {
								can_edit: p.can_edit,
								can_delete: p.can_delete,
								can_export: p.can_export,
							};
						});
						setDeptPerms(map);
					}
				} else {
					setAssignedDepts([]);
					setDeptPerms({});
				}
				setStep('assign');
			} else {
				// all / own → lưu xong, đóng modal
				await refetchUsers();
				closeModal();
			}
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	// Lưu bước 2 (phân khoa + quyền cho assigned)
	const saveStep2 = async () => {
		const uid = newUserId ?? target!.id_user;
		setSaving(true);
		setError('');
		try {
			await fetch(`/api/users/${uid}/assigned-departments`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ department_ids: assignedDepts }),
			});

			const permissions = assignedDepts.map((id) => ({
				id_department: id,
				...(deptPerms[id] ?? {
					can_edit: true,
					can_delete: false,
					can_export: true,
				}),
			}));

			await fetch(`/api/users/${uid}/dept-permissions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ permissions }),
			});

			await refetchUsers();
			closeModal();
		} catch {
			setError('Lỗi khi lưu phân khoa.');
		} finally {
			setSaving(false);
		}
	};

	const toggleDept = (id: number) => {
		setAssignedDepts((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
		if (!deptPerms[id]) {
			setDeptPerms((prev) => ({
				...prev,
				[id]: { can_edit: true, can_delete: false, can_export: true },
			}));
		}
	};

	const togglePerm = (
		id: number,
		key: 'can_edit' | 'can_delete' | 'can_export',
	) => {
		setDeptPerms((prev) => ({
			...prev,
			[id]: {
				...(prev[id] ?? {
					can_edit: true,
					can_delete: false,
					can_export: true,
				}),
				[key]: !prev[id]?.[key],
			},
		}));
	};

	const handleDel = async () => {
		if (!target) return;
		setSaving(true);
		try {
			await fetch(`/api/users/${target.id_user}`, { method: 'DELETE' });
			await refetchUsers();
			setModal(null);
		} catch {
			setError('Lỗi khi xoá.');
		} finally {
			setSaving(false);
		}
	};

	const handleReset = async () => {
		if (!target) return;
		setSaving(true);
		try {
			const res = await fetch(`/api/users/${target.id_user}/reset-password`, {
				method: 'PUT',
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (data.success) {
				setModal(null);
			} else {
				setError(data.message ?? 'Lỗi khi đặt lại mật khẩu');
			}
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	return {
		saving,
		error,
		setError,
		modal,
		setModal,
		step,
		setStep,
		draft,
		setDraft,
		target,
		setTarget,
		assignedDepts,
		setAssignedDepts,
		deptPerms,
		setDeptPerms,
		selectedRole,
		openAdd,
		openEdit,
		closeModal,
		saveStep1,
		saveStep2,
		toggleDept,
		togglePerm,
		handleDel,
		handleReset,
	};
}
