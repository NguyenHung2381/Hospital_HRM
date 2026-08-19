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
			{report && (
				<button
					className='btn-outline'
					style={{
						fontSize: '0.82rem',
						fontWeight: 600,
						border: '1.5px solid var(--p)',
						borderRadius: '8px',
						padding: '6px 12px',
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
					}}
					onClick={onOpenAddRecord}
				>
					+ Thêm khoa
				</button>
			)}
			{selKhoa.size > 0 && selKhoa.size < allRows.length && (
				<button
					className='btn-ghost'
					style={{
						fontSize: '0.82rem',
						fontWeight: 600,
						color: 'var(--red)',
						border: '1.5px solid #fecaca',
						backgroundColor: '#fff5f5',
						borderRadius: '8px',
						padding: '6px 12px',
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						cursor: 'pointer',
					}}
					onClick={onClearFilter}
				>
					✕ Bỏ lọc ({selKhoa.size})
				</button>
			)}
			{report && canDeleteReport && (
				<button
					className='btn-ghost'
					style={{
						fontSize: '0.82rem',
						fontWeight: 600,
						color: 'var(--red)',
						border: '1.5px solid #fecaca',
						backgroundColor: '#fff5f5',
						borderRadius: '8px',
						padding: '6px 12px',
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						cursor: 'pointer',
					}}
					onClick={onOpenDeleteReport}
				>
					🗑 Xóa báo cáo
				</button>
			)}
			{!report && !loadingReport && (
				<button
					className='btn-primary'
					style={{ fontSize: '.78rem' }}
					onClick={onOpenCreateReport}
				>
					＋ Tạo báo cáo
				</button>
			)}
		</>
	);
}
