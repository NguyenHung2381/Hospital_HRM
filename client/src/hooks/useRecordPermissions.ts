import { useAuth } from '@/context/useAuth';
import { formatDateToVN } from '@/utils/dateUtils';
import { isReportLocked } from '@/utils/staffingCalc';

/**
 * Quyền thao tác + trạng thái khoá sổ cho khoa/ngày đang xem trên board
 * chấm công (dùng chung cho DailyStaffingBoard và CLSStaffingBoard).
 */
export function useRecordPermissions(activeKhoaId: number, activeDate: string) {
	const { user, deptPermissions } = useAuth();

	const perm = deptPermissions.find((p) => p.id_department === activeKhoaId);
	const accessType = user?.department_access_type;
	const hasEditPerm = perm?.can_edit ?? false;
	const hasDeletePerm = perm?.can_delete ?? false;

	const canAddForDate = (date: string) =>
		hasEditPerm && !isReportLocked(date, accessType);
	const lockedActive = isReportLocked(activeDate, accessType);
	const canEdit = hasEditPerm && !lockedActive;
	const canDelete = hasDeletePerm && !lockedActive;
	const lockReason = lockedActive
		? `Đã chốt sổ ngày ${formatDateToVN(activeDate)} — chỉ Admin mới có thể chỉnh sửa`
		: '';

	return {
		hasEditPerm,
		hasDeletePerm,
		canAddForDate,
		lockedActive,
		canEdit,
		canDelete,
		lockReason,
	};
}
