import type { ApiClsRecord, ApiReport } from '@/types/apiType';
import type { KhoaClsRecord } from '@/types/clsType';
import { formatDateToVN } from '@/utils/dateUtils';
import type { aggregateClsDashboardStats } from '@/utils/clsCalc';
import ClsTable from './ClsTable';
import type { DeptPerm } from './WardTable';

export interface ClsTabPanelProps {
	selDate: string;
	report: ApiReport | null;
	loadingReport?: boolean;
	onOpenCreateReport?: () => void;
	clsRows: KhoaClsRecord[];
	clsStats: ReturnType<typeof aggregateClsDashboardStats>;
	getPermForDept: (id_department: number) => DeptPerm | undefined;
	onEdit: (rec: ApiClsRecord) => void;
	onDelete: (target: { id: number; name: string }) => void;
}

/** Toàn bộ nội dung tab "Hệ Cận lâm sàng" (CLS) — DataPage. */
export default function ClsTabPanel({
	selDate,
	report,
	loadingReport = false,
	onOpenCreateReport,
	clsRows,
	clsStats,
	getPermForDept,
	onEdit,
	onDelete,
}: ClsTabPanelProps) {
	return (
		<>
			{report && (
				<div className='dv-strip' style={{ marginBottom: 16 }}>
					<div
						className='dv-strip-card'
						style={{ '--sc': '#2563eb', '--sb': '#eff6ff' } as React.CSSProperties}
					>
						<span className='dv-sc-val'>{clsStats.totalKhoiLuong}</span>
						<span className='dv-sc-lbl'>📊 Tổng khối lượng CV</span>
					</div>
					<div
						className='dv-strip-card'
						style={{ '--sc': '#0f766e', '--sb': '#f0fdf4' } as React.CSSProperties}
					>
						<span className='dv-sc-val'>{clsStats.totalNL}</span>
						<span className='dv-sc-lbl'>👥 Tổng nhân lực</span>
					</div>
					<div
						className='dv-strip-card'
						style={{ '--sc': '#059669', '--sb': '#ecfdf5' } as React.CSSProperties}
					>
						<span className='dv-sc-val'>{clsStats.totalDiLam}</span>
						<span className='dv-sc-lbl'>✅ Nhân lực đi làm</span>
					</div>
					<div
						className='dv-strip-card'
						style={{ '--sc': '#7c3aed', '--sb': '#faf5ff' } as React.CSSProperties}
					>
						<span className='dv-sc-val'>
							{clsStats.totalKhoiLuong > 0 ? `${clsStats.rateDiLam}%` : '—'}
						</span>
						<span className='dv-sc-lbl'>📈 Tỷ lệ đi làm/KLCV</span>
					</div>
					<div
						className='dv-strip-card'
						style={
							{
								'--sc': clsStats.khoaThieu.length > 0 ? '#dc2626' : '#64748b',
								'--sb': clsStats.khoaThieu.length > 0 ? '#fef2f2' : '#f8fafc',
							} as React.CSSProperties
						}
					>
						<span className='dv-sc-val'>{clsStats.khoaThieu.length}</span>
						<span className='dv-sc-lbl'>⚠️ Khoa thiếu nhân lực</span>
					</div>
				</div>
			)}

			{loadingReport ? (
				<div
					style={{
						textAlign: 'center',
						padding: '60px',
						color: 'var(--mut)',
						fontSize: '.85rem',
					}}
				>
					Đang tải dữ liệu...
				</div>
			) : !report ? (
				<div style={{ textAlign: 'center', padding: '60px' }}>
					<p style={{ fontSize: '2rem', marginBottom: 8 }}>📋</p>
					<p
						style={{
							color: 'var(--mut)',
							fontSize: '.85rem',
							marginBottom: 16,
						}}
					>
						Chưa có báo cáo cho ngày {formatDateToVN(selDate)}
					</p>
					{onOpenCreateReport && (
						<button
							className='btn-primary'
							onClick={onOpenCreateReport}
						>
							＋ Tạo báo cáo ngày này
						</button>
					)}
				</div>
			) : (
				<div
					className='dv-tbl-wrap'
					style={{ marginBottom: 24 }}
				>
					<div className='dv-tbl-scroll'>
						<ClsTable
							clsRows={clsRows}
							report={report}
							clsStats={clsStats}
							getPermForDept={getPermForDept}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					</div>
				</div>
			)}
		</>
	);
}
