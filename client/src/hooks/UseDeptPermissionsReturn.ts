import type { ApiReport } from '@/types/apiType';
import type { DeptPerm } from '@/types/userType';
import { useMemo, useState } from 'react';

export type PermRecord = {
	can_edit: boolean;
	can_delete: boolean;
	can_export: boolean;
};

// Các vai trò có quyền toàn bộ mà không cần phân khoa cụ thể
const FULL_ACCESS_ROLES = ['admin', 'giam_doc', 'dieu_duong_truong'] as const;

interface UseDeptPermissionsReturn {
	/** Cấp quyền tạm thời cho 1 khoa vừa được thêm vào báo cáo */
	grantLocalPerm: (id_department: number) => void;
	getPermForDept: (id_department: number) => PermRecord | undefined;
	canDeleteReport: boolean;
}

/**
 * Quản lý quyền thao tác theo khoa:
 *  - localPerms: quyền tạm thời được cấp khi user thêm 1 khoa mới
 *    vào báo cáo (tự động can_edit/delete/export cho khoa vừa tạo).
 *    Được giữ nội bộ trong hook, không cần expose ra ngoài.
 *  - grantLocalPerm: DataPage gọi sau khi AddRecordModal.onAdded thành công
 *  - getPermForDept: ưu tiên localPerms → deptPermissions (từ context)
 *    → fallback toàn quyền nếu là admin/gđ/ddt-bv
 *  - canDeleteReport: true nếu user có quyền xóa ít nhất 1 record
 */
export function useDeptPermissions(
	report: ApiReport | null,
	deptPermissions: DeptPerm[],
	userVaiTro: string | undefined,
): UseDeptPermissionsReturn {
	const [localPerms, setLocalPerms] = useState<Record<number, PermRecord>>({});

	const getPermForDept = (id_department: number): PermRecord | undefined => {
		if (localPerms[id_department]) return localPerms[id_department];

		const explicit = deptPermissions.find(
			(p) => p.id_department === id_department,
		);
		if (explicit) return explicit;

		if (
			userVaiTro &&
			(FULL_ACCESS_ROLES as readonly string[]).includes(userVaiTro)
		) {
			return { can_edit: true, can_delete: true, can_export: true };
		}

		return undefined;
	};

	const canDeleteReport = useMemo(
		() =>
			report?.records.some(
				(r) => getPermForDept(r.id_department)?.can_delete,
			) ?? false,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[report, deptPermissions, localPerms],
	);

	const grantLocalPerm = (id_department: number) =>
		setLocalPerms((prev) => ({
			...prev,
			[id_department]: { can_edit: true, can_delete: true, can_export: true },
		}));

	return { grantLocalPerm, getPermForDept, canDeleteReport };
}
