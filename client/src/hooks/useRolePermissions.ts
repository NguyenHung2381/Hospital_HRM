import type { ApiPermission, ApiRole } from '@/types/apiType';
import { useCallback, useEffect, useState } from 'react';
import {
	VIEW_PERM_CODES,
	VIEW_PERM_MAP,
} from '@/modules/admin/pages/permissionPageConstants';

/** Fetch + lưu quyền hệ thống theo vai trò đang chọn (PermissionPage). */
export function useRolePermissions(
	roles: ApiRole[],
	setRoles: React.Dispatch<React.SetStateAction<ApiRole[]>>,
) {
	const [allPerms, setAllPerms] = useState<ApiPermission[]>([]);
	const [activeRoleId, setActiveRoleId] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [editPerms, setEditPerms] = useState<Record<number, boolean>>({});

	// ── Tách riêng hàm fetch quyền hệ thống ──
	const fetchPerms = useCallback(async () => {
		try {
			const res = await fetch(`/api/permissions`);
			const data = (await res.json()) as {
				success: boolean;
				data: ApiPermission[];
			};
			if (data.success) setAllPerms(data.data);
		} catch {
			/* bỏ qua */
		}
	}, []);

	useEffect(() => {
		fetchPerms();
	}, [fetchPerms]);

	// Tự động chọn Role đầu tiên khi load xong danh sách Roles
	useEffect(() => {
		if (roles.length > 0 && !activeRoleId) {
			setActiveRoleId(roles[0].id_role);
		}
	}, [roles, activeRoleId]);

	// Fetch chi tiết quyền của Role đang chọn
	useEffect(() => {
		if (!activeRoleId) return;
		async function fetchRoleDetail() {
			try {
				const res = await fetch(`/api/roles/${activeRoleId}`);
				const data = (await res.json()) as { success: boolean; data: ApiRole };
				if (data.success) {
					// Cập nhật lại role trong danh sách (dùng hàm setRoles từ hook)
					setRoles((prev) =>
						prev.map((r) => (r.id_role === activeRoleId ? data.data : r)),
					);
					const map: Record<number, boolean> = {};
					(data.data.permissions ?? []).forEach((p) => {
						map[p.id_permission] = p.is_granted;
					});
					// Ghi đè quyền xem dữ liệu: tự động tích đúng 1 quyền theo access_type
					const correctViewCode =
						VIEW_PERM_MAP[data.data.department_access_type];
					(data.data.permissions ?? []).forEach((p) => {
						if (VIEW_PERM_CODES.has(p.code_permission)) {
							map[p.id_permission] = p.code_permission === correctViewCode;
						}
					});
					setEditPerms(map);
				}
			} catch {
				/* bỏ qua */
			}
		}
		fetchRoleDetail();
	}, [activeRoleId, setRoles]);

	const activeRole = roles.find((r) => r.id_role === activeRoleId);
	const canEdit = activeRole ? !activeRole.is_system : false;

	const togglePerm = (id: number) => {
		if (!canEdit) return;
		// Quyền xem dữ liệu được lock — tự động theo department_access_type
		const perm = allPerms.find((p) => p.id_permission === id);
		if (perm && VIEW_PERM_CODES.has(perm.code_permission)) return;
		setEditPerms((p) => ({ ...p, [id]: !p[id] }));
		setSaved(false);
	};

	const handleSavePerms = async () => {
		if (!activeRoleId) return;
		setSaving(true);
		try {
			const permissions = allPerms.map((p) => ({
				permission_id: p.id_permission,
				is_granted: editPerms[p.id_permission] ?? false,
			}));
			await fetch(`/api/roles/${activeRoleId}/permissions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ permissions }),
			});
			setSaved(true);
			setTimeout(() => setSaved(false), 2500);
		} catch {
			/* bỏ qua */
		} finally {
			setSaving(false);
		}
	};

	return {
		allPerms,
		activeRoleId,
		setActiveRoleId,
		saving,
		saved,
		editPerms,
		activeRole,
		canEdit,
		togglePerm,
		handleSavePerms,
	};
}
