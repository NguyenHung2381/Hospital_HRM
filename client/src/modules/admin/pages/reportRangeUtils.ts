// ── Kiểu kỳ báo cáo + tiện ích ngày dùng cho admin ReportPage ─────────────
export type GroupBy = 'day' | 'week' | 'month' | 'year';

export interface DayRange {
	from: string;
	to: string;
}
export interface WeekRange {
	fromWeek: number;
	fromYear: number;
	toWeek: number;
	toYear: number;
}
export interface MonthRange {
	fromMonth: number;
	fromYear: number;
	toMonth: number;
	toYear: number;
}
export interface YearRange {
	fromYear: number;
	toYear: number;
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const fmt = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isoWeek(d: Date): number {
	const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const day = tmp.getUTCDay() || 7;
	tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
	return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
export function isoWeeksInYear(year: number): number {
	return isoWeek(new Date(year, 11, 28));
}
export function mondayOfIsoWeek(week: number, year: number): Date {
	const jan4 = new Date(year, 0, 4);
	const jan4Day = jan4.getDay() || 7;
	const monday = new Date(jan4);
	monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
	return monday;
}
export function lastDayOfMonth(year: number, month: number): string {
	return fmt(new Date(year, month, 0));
}

export function rangeToApiDates(
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
