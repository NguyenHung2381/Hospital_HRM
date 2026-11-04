import { Plus, X } from 'lucide-react';
import XIcon from '@/assets/svg/XIcon';
import type { ApiReport } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';

export interface MissingDept {
	id_department: number;
	department_name: string;
}

export interface WardTabActionsProps {
	report: ApiReport | null;
	loadingReport: boolean;
	selKhoa: Set<number>;
	allRows: KhoaRecord[];
	canDeleteReport: boolean;
	onToggleDrawer: () => void;
	onOpenAddRecord: () => void;
	onClearFilter: () => void;
	onOpenDeleteReport: () => void;
	onOpenCreateReport: () => void;
}

/** Các nút thao tác trong PageHeader của tab Khối nội trú — DataPage. */
export default function WardTabActions({
	report,
	loadingReport,
	selKhoa,
	allRows,
	canDeleteReport,
	onToggleDrawer,
	onOpenAddRecord,
	onClearFilter,
	onOpenDeleteReport,
	onOpenCreateReport,
}: WardTabActionsProps) {
	return (
		<>
			<button
				className='dv-drawer-toggle'
				onClick={onToggleDrawer}
			>
				<XIcon size={16} /> Bộ lọc
			</button>
			{selKhoa.size > 0 && selKhoa.size < allRows.length && (
				<button
					className='btn-ghost'
					onClick={onClearFilter}
				>
					<X size={14} /> Bỏ lọc ({selKhoa.size})
				</button>
			)}
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
					onClick={onOpenAddRecord}
				>
					<Plus size={15} /> Thêm khoa
				</button>
			)}
			{!report && !loadingReport && (
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
