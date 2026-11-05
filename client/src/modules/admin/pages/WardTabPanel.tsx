import { Plus } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import type { ApiRecord, ApiReport } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';
import { formatDateToVN } from '@/utils/dateUtils';
import { buildStripItems } from '@/utils/UIHelperUtils';
import type { aggregateDashboardStats } from '@/utils/staffingCalc';
import type { PointerEvent, RefObject, WheelEvent } from 'react';
import StatCard from '../components/StatCard';
import DataPager from './DataPager';
import type { DeptPerm } from './WardTable';
import WardTable from './WardTable';

export interface WardTabPanelProps {
	selDate: string;
	report: ApiReport | null;
	loadingReport: boolean;
	onOpenCreateReport: () => void;

	stats: ReturnType<typeof aggregateDashboardStats>;
	filtered: KhoaRecord[];
	pageRows: KhoaRecord[];
	getPermForDept: (id_department: number) => DeptPerm | undefined;
	onEdit: (rec: ApiRecord) => void;
	onDelete: (target: { id: number; name: string }) => void;

	scrollTopRef: RefObject<HTMLDivElement | null>;
	tblOuterRef: RefObject<HTMLDivElement | null>;
	scrollThumb: { left: number; width: number; visible: boolean };
	onThumbPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
	onThumbPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
	onThumbPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
	onTrackPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
	onTableWheel: (e: WheelEvent<HTMLDivElement>) => void;

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
	onOpenCreateReport,
	stats,
	filtered,
	pageRows,
	getPermForDept,
	onEdit,
	onDelete,
	scrollTopRef,
	tblOuterRef,
	scrollThumb,
	onThumbPointerDown,
	onThumbPointerMove,
	onThumbPointerUp,
	onTrackPointerDown,
	onTableWheel,
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
					onPointerDown={onTrackPointerDown}
				>
					{scrollThumb.visible && (
						<div
							className='dv-scroll-top-thumb'
							style={{ left: scrollThumb.left, width: scrollThumb.width }}
							onPointerDown={onThumbPointerDown}
							onPointerMove={onThumbPointerMove}
							onPointerUp={onThumbPointerUp}
							onPointerCancel={onThumbPointerUp}
						/>
					)}
				</div>
				<div className='dv-tbl-outer'>
					<div
						className='dv-tbl-hscroll'
						ref={tblOuterRef}
						onWheel={onTableWheel}
					>
						{loadingReport ? (
							<EmptyState
								loading
								title='Đang tải dữ liệu...'
							/>
						) : !report ? (
							<EmptyState
								title={`Chưa có báo cáo cho ngày ${formatDateToVN(selDate)}`}
								sub='Tạo báo cáo để nhập số liệu nhân lực của các khoa nội trú.'
								action={
									<button
										className='btn-primary'
										onClick={onOpenCreateReport}
									>
										<Plus size={15} /> Tạo báo cáo ngày này
									</button>
								}
							/>
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
