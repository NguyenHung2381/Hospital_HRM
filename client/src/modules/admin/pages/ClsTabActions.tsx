import { Plus } from 'lucide-react';
import type { ApiReport } from '@/types/apiType';

export interface ClsTabActionsProps {
	report: ApiReport | null;
	loadingReport?: boolean;
	canDeleteReport: boolean;
	onOpenAddClsRecord: () => void;
	onOpenDeleteReport: () => void;
	onOpenCreateReport?: () => void;
}

/** Các nút thao tác trong PageHeader của tab Hệ Cận lâm sàng — DataPage. */
export default function ClsTabActions({
	report,
	loadingReport = false,
	canDeleteReport,
	onOpenAddClsRecord,
	onOpenDeleteReport,
	onOpenCreateReport,
}: ClsTabActionsProps) {
	return (
		<>
			{report && canDeleteReport && (
				<button
					className='btn-ghost dv-btn-del-report'
					onClick={onOpenDeleteReport}
				>
					Xóa báo cáo
				</button>
			)}
			{report && (
				<button
					className='btn-outline'
					onClick={onOpenAddClsRecord}
				>
					<Plus size={15} /> Thêm khoa CLS
				</button>
			)}
			{!report && !loadingReport && onOpenCreateReport && (
				<button
					className='btn-primary'
					onClick={onOpenCreateReport}
				>
					<Plus size={15} /> Tạo báo cáo
				</button>
			)}
		</>
	);
}
