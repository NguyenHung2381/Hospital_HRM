import type { ApiReport } from '@/types/apiType';
import type { DeptPerm } from '@/types/userType';
import { useMemo, useState } from 'react';

type PermRecord = {
	can_edit: boolean;
	can_delete: boolean;
	can_export: boolean;
};

// Các vai trò có quyền toàn bộ mà không cần phân khoa cụ thể
const FULL_ACCESS_ROLES = ['admin', 'giam_doc', 'dieu_duong_truong'] as const;

interface UseDeptPermissionsReturn {
	localPerms: Record<number, PermRecord>;
	setLocalPerms: React.Dispatch<
		React.SetStateAction<Record<number, PermRecord>>
	>;
	getPermForDept: (id_department: number) => PermRecord | undefined;
	canDeleteReport: boolean;
}

/**
 * Quản lý quyền thao tác theo khoa:
 *  - localPerms: quyền tạm thời được cấp sau khi user thêm 1 khoa mới
 *    vào báo cáo (tự động can_edit/delete/export cho khoa vừa tạo)
 *  - getPermForDept: ưu tiên localPerms → deptPermissions (từ context)
 *    → fallback toàn quyền nếu là admin/gđ/ddt-bv
 *  - canDeleteReport: true nếu user có quyền xóa ít nhất 1 record trong báo cáo
 *
 * Tách ra để logic quyền thay đổi (thêm role mới, thêm permission mới)
 * không ảnh hưởng đến DataPage hay các component khác.
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

	return { localPerms, setLocalPerms, getPermForDept, canDeleteReport };
}
