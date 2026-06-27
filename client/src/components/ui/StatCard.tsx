export default function StatCard({
	label,
	value,
	accent,
	icon,
}: {
	label: string;
	value: string;
	accent: string;
	icon: string;
}) {
	return (
		<div className={`stat a-${accent}`}>
			<span className='stat-icon'>{icon}</span>
			<span className='stat-val'>{value}</span>
			<span className='stat-lbl'>{label}</span>
		</div>
	);
}
