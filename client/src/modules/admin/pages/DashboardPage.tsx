import { getTodayDateStringVNLong, formatDateToVN } from '@/utils/dateUtils';
import {
	aggregateDashboardStats,
	getTrendStats,
	toKhoaRecord,
} from '@/utils/staffingCalc';
import { aggregateClsDashboardStats, toKhoaClsRecord } from '@/utils/clsCalc';
import { useDashboardReports } from '@/hooks/useDashboardReports';
import PageHeader from '../components/PageHeader';
import DashboardClsSection from './DashboardClsSection';
import DashboardKpiRow, { type KpiCardData } from './DashboardKpiRow';
import DashboardPatientStats from './DashboardPatientStats';
import DashboardStaffStatus from './DashboardStaffStatus';
import DashboardSystemInfo from './DashboardSystemInfo';
import DashboardTopShortage from './DashboardTopShortage';
import DashboardTrendChart from './DashboardTrendChart';

export default function DashboardPage() {
	const today = getTodayDateStringVNLong();
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
				<p style={{ color: '#64748b', fontSize: '0.9rem' }}>
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
				<p style={{ color: '#64748b', fontSize: '0.9rem' }}>
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
	const isLatest = selIdx === 0;

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
		khoaDu,
		tongThieu,
		top5Thieu,
	} = aggregateDashboardStats(rows);

	const clsStats = aggregateClsDashboardStats(clsRows);

	// Trend luôn dùng 7 ngày mới nhất
	const multiDayData = allReports.map((rep) => ({
		date: rep.report_date.slice(0, 10),
		data: rep.records.map((r, i) => toKhoaRecord(r, i + 1)),
	}));
	const { trend7, maxTrendNB, maxTrendNL } = getTrendStats(multiDayData, 7);

	const kpiCards: KpiCardData[] = [
		{
			icon: '🏥',
			val: rows.length,
			lbl: 'Tổng số khoa',
			sub: 'đang theo dõi',
			col: '#2563eb',
			bg: '#eff6ff',
		},
		{
			icon: '🛌',
			val: totalNB,
			lbl: 'Tổng người bệnh',
			sub: `${totalNBKham} NB khám/PT KH`,
			col: '#079341',
			bg: '#f0faf4',
		},
		{
			icon: '👥',
			val: totalNL,
			lbl: 'Tổng nhân lực',
			sub: `${totalDiLam} đi làm hôm nay`,
			col: '#7c3aed',
			bg: '#f5f3ff',
		},
		{
			icon: '⚠️',
			val: khoaThieu.length,
			lbl: 'Khoa thiếu NL',
			sub: `thiếu ${tongThieu} người theo TT03`,
			col: '#dc2626',
			bg: '#fef2f2',
		},
	];

	return (
		<div className='pg'>
			<PageHeader
				title='Tổng quan hệ thống'
				subtitle={today}
			>
				{/* ── Chọn ngày xem ── */}
				<div className='ov-date-select-wrap'>
					<label
						className='ov-date-select-lbl'
						htmlFor='ov-date-sel'
					>
						📅 Ngày báo cáo
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

				{isLatest && (
					<span className='ov-latest-badge'>
						<span className='ov-latest-dot' />
						Cập nhật hôm nay
					</span>
				)}
			</PageHeader>

			<DashboardKpiRow cards={kpiCards} />

			{/* ── Row 2: Người bệnh + Nhân lực ── */}
			<div className='ov-row2'>
				<DashboardPatientStats
					totalCSC1={totalCSC1}
					totalCSC2={totalCSC2}
					totalCSC3={totalCSC3}
					totalNBKham={totalNBKham}
					totalNB={totalNB}
				/>

				<DashboardStaffStatus
					rateDiLam={rateDiLam}
					totalNL={totalNL}
					totalDiLam={totalDiLam}
					totalNghiTruc={totalNghiTruc}
					totalNghiDai={totalNghiDai}
					totalTT03={totalTT03}
					totalKC={totalKC}
				/>

				<DashboardTopShortage top5Thieu={top5Thieu} />

				<DashboardTrendChart
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
			<h3
				className='hcard-title'
				style={{ margin: '4px 0 -4px' }}
			>
				🧪 Hệ Cận lâm sàng
			</h3>
			<DashboardClsSection
				clsRowsCount={clsRows.length}
				clsStats={clsStats}
			/>

			{/* ── Row 4: Thông tin hệ thống ── */}
			<DashboardSystemInfo
				rowsCount={rows.length}
				khoaDuCount={khoaDu.length}
				khoaThieuCount={khoaThieu.length}
			/>
		</div>
	);
}
