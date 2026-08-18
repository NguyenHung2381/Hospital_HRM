import StatCard from '../components/StatCard';

export interface KpiCardData {
	icon: string;
	val: number;
	lbl: string;
	sub: string;
	col: string;
	bg: string;
}

/** Hàng thẻ KPI dùng chung cho khối nội trú và khối CLS trong DashboardPage. */
export default function DashboardKpiRow({ cards }: { cards: KpiCardData[] }) {
	return (
		<div className='ov-kpi-grid'>
			{cards.map((c) => (
				<StatCard
					key={c.lbl}
					className='ov-kpi'
					label={c.lbl}
					value={c.val}
					icon={c.icon}
					subText={c.sub}
					textColor={c.col}
					bgColor={c.bg}
				/>
			))}
		</div>
	);
}
