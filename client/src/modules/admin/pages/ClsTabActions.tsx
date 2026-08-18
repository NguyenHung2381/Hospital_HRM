import type { ApiReport } from '@/types/apiType';
import type { MissingDept } from './WardTabActions';

export interface ClsTabActionsProps {
	report: ApiReport | null;
	loadingReport?: boolean;
	missingClsDepts: MissingDept[];
	canDeleteReport: boolean;
	onOpenAddClsRecord: () => void;
	onOpenDeleteReport: () => void;
	onOpenCreateReport?: () => void;
}

/** Các nút thao tác trong PageHeader của tab Hệ Cận lâm sàng — DataPage. */
export default function ClsTabActions({
	report,
	loadingReport = false,
	missingClsDepts,
	canDeleteReport,
	onOpenAddClsRecord,
	onOpenDeleteReport,
	onOpenCreateReport,
}: ClsTabActionsProps) {
	return (
		<>
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
						cursor: 'pointer',
					}}
					onClick={onOpenAddClsRecord}
				>
					+ Thêm báo cáo khoa CLS
				</button>
			)}
			{report && missingClsDepts.length > 0 && (
				<span
					style={{
						fontSize: '0.82rem',
						fontWeight: 600,
						background: '#fffbeb',
						color: '#b45309',
						border: '1.5px solid #fcd34d',
						borderRadius: '8px',
						padding: '6px 12px',
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						cursor: 'default',
						userSelect: 'none',
					}}
					title={missingClsDepts.map((d) => d.department_name).join('\n')}
				>
					⚠ {missingClsDepts.length} khoa CLS chưa nhập
				</span>
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
			{!report && !loadingReport && onOpenCreateReport && (
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

