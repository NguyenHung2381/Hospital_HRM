import { getTodayDateString } from '@/utils/dateUtils';
import { useMemo, useState } from 'react';

const DAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS_VI = [
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

export default function Calendar({
	records,
	activeDate,
	onSelect,
	onAdd,
}: {
	records: { date: string }[];
	activeDate: string;
	onSelect: (d: string) => void;
	onAdd: (d: string) => void;
}) {
	const today = getTodayDateString();
	const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
	const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

	const recordSet = useMemo(
		() => new Set(records.map((r) => r.date)),
		[records],
	);

	const firstDay = new Date(viewYear, viewMonth, 1).getDay();
	const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
	const cells: (number | null)[] = [
		...Array(firstDay).fill(null),
		...Array.from({ length: daysInMonth }, (_, i) => i + 1),
	];
	while (cells.length % 7 !== 0) cells.push(null);

	const mkDate = (d: number) => {
		const mm = String(viewMonth + 1).padStart(2, '0');
		const dd = String(d).padStart(2, '0');
		return `${viewYear}-${mm}-${dd}`;
	};

	const prev = () => {
		if (viewMonth === 0) {
			setViewYear((y) => y - 1);
			setViewMonth(11);
		} else setViewMonth((m) => m - 1);
	};
	const next = () => {
		if (viewMonth === 11) {
			setViewYear((y) => y + 1);
			setViewMonth(0);
		} else setViewMonth((m) => m + 1);
	};

	return (
		<div className='cal'>
			<div className='cal-nav'>
				<button
					className='cal-nav-btn'
					onClick={prev}
				>
					‹
				</button>
				<span className='cal-month-label'>
					{MONTHS_VI[viewMonth]} {viewYear}
				</span>
				<button
					className='cal-nav-btn'
					onClick={next}
				>
					›
				</button>
			</div>
			<div className='cal-grid'>
				{DAYS_VI.map((d) => (
					<div
						key={d}
						className='cal-dow'
					>
						{d}
					</div>
				))}
				{cells.map((day, idx) => {
					if (!day)
						return (
							<div
								key={idx}
								className='cal-cell cal-empty'
							/>
						);
					const ds = mkDate(day);
					const hasRecord = recordSet.has(ds);
					const isActive = ds === activeDate;
					const isToday = ds === today;
					return (
						<div
							key={idx}
							className={`cal-cell${isActive ? ' cal-active' : ''}${isToday ? ' cal-today' : ''}`}
							onClick={() => (hasRecord ? onSelect(ds) : onAdd(ds))}
							title={hasRecord ? 'Xem dữ liệu' : 'Thêm dữ liệu cho ngày này'}
						>
							<span className='cal-day-num'>{day}</span>
							{hasRecord && <span className='cal-dot' />}
						</div>
					);
				})}
			</div>
		</div>
	);
}
