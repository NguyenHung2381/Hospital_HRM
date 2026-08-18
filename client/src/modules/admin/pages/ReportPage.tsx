import DownloadIcon from '@/assets/svg/DownloadIcon';
import PageHeader from '../components/PageHeader';
import type { ReportConfig } from '@/types/reportType';
import { defaultReportConfig } from '@/constants/mockData';
import { useAuth } from '@/context/useAuth';
import { useState, useMemo } from 'react';
import { useExcelExport } from '@/hooks/useExcelExport';
import RangePicker from './RangePicker';
import { DEFAULT_DAY, DEFAULT_MONTH, DEFAULT_WEEK, DEFAULT_YEAR, GROUP_TABS } from './reportPageConstants';
import {
	isoWeeksInYear,
	pad,
	rangeToApiDates,
	type DayRange,
	type GroupBy,
	type MonthRange,
	type WeekRange,
	type YearRange,
} from './reportRangeUtils';

/** Mẫu CLS chỉ hỗ trợ liệt kê theo ngày (1 sheet/ngày) — giới hạn để tránh sinh quá nhiều sheet. */
const CLS_MAX_DAYS = 31;

// ── Page ──────────────────────────────────────────────────
export default function ReportPage({ inModal = false }: { inModal?: boolean }) {
	const { khoaList } = useAuth();

	const [groupBy, setGroupBy] = useState<GroupBy>('day');
	const [cfg, setCfg] = useState<ReportConfig>(defaultReportConfig());
	const [dayRange, setDayRange] = useState<DayRange>(DEFAULT_DAY);
	const [weekRange, setWeekRange] = useState<WeekRange>(DEFAULT_WEEK);
	const [monthRange, setMonthRange] = useState<MonthRange>(DEFAULT_MONTH);
	const [yearRange, setYearRange] = useState<YearRange>(DEFAULT_YEAR);

	const setField = <K extends keyof ReportConfig>(k: K, v: ReportConfig[K]) =>
		setCfg((p) => ({ ...p, [k]: v }));

	const activeTab = GROUP_TABS.find((t) => t.value === groupBy)!;
	const scope = cfg.rScope;
	// Cột "Một khoa" chỉ áp dụng cho khối nội trú — mẫu CLS không tách theo từng khoa riêng
	const wardKhoaList = useMemo(
		() => khoaList.filter((k) => k.deptGroup !== 'cls'),
		[khoaList],
	);
	const khoaName =
		scope === 'all'
			? 'Toàn bệnh viện (2 file)'
			: scope === 'ward'
				? 'Khoa nội trú (toàn bộ)'
				: scope === 'cls'
					? 'Hệ Cận lâm sàng (toàn bộ)'
					: (wardKhoaList.find((k) => String(k.id) === cfg.rKhoa)?.ten ?? '—');
	const weeksInFromYear = isoWeeksInYear(weekRange.fromYear);
	const weeksInToYear = isoWeeksInYear(weekRange.toYear);

	// Badge tóm tắt khoảng đã chọn
	const rangeSummary = useMemo(() => {
		switch (groupBy) {
			case 'day':
				return dayRange.from && dayRange.to && dayRange.from <= dayRange.to
					? `${dayRange.from} → ${dayRange.to}`
					: null;
			case 'week':
				return weekRange.fromYear === weekRange.toYear
					? `Tuần ${weekRange.fromWeek} → Tuần ${weekRange.toWeek} năm ${weekRange.fromYear}`
					: `Tuần ${weekRange.fromWeek}/${weekRange.fromYear} → Tuần ${weekRange.toWeek}/${weekRange.toYear}`;
			case 'month':
				return monthRange.fromYear === monthRange.toYear
					? `Tháng ${monthRange.fromMonth} → Tháng ${monthRange.toMonth}/${monthRange.fromYear}`
					: `${pad(monthRange.fromMonth)}/${monthRange.fromYear} → ${pad(monthRange.toMonth)}/${monthRange.toYear}`;
			case 'year':
				return yearRange.fromYear === yearRange.toYear
					? `Năm ${yearRange.fromYear}`
					: `${yearRange.fromYear} → ${yearRange.toYear}`;
		}
	}, [groupBy, dayRange, weekRange, monthRange, yearRange]);

	// Validate range
	const rangeError = useMemo((): string => {
		switch (groupBy) {
			case 'day':
				if (!dayRange.from || !dayRange.to)
					return 'Vui lòng chọn khoảng thời gian';
				if (dayRange.from > dayRange.to)
					return 'Ngày bắt đầu phải trước ngày kết thúc';
				return '';
			case 'week':
				if (weekRange.fromYear > weekRange.toYear)
					return 'Năm bắt đầu phải ≤ năm kết thúc';
				if (
					weekRange.fromYear === weekRange.toYear &&
					weekRange.fromWeek > weekRange.toWeek
				)
					return 'Tuần bắt đầu phải ≤ tuần kết thúc';
				return '';
			case 'month':
				if (monthRange.fromYear > monthRange.toYear)
					return 'Năm bắt đầu phải ≤ năm kết thúc';
				if (
					monthRange.fromYear === monthRange.toYear &&
					monthRange.fromMonth > monthRange.toMonth
				)
					return 'Tháng bắt đầu phải ≤ tháng kết thúc';
				return '';
			case 'year':
				if (yearRange.fromYear > yearRange.toYear)
					return 'Năm bắt đầu phải ≤ năm kết thúc';
				return '';
		}
	}, [groupBy, dayRange, weekRange, monthRange, yearRange]);

	// Số ngày thực tế trong khoảng đã chọn (dùng để giới hạn xuất CLS — 1 sheet/ngày)
	const rangeDayCount = useMemo(() => {
		const { from, to } = rangeToApiDates(groupBy, dayRange, weekRange, monthRange, yearRange);
		if (!from || !to) return 0;
		const diff =
			Math.round(
				(new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
					86_400_000,
			) + 1;
		return diff > 0 ? diff : 0;
	}, [groupBy, dayRange, weekRange, monthRange, yearRange]);

	const clsRangeError =
		(scope === 'all' || scope === 'cls') && rangeDayCount > CLS_MAX_DAYS
			? `Báo cáo hệ CLS chỉ hỗ trợ tối đa ${CLS_MAX_DAYS} ngày/lần xuất (đang chọn ${rangeDayCount} ngày)`
			: '';

	const { loading, errorMsg, setErrorMsg, handleExportExcel } = useExcelExport(
		cfg,
		groupBy,
		dayRange,
		weekRange,
		monthRange,
		yearRange,
		rangeError || clsRangeError,
	);

	return (
		<div className={inModal ? 'rp rp--modal' : 'rp'}>
			{!inModal && (
				<PageHeader
					title='Xuất báo cáo'
					subtitle='Xuất dữ liệu nhân lực ĐD – HS – KTV ra file Excel'
				/>
			)}

			<div className='rp-body'>
				{/* ══ CỘT TRÁI ════════════════════════════════════════ */}
				<div className='rp-left'>
					{/* ── Bước 1: Kỳ báo cáo ─────────────────────────── */}
					<div className='rp-step'>
						<div className='rp-step-hdr'>
							<span className='rp-step-num'>1</span>
							<span className='rp-step-title'>Chọn kỳ báo cáo</span>
						</div>

						<div className='rp-tabs'>
							{GROUP_TABS.map((t) => (
								<button
									key={t.value}
									className={`rp-tab${groupBy === t.value ? ' rp-tab--active' : ''}`}
									onClick={() => {
										setGroupBy(t.value);
										setErrorMsg('');
									}}
								>
									<span className='rp-tab-icon'>{t.icon}</span>
									<span className='rp-tab-label'>{t.label}</span>
								</button>
							))}
						</div>

						<p className='rp-tab-hint'>{activeTab.hint}</p>

						<RangePicker
							groupBy={groupBy}
							dayRange={dayRange}
							setDayRange={setDayRange}
							weekRange={weekRange}
							setWeekRange={setWeekRange}
							monthRange={monthRange}
							setMonthRange={setMonthRange}
							yearRange={yearRange}
							setYearRange={setYearRange}
							weeksInFromYear={weeksInFromYear}
							weeksInToYear={weeksInToYear}
						/>

						{rangeSummary && !rangeError && (
							<p className='rp-date-badge'>🗓️ {rangeSummary}</p>
						)}
						{rangeError && <p className='rp-range-err'>⚠️ {rangeError}</p>}
						{!rangeError && clsRangeError && (
							<p className='rp-range-err'>⚠️ {clsRangeError}</p>
						)}
					</div>

					{/* ── Bước 2: Phạm vi ─────────────────────────────── */}
					<div className='rp-step'>
						<div className='rp-step-hdr'>
							<span className='rp-step-num'>2</span>
							<span className='rp-step-title'>Phạm vi xuất</span>
						</div>

						<div className='rp-scope-toggle'>
							<button
								className={`rp-scope-btn${scope === 'all' ? ' rp-scope-btn--active' : ''}`}
								onClick={() => setField('rScope', 'all')}
								title='Sinh 2 file: khoa nội trú + hệ CLS'
							>
								🏥 Toàn bệnh viện
							</button>
							<button
								className={`rp-scope-btn${scope === 'ward' ? ' rp-scope-btn--active' : ''}`}
								onClick={() => setField('rScope', 'ward')}
							>
								🛏️ Khoa nội trú
							</button>
							<button
								className={`rp-scope-btn${scope === 'cls' ? ' rp-scope-btn--active' : ''}`}
								onClick={() => setField('rScope', 'cls')}
							>
								🧪 Hệ Cận lâm sàng
							</button>
							<button
								className={`rp-scope-btn${scope === 'one' ? ' rp-scope-btn--active' : ''}`}
								onClick={() => {
									setField('rScope', 'one');
									if (!wardKhoaList.some((k) => String(k.id) === cfg.rKhoa)) {
										setField(
											'rKhoa',
											wardKhoaList.length > 0 ? String(wardKhoaList[0].id) : 'all',
										);
									}
								}}
							>
								🏨 Một khoa (nội trú)
							</button>
						</div>

						{scope === 'one' && (
							<div style={{ marginTop: 10 }}>
								<label className='rp-label'>Chọn khoa</label>
								<select
									className='rp-input rp-select'
									value={cfg.rKhoa}
									onChange={(e) => setField('rKhoa', e.target.value)}
								>
									{wardKhoaList.map((k) => (
										<option
											key={k.id}
											value={String(k.id)}
										>
											{k.ten}
										</option>
									))}
								</select>
							</div>
						)}
					</div>

					{errorMsg && <div className='rp-error'>⚠️ {errorMsg}</div>}

					<div className='rp-actions'>
						<button
							className='rp-export-btn'
							onClick={handleExportExcel}
							disabled={loading || !!rangeError || !!clsRangeError}
						>
							{loading ? (
								<>
									<span className='rp-spinner' /> Đang xuất…
								</>
							) : (
								<>
									<DownloadIcon />{' '}
									{scope === 'all' ? 'Xuất Excel (2 file)' : 'Xuất Excel (.xlsx)'}
								</>
							)}
						</button>
						<button
							className='rp-export-btn rp-export-btn--outline'
							disabled
							title='Đang phát triển'
						>
							<DownloadIcon /> Xuất PDF
						</button>
					</div>
				</div>

				{/* ══ CỘT PHẢI: XEM TRƯỚC ════════════════════════════ */}
				<div className='rp-right'>
					<p className='rp-preview-title'>📋 Nội dung file Excel sẽ xuất</p>

					<div className='rp-meta-grid'>
						<div className='rp-meta-item'>
							<span className='rp-meta-icon'>{activeTab.icon}</span>
							<div>
								<p className='rp-meta-label'>Kỳ báo cáo</p>
								<p className='rp-meta-val'>{activeTab.label}</p>
							</div>
						</div>
						<div className='rp-meta-item'>
							<span className='rp-meta-icon'>🏥</span>
							<div>
								<p className='rp-meta-label'>Phạm vi</p>
								<p className='rp-meta-val'>{khoaName}</p>
							</div>
						</div>
						<div className='rp-meta-item'>
							<span className='rp-meta-icon'>📆</span>
							<div>
								<p className='rp-meta-label'>Khoảng chọn</p>
								<p className='rp-meta-val'>{rangeSummary ?? '—'}</p>
							</div>
						</div>
					</div>

					{(scope === 'all' || scope === 'ward') && (
						<div className='rp-sheets'>
							<div className='rp-sheet rp-sheet--primary'>
								<div className='rp-sheet-hdr'>
									<span className='rp-sheet-badge'>
										{scope === 'all' ? 'File 1 · Sheet 1' : 'Sheet 1'}
									</span>
									<span className='rp-sheet-name'>Tổng hợp toàn BV (nội trú)</span>
								</div>
								<ul className='rp-sheet-cols'>
									<li>
										Kỳ báo cáo <em>({activeTab.hint})</em>
									</li>
									<li>Tổng người bệnh</li>
									<li>Tổng nhân viên · Đi làm</li>
									<li>Nghỉ trực · Nghỉ &gt;2 ngày</li>
									<li>⚠️ Số khoa không đủ nhân lực</li>
									<li>NL TT03 toàn BV · Điều phối</li>
								</ul>
							</div>
							<div className='rp-sheet'>
								<div className='rp-sheet-hdr'>
									<span className='rp-sheet-badge rp-sheet-badge--sec'>
										{scope === 'all' ? 'File 1 · Sheet 2…N' : 'Sheet 2…N'}
									</span>
									<span className='rp-sheet-name'>Từng khoa nội trú riêng</span>
								</div>
								<ul className='rp-sheet-cols'>
									<li>
										Kỳ báo cáo <em>({activeTab.hint})</em>
									</li>
									<li>NB CSC1 / CSC2 / CSC3 · Tổng NB · Ngoại trú</li>
									<li>NV Tổng / Nghỉ trực / Nghỉ &gt;2ng / Đi làm</li>
									<li>NL TT03 · NL Khuyến nghị</li>
									<li>Điều phối NL (so Khuyến nghị)</li>
									<li className='rp-sheet-note'>
										⬜ Kỳ không có dữ liệu → ghi rõ trong dòng
									</li>
								</ul>
							</div>
							{scope === 'all' && (
								<div className='rp-sheet'>
									<div className='rp-sheet-hdr'>
										<span className='rp-sheet-badge rp-sheet-badge--sec'>
											File 2
										</span>
										<span className='rp-sheet-name'>
											Hệ Cận lâm sàng — Tổng quan + 1 sheet/ngày
										</span>
									</div>
									<ul className='rp-sheet-cols'>
										<li>Sheet 1: Tổng quan — 1 dòng/khoa, gộp cả kỳ</li>
										<li>Sheet 2…N+1: đúng mẫu gốc, 10 khoa CLS/ngày</li>
										<li>Khối lượng CV đã thực hiện · Số lượng tồn/chờ</li>
										<li>Tổng NL · Nghỉ trực · Nghỉ &gt;2 ngày · Đi làm</li>
										<li>Tỷ lệ đi làm/KLCV · NL khuyến cáo · Chênh lệch</li>
										<li className='rp-sheet-note'>
											⚠️ Tối đa {CLS_MAX_DAYS} ngày/lần xuất
										</li>
									</ul>
								</div>
							)}
						</div>
					)}

					{scope === 'cls' && (
						<div className='rp-sheets'>
							<div className='rp-sheet rp-sheet--primary'>
								<div className='rp-sheet-hdr'>
									<span className='rp-sheet-badge'>Sheet 1</span>
									<span className='rp-sheet-name'>Tổng quan CLS</span>
								</div>
								<ul className='rp-sheet-cols'>
									<li>1 dòng/khoa, gộp cả kỳ đã chọn</li>
									<li>NL · Nghỉ trực · Nghỉ &gt;2 ngày · Đi làm (trung bình/ngày)</li>
									<li>Tỷ lệ đi làm/KLCV cả kỳ · NL khuyến cáo · Chênh lệch</li>
								</ul>
							</div>
							<div className='rp-sheet'>
								<div className='rp-sheet-hdr'>
									<span className='rp-sheet-badge rp-sheet-badge--sec'>
										Sheet 2…N+1
									</span>
									<span className='rp-sheet-name'>Hệ Cận lâm sàng — 1 sheet/ngày</span>
								</div>
								<ul className='rp-sheet-cols'>
									<li>Đúng mẫu gốc: 10 khoa CLS (Huyết học, Hóa sinh, Vi sinh…)</li>
									<li>Khối lượng CV đã thực hiện · Số lượng tồn/chờ</li>
									<li>Tổng NL · Nghỉ trực · Nghỉ &gt;2 ngày · Đi làm</li>
									<li>Tỷ lệ đi làm/KLCV · NL khuyến cáo · Chênh lệch</li>
									<li className='rp-sheet-note'>
										⚠️ Tối đa {CLS_MAX_DAYS} ngày/lần xuất
									</li>
								</ul>
							</div>
						</div>
					)}

					{scope === 'one' && (
						<div className='rp-sheets'>
							<div className='rp-sheet rp-sheet--primary'>
								<div className='rp-sheet-hdr'>
									<span className='rp-sheet-badge'>1 Sheet</span>
									<span className='rp-sheet-name'>{khoaName}</span>
								</div>
								<ul className='rp-sheet-cols'>
									<li>
										Kỳ báo cáo <em>({activeTab.hint})</em>
									</li>
									<li>NB CSC1 / CSC2 / CSC3 · Tổng NB · Ngoại trú</li>
									<li>NV Tổng / Nghỉ trực / Nghỉ &gt;2ng / Đi làm</li>
									<li>NL TT03 · NL Khuyến nghị</li>
									<li>Điều phối NL (so Khuyến nghị)</li>
									<li className='rp-sheet-note'>
										⬜ Kỳ không có dữ liệu → ghi rõ trong dòng
									</li>
								</ul>
							</div>
						</div>
					)}

					<div className='rp-legend'>
						<p className='rp-legend-title'>Chú giải màu trong file Excel</p>
						<div className='rp-legend-row'>
							<span
								className='rp-legend-dot'
								style={{ background: '#375623' }}
							/>
							<span>Thặng nhân lực — Đi làm &gt; Khuyến nghị</span>
						</div>
						<div className='rp-legend-row'>
							<span
								className='rp-legend-dot'
								style={{ background: '#C00000' }}
							/>
							<span>Thiếu nhân lực — Đi làm &lt; Khuyến nghị</span>
						</div>
						<div className='rp-legend-row'>
							<span
								className='rp-legend-dot'
								style={{ background: '#CCCCCC' }}
							/>
							<span>Không có dữ liệu</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
