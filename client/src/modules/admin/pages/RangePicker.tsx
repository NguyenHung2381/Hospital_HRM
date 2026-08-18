import type {
	DayRange,
	GroupBy,
	MonthRange,
	WeekRange,
	YearRange,
} from './reportRangeUtils';
import { MONTHS, YEAR_OPTS } from './reportPageConstants';

export interface RangePickerProps {
	groupBy: GroupBy;
	dayRange: DayRange;
	setDayRange: React.Dispatch<React.SetStateAction<DayRange>>;
	weekRange: WeekRange;
	setWeekRange: React.Dispatch<React.SetStateAction<WeekRange>>;
	monthRange: MonthRange;
	setMonthRange: React.Dispatch<React.SetStateAction<MonthRange>>;
	yearRange: YearRange;
	setYearRange: React.Dispatch<React.SetStateAction<YearRange>>;
	weeksInFromYear: number;
	weeksInToYear: number;
}

/** Picker động theo kỳ báo cáo (day/week/month/year) — dùng trong admin ReportPage. */
export default function RangePicker({
	groupBy,
	dayRange,
	setDayRange,
	weekRange,
	setWeekRange,
	monthRange,
	setMonthRange,
	yearRange,
	setYearRange,
	weeksInFromYear,
	weeksInToYear,
}: RangePickerProps) {
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
									{Array.from({ length: weeksInFromYear }, (_, i) => i + 1).map(
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
}
