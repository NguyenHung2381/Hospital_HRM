import type { GroupBy, DayRange, WeekRange, MonthRange, YearRange } from './reportRangeUtils';
import { fmt, isoWeek } from './reportRangeUtils';

export const GROUP_TABS: {
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

export const MONTHS = [
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

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;
const TODAY = new Date();
const THIS_WEEK = isoWeek(TODAY);

export const YEAR_OPTS = Array.from({ length: 10 }, (_, i) => THIS_YEAR - 5 + i);

export const DEFAULT_DAY: DayRange = (() => {
	const f = new Date(TODAY);
	f.setDate(TODAY.getDate() - 29);
	return { from: fmt(f), to: fmt(TODAY) };
})();
export const DEFAULT_WEEK: WeekRange = {
	fromWeek: 1,
	fromYear: THIS_YEAR,
	toWeek: THIS_WEEK,
	toYear: THIS_YEAR,
};
export const DEFAULT_MONTH: MonthRange = {
	fromMonth: 1,
	fromYear: THIS_YEAR,
	toMonth: THIS_MONTH,
	toYear: THIS_YEAR,
};
export const DEFAULT_YEAR: YearRange = { fromYear: THIS_YEAR - 1, toYear: THIS_YEAR };
