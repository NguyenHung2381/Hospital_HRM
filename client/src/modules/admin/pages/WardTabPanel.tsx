import type { ApiRecord, ApiReport } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';
import { formatDateToVN } from '@/utils/dateUtils';
import { buildStripItems } from '@/utils/UIHelperUtils';
import type { aggregateDashboardStats } from '@/utils/staffingCalc';
import type { RefObject } from 'react';
import StatCard from '../components/StatCard';
import DataPager from './DataPager';
import type { DeptPerm } from './WardTable';
import WardTable from './WardTable';
import type { MissingDept } from './WardTabActions';

export interface WardTabPanelProps {
	selDate: string;
	report: ApiReport | null;
	loadingReport: boolean;
	missingDepts: MissingDept[];
	onOpenCreateReport: () => void;

	stats: ReturnType<typeof aggregateDashboardStats>;
	filtered: KhoaRecord[];
	pageRows: KhoaRecord[];
	getPermForDept: (id_department: number) => DeptPerm | undefined;
	onEdit: (rec: ApiRecord) => void;
	onDelete: (target: { id: number; name: string }) => void;

	scrollTopRef: RefObject<HTMLDivElement | null>;
	scrollInnerRef: RefObject<HTMLDivElement | null>;
	tblOuterRef: RefObject<HTMLDivElement | null>;

	page: number;
	setPage: (p: number | ((prev: number) => number)) => void;
	pageSize: number;
	setPageSize: (n: number) => void;
	totalPages: number;
}

/** Toàn bộ nội dung tab "Khối nội trú" (ward) — DataPage. */
export default function WardTabPanel({
	selDate,
	report,
	loadingReport,
	missingDepts,
	onOpenCreateReport,
	stats,
	filtered,
	pageRows,
	getPermForDept,
	onEdit,
	onDelete,
	scrollTopRef,
	scrollInnerRef,
	tblOuterRef,
	page,
	setPage,
	pageSize,
	setPageSize,
	totalPages,
}: WardTabPanelProps) {
	return (
		<>
			{/* Strip tổng hợp */}
			<div className='dv-strip'>
				{buildStripItems(
					stats.totalNB,
					stats.totalNL,
					stats.totalDiLam,
					stats.totalTT03,
					Number(stats.totalKhuyenNghi.toFixed(2)),
					stats.totalKC,
					filtered.length,
					37,
					missingDepts.length,
				).map((s) => (
					<StatCard
						key={s.label}
						className='dv-strip-card'
						label={s.label}
						value={s.val}
						textColor={s.color}
						bgColor={s.bg}
					/>
				))}
			</div>

			{/* Bảng dữ liệu */}
			<div className='dv-tbl-wrap'>
				<div
					className='dv-scroll-top'
					ref={scrollTopRef}
				>
					<div
						className='dv-scroll-top-inner'
						ref={scrollInnerRef}
					/>
				</div>
				<div
					className='dv-tbl-outer'
					ref={tblOuterRef}
				>
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
							<button
								className='btn-primary'
								onClick={onOpenCreateReport}
							>
								＋ Tạo báo cáo ngày này
							</button>
						</div>
					) : (
						<WardTable
							filtered={filtered}
							pageRows={pageRows}
							report={report}
							stats={stats}
							getPermForDept={getPermForDept}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					)}
				</div>
			</div>

			{/* Phân trang */}
			{report && filtered.length > 0 && (
				<DataPager
					page={page}
					setPage={setPage}
					pageSize={pageSize}
					setPageSize={setPageSize}
					totalPages={totalPages}
					totalItems={filtered.length}
				/>
			)}
		</>
	);
}
