import DownloadIcon from '@/assets/svg/DownloadIcon';
import PageHeader from '../components/PageHeader';
import type { ReportConfig } from '@/types/reportType';
import { defaultReportConfig } from '@/constants/mockData';
import { useAuth } from '@/context/useAuth';
import { useState, useMemo } from 'react';

// ── Kiểu kỳ báo cáo ──────────────────────────────────────
type GroupBy = 'day' | 'week' | 'month' | 'year';

const GROUP_TABS: {
	value: GroupBy;
	label: string;
	icon: string;
	hint: string;
}[] = [
	{ value: 'day', label: 'Theo ngày', icon: '📅', hint: 'Mỗi dòng = 1 ngày' },
	{
		value: 'week',
		label: 'Theo tuần',
		icon: '📆',
		hint: 'Mỗi dòng = 1 tuần (Thứ 2 → CN)',
	},
	{
		value: 'month',
		label: 'Theo tháng',
		icon: '🗓️',
		hint: 'Mỗi dòng = 1 tháng',
	},
	{ value: 'year', label: 'Theo năm', icon: '📊', hint: 'Mỗi dòng = 1 năm' },
];

// ── Tiện ích ngày ─────────────────────────────────────────
const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function isoWeek(d: Date): number {
	const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const day = tmp.getUTCDay() || 7;
	tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
	return Math.ceil(
		((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
	);
}
function isoWeeksInYear(year: number): number {
	return isoWeek(new Date(year, 11, 28));
}
function mondayOfIsoWeek(week: number, year: number): Date {
	const jan4 = new Date(year, 0, 4);
	const jan4Day = jan4.getDay() || 7;
	const monday = new Date(jan4);
	monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
	return monday;
}
function lastDayOfMonth(year: number, month: number): string {
	return fmt(new Date(year, month, 0));
}

// ── State range riêng từng kỳ ─────────────────────────────
interface DayRange {
	from: string;
	to: string;
}
interface WeekRange {
	fromWeek: number;
	fromYear: number;
	toWeek: number;
	toYear: number;
}
interface MonthRange {
	fromMonth: number;
	fromYear: number;
	toMonth: number;
	toYear: number;
}
interface YearRange {
	fromYear: number;
	toYear: number;
}

function rangeToApiDates(
	groupBy: GroupBy,
	day: DayRange,
	week: WeekRange,
	month: MonthRange,
	year: YearRange,
): { from: string; to: string } {
	switch (groupBy) {
		case 'day':
			return { from: day.from, to: day.to };
		case 'week': {
			const fromDate = mondayOfIsoWeek(week.fromWeek, week.fromYear);
			const toMon = mondayOfIsoWeek(week.toWeek, week.toYear);
			const toSun = new Date(toMon);
			toSun.setDate(toMon.getDate() + 6);
			return { from: fmt(fromDate), to: fmt(toSun) };
		}
		case 'month':
			return {
				from: `${month.fromYear}-${pad(month.fromMonth)}-01`,
				to: lastDayOfMonth(month.toYear, month.toMonth),
			};
		case 'year':
			return {
				from: `${year.fromYear}-01-01`,
				to: `${year.toYear}-12-31`,
			};
	}
}

// ── Constants ────────────────────────────────────────────
const TODAY = new Date();
const THIS_WEEK = isoWeek(TODAY);
const YEAR_OPTS = Array.from({ length: 10 }, (_, i) => THIS_YEAR - 5 + i);
const MONTHS = [
	'Tháng 1',
	'Tháng 2',
	'Tháng 3',
	'Tháng 4',
	'Tháng 5',
	'Tháng 6',
	'Tháng 7',
	'Tháng 8',
	'Tháng 9',
	'Tháng 10',
	'Tháng 11',
	'Tháng 12',
];

const DEFAULT_DAY: DayRange = (() => {
	const f = new Date(TODAY);
	f.setDate(TODAY.getDate() - 29);
	return { from: fmt(f), to: fmt(TODAY) };
})();
const DEFAULT_WEEK: WeekRange = {
	fromWeek: 1,
	fromYear: THIS_YEAR,
	toWeek: THIS_WEEK,
	toYear: THIS_YEAR,
};
const DEFAULT_MONTH: MonthRange = {
	fromMonth: 1,
	fromYear: THIS_YEAR,
	toMonth: THIS_MONTH,
	toYear: THIS_YEAR,
};
const DEFAULT_YEAR: YearRange = { fromYear: THIS_YEAR - 1, toYear: THIS_YEAR };

// ── Page ──────────────────────────────────────────────────
export default function ReportPage({ inModal = false }: { inModal?: boolean }) {
	const { khoaList } = useAuth();

	const [groupBy, setGroupBy] = useState<GroupBy>('day');
	const [cfg, setCfg] = useState<ReportConfig>(defaultReportConfig());
	const [dayRange, setDayRange] = useState<DayRange>(DEFAULT_DAY);
	const [weekRange, setWeekRange] = useState<WeekRange>(DEFAULT_WEEK);
	const [monthRange, setMonthRange] = useState<MonthRange>(DEFAULT_MONTH);
	const [yearRange, setYearRange] = useState<YearRange>(DEFAULT_YEAR);
	const [loading, setLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState('');

	const setField = <K extends keyof ReportConfig>(k: K, v: ReportConfig[K]) =>
		setCfg((p) => ({ ...p, [k]: v }));

	const activeTab = GROUP_TABS.find((t) => t.value === groupBy)!;
	const isAll = cfg.rKhoa === 'all';
	const khoaName = isAll
		? 'Toàn bệnh viện'
		: (khoaList.find((k) => String(k.id) === cfg.rKhoa)?.ten ?? '—');
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

	// ── Xuất Excel ──────────────────────────────────────────
	const handleExportExcel = async () => {
		if (rangeError) {
			setErrorMsg(rangeError);
			return;
		}
		const dates = rangeToApiDates(
			groupBy,
			dayRange,
			weekRange,
			monthRange,
			yearRange,
		);
		try {
			setLoading(true);
			setErrorMsg('');
			const params = new URLSearchParams({
				from: dates.from,
				to: dates.to,
				department: cfg.rKhoa ?? 'all',
				groupBy,
			});
			const res = await fetch(`/api/reports/export?${params}`, {
				headers: {
					Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
				},
			});
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				throw new Error(
					(json as { message?: string }).message ?? `Lỗi ${res.status}`,
				);
			}
			const disposition = res.headers.get('content-disposition') ?? '';
			const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;"\n]+)/i);
			const filename = match
				? decodeURIComponent(match[1].trim().replace(/"/g, ''))
				: `BaoCaoNhanLuc_${dates.from}_${dates.to}.xlsx`;
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (err: unknown) {
			setErrorMsg(
				err instanceof Error ? err.message : 'Xuất thất bại, vui lòng thử lại',
			);
		} finally {
			setLoading(false);
		}
	};

	// ── Picker động theo kỳ ─────────────────────────────────
	const renderRangePicker = () => {
		switch (groupBy) {
			case 'day':
				return (
					<div className='rp-date-row'>
						<div className='rp-date-field'>
							<label className='rp-label'>Từ ngày</label>
							<input
								type='date'
								className='rp-input'
								value={dayRange.from}
								onChange={(e) =>
									setDayRange((p) => ({ ...p, from: e.target.value }))
								}
							/>
						</div>
						<span className='rp-date-sep'>→</span>
						<div className='rp-date-field'>
							<label className='rp-label'>Đến ngày</label>
							<input
								type='date'
								className='rp-input'
								value={dayRange.to}
								min={dayRange.from}
								onChange={(e) =>
									setDayRange((p) => ({ ...p, to: e.target.value }))
								}
							/>
						</div>
					</div>
				);

			case 'week':
				return (
					<div className='rp-range-grid'>
						<div className='rp-range-block'>
							<p className='rp-range-block-lbl'>Từ tuần</p>
							<div className='rp-range-row'>
								<div className='rp-range-field'>
									<label className='rp-label'>Tuần</label>
									<select
										className='rp-input rp-select'
										value={weekRange.fromWeek}
										onChange={(e) =>
											setWeekRange((p) => ({ ...p, fromWeek: +e.target.value }))
										}
									>
										{Array.from(
											{ length: weeksInFromYear },
											(_, i) => i + 1,
										).map((w) => (
											<option
												key={w}
												value={w}
											>
												Tuần {w}
											</option>
										))}
									</select>
								</div>
								<div className='rp-range-field'>
									<label className='rp-label'>Năm</label>
									<select
										className='rp-input rp-select'
										value={weekRange.fromYear}
										onChange={(e) =>
											setWeekRange((p) => ({ ...p, fromYear: +e.target.value }))
										}
									>
										{YEAR_OPTS.map((y) => (
											<option
												key={y}
												value={y}
											>
												{y}
											</option>
										))}
									</select>
								</div>
							</div>
						</div>
						<span className='rp-range-arrow'>→</span>
						<div className='rp-range-block'>
							<p className='rp-range-block-lbl'>Đến tuần</p>
							<div className='rp-range-row'>
								<div className='rp-range-field'>
									<label className='rp-label'>Tuần</label>
									<select
										className='rp-input rp-select'
										value={weekRange.toWeek}
										onChange={(e) =>
											setWeekRange((p) => ({ ...p, toWeek: +e.target.value }))
										}
									>
										{Array.from({ length: weeksInToYear }, (_, i) => i + 1).map(
											(w) => (
												<option
													key={w}
													value={w}
												>
													Tuần {w}
												</option>
											),
										)}
									</select>
								</div>
								<div className='rp-range-field'>
									<label className='rp-label'>Năm</label>
									<select
										className='rp-input rp-select'
										value={weekRange.toYear}
										onChange={(e) =>
											setWeekRange((p) => ({ ...p, toYear: +e.target.value }))
										}
									>
										{YEAR_OPTS.map((y) => (
											<option
												key={y}
												value={y}
											>
												{y}
											</option>
										))}
									</select>
								</div>
							</div>
						</div>
					</div>
				);

			case 'month':
				return (
					<div className='rp-range-grid'>
						<div className='rp-range-block'>
							<p className='rp-range-block-lbl'>Từ tháng</p>
							<div className='rp-range-row'>
								<div className='rp-range-field'>
									<label className='rp-label'>Tháng</label>
									<select
										className='rp-input rp-select'
										value={monthRange.fromMonth}
										onChange={(e) =>
											setMonthRange((p) => ({
												...p,
												fromMonth: +e.target.value,
											}))
										}
									>
										{MONTHS.map((m, i) => (
											<option
												key={i + 1}
												value={i + 1}
											>
												{m}
											</option>
										))}
									</select>
								</div>
								<div className='rp-range-field'>
									<label className='rp-label'>Năm</label>
									<select
										className='rp-input rp-select'
										value={monthRange.fromYear}
										onChange={(e) =>
											setMonthRange((p) => ({
												...p,
												fromYear: +e.target.value,
											}))
										}
									>
										{YEAR_OPTS.map((y) => (
											<option
												key={y}
												value={y}
											>
												{y}
											</option>
										))}
									</select>
								</div>
							</div>
						</div>
						<span className='rp-range-arrow'>→</span>
						<div className='rp-range-block'>
							<p className='rp-range-block-lbl'>Đến tháng</p>
							<div className='rp-range-row'>
								<div className='rp-range-field'>
									<label className='rp-label'>Tháng</label>
									<select
										className='rp-input rp-select'
										value={monthRange.toMonth}
										onChange={(e) =>
											setMonthRange((p) => ({ ...p, toMonth: +e.target.value }))
										}
									>
										{MONTHS.map((m, i) => (
											<option
												key={i + 1}
												value={i + 1}
											>
												{m}
											</option>
										))}
									</select>
								</div>
								<div className='rp-range-field'>
									<label className='rp-label'>Năm</label>
									<select
										className='rp-input rp-select'
										value={monthRange.toYear}
										onChange={(e) =>
											setMonthRange((p) => ({ ...p, toYear: +e.target.value }))
										}
									>
										{YEAR_OPTS.map((y) => (
											<option
												key={y}
												value={y}
											>
												{y}
											</option>
										))}
									</select>
								</div>
							</div>
						</div>
					</div>
				);

			case 'year':
				return (
					<div className='rp-date-row'>
						<div className='rp-date-field'>
							<label className='rp-label'>Từ năm</label>
							<select
								className='rp-input rp-select'
								value={yearRange.fromYear}
								onChange={(e) =>
									setYearRange((p) => ({ ...p, fromYear: +e.target.value }))
								}
							>
								{YEAR_OPTS.map((y) => (
									<option
										key={y}
										value={y}
									>
										{y}
									</option>
								))}
							</select>
						</div>
						<span className='rp-date-sep'>→</span>
						<div className='rp-date-field'>
							<label className='rp-label'>Đến năm</label>
							<select
								className='rp-input rp-select'
								value={yearRange.toYear}
								onChange={(e) =>
									setYearRange((p) => ({ ...p, toYear: +e.target.value }))
								}
							>
								{YEAR_OPTS.map((y) => (
									<option
										key={y}
										value={y}
									>
										{y}
									</option>
								))}
							</select>
						</div>
					</div>
				);
		}
	};

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

						{renderRangePicker()}

						{rangeSummary && !rangeError && (
							<p className='rp-date-badge'>🗓️ {rangeSummary}</p>
						)}
						{rangeError && <p className='rp-range-err'>⚠️ {rangeError}</p>}
					</div>

					{/* ── Bước 2: Phạm vi ─────────────────────────────── */}
					<div className='rp-step'>
						<div className='rp-step-hdr'>
							<span className='rp-step-num'>2</span>
							<span className='rp-step-title'>Phạm vi xuất</span>
						</div>

						<div className='rp-scope-toggle'>
							<button
								className={`rp-scope-btn${isAll ? ' rp-scope-btn--active' : ''}`}
								onClick={() => setField('rKhoa', 'all')}
							>
								🏥 Toàn bệnh viện
							</button>
							<button
								className={`rp-scope-btn${!isAll ? ' rp-scope-btn--active' : ''}`}
								onClick={() =>
									setField(
										'rKhoa',
										khoaList.length > 0 ? String(khoaList[0].id) : 'all',
									)
								}
							>
								🏨 Một khoa
							</button>
						</div>

						{!isAll && (
							<div style={{ marginTop: 10 }}>
								<label className='rp-label'>Chọn khoa</label>
								<select
									className='rp-input rp-select'
									value={cfg.rKhoa}
									onChange={(e) => setField('rKhoa', e.target.value)}
								>
									{khoaList.map((k) => (
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
							disabled={loading || !!rangeError}
						>
							{loading ? (
								<>
									<span className='rp-spinner' /> Đang xuất…
								</>
							) : (
								<>
									<DownloadIcon /> Xuất Excel (.xlsx)
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

					{isAll ? (
						<div className='rp-sheets'>
							<div className='rp-sheet rp-sheet--primary'>
								<div className='rp-sheet-hdr'>
									<span className='rp-sheet-badge'>Sheet 1</span>
									<span className='rp-sheet-name'>Tổng hợp toàn BV</span>
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
										Sheet 2…N
									</span>
									<span className='rp-sheet-name'>Từng khoa riêng</span>
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
					) : (
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
