import { CalendarDays } from 'lucide-react';
import { formatDateToVN, getTodayDateString } from '@/utils/dateUtils';
import {
	aggregateDashboardStats,
	getTrendStats,
	toKhoaRecord,
} from '@/utils/staffingCalc';
import { aggregateClsDashboardStats, toKhoaClsRecord } from '@/utils/clsCalc';
import { useDashboardReports } from '@/hooks/useDashboardReports';
import PageHeader from '../components/PageHeader';
import DashboardBriefing from './DashboardBriefing';
import DashboardClsSection from './DashboardClsSection';
import DashboardPatientStats from './DashboardPatientStats';
import DashboardStaffStatus from './DashboardStaffStatus';
import DashboardSystemInfo from './DashboardSystemInfo';
import DashboardTopShortage from './DashboardTopShortage';
import DashboardTrendChart from './DashboardTrendChart';

export default function DashboardPage() {
	const { allReports, loading, selIdx, setSelIdx } = useDashboardReports();

	if (loading) {
		return (
			<div
				className='pg'
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					minHeight: 300,
				}}
			>
				<p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--fs-md)' }}>
					Đang tải dữ liệu...
				</p>
			</div>
		);
	}

	if (!allReports.length) {
		return (
			<div
				className='pg'
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					minHeight: 300,
				}}
			>
				<p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--fs-md)' }}>
					Chưa có dữ liệu báo cáo.
				</p>
			</div>
		);
	}

	const selectedReport = allReports[selIdx];

	const rows = selectedReport.records.map((r, i) => toKhoaRecord(r, i + 1));
	const clsRows = selectedReport.cls_records.map((r, i) =>
		toKhoaClsRecord(r, i + 1),
	);
	const selDateStr = selectedReport.report_date.slice(0, 10);
	const isToday = selDateStr === getTodayDateString();

	const {
		totalNB,
		totalCSC1,
		totalCSC2,
		totalCSC3,
		totalNBKham,
		totalNL,
		totalDiLam,
		totalNghiTruc,
		totalNghiDai,
		totalTT03,
		totalKC,
		rateDiLam,
		khoaThieu,
		tongThieu,
		top5Thieu,
	} = aggregateDashboardStats(rows);

	const clsStats = aggregateClsDashboardStats(clsRows);

	// Trend luôn dùng 7 ngày mới nhất: allReports xếp mới → cũ, getTrendStats lấy
	// slice(-7) nên phải đảo về cũ → mới (vừa đúng 7 ngày, vừa vẽ trái → phải).
	const multiDayData = [...allReports].reverse().map((rep) => ({
		date: rep.report_date.slice(0, 10),
		data: rep.records.map((r, i) => toKhoaRecord(r, i + 1)),
	}));
	const { trend7, maxTrendNB, maxTrendNL } = getTrendStats(multiDayData, 7);

	return (
		<div className='pg'>
			<PageHeader title='Tổng quan'>
				{/* ── Chọn ngày xem ── */}
				<div className='ov-date-select-wrap'>
					<label
						className='ov-date-select-lbl'
						htmlFor='ov-date-sel'
					>
						<CalendarDays size={14} /> Ngày báo cáo
					</label>
					<select
						id='ov-date-sel'
						className='ov-date-select'
						value={selIdx}
						onChange={(e) => setSelIdx(Number(e.target.value))}
					>
						{allReports.map((r, i) => (
							<option
								key={r.id_report}
								value={i}
							>
								{formatDateToVN(r.report_date.slice(0, 10))}
								{i === 0 ? ' — Mới nhất' : ''}
							</option>
						))}
					</select>
				</div>
			</PageHeader>

			<DashboardBriefing
				selDateStr={selDateStr}
				isToday={isToday}
				khoaCount={rows.length}
				totalNB={totalNB}
				totalNBKham={totalNBKham}
				totalNL={totalNL}
				totalDiLam={totalDiLam}
				khoaThieuCount={khoaThieu.length}
				tongThieu={tongThieu}
			/>

			{/* ── Nhân lực so với TT03 + Người bệnh ── */}
			<h3 className='ov-section-title'>Khối nội trú</h3>
			<div className='ov-row2'>
				<DashboardStaffStatus
					rateDiLam={rateDiLam}
					totalNL={totalNL}
					totalDiLam={totalDiLam}
					totalNghiTruc={totalNghiTruc}
					totalNghiDai={totalNghiDai}
					totalTT03={totalTT03}
					totalKC={totalKC}
				/>

				<DashboardPatientStats
					totalCSC1={totalCSC1}
					totalCSC2={totalCSC2}
					totalCSC3={totalCSC3}
					totalNBKham={totalNBKham}
					totalNB={totalNB}
				/>

				{/* Không có khoa thiếu thì khối tóm tắt đã nói rõ — bỏ khối trống */}
				{top5Thieu.length > 0 && <DashboardTopShortage top5Thieu={top5Thieu} />}

				<DashboardTrendChart
					wide={top5Thieu.length === 0}
					trend7={trend7}
					maxTrendNB={maxTrendNB}
					maxTrendNL={maxTrendNL}
					selDateStr={selDateStr}
					allReports={allReports}
					setSelIdx={setSelIdx}
					rows={rows}
				/>
			</div>

			{/* ── Row 3: Hệ Cận lâm sàng ── */}
			<h3 className='ov-section-title'>Hệ Cận lâm sàng</h3>
			<DashboardClsSection
				clsRowsCount={clsRows.length}
				clsStats={clsStats}
			/>

			{/* ── Thông tin tham chiếu ── */}
			<DashboardSystemInfo />
		</div>
	);
}
