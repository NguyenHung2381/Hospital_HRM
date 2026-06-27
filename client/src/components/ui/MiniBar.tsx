interface MiniBarProps {
	val: number;
	max: number;
	color: string;
}

export default function MiniBar({ val, max, color }: MiniBarProps) {
	const pct = max > 0 ? Math.min(100, (val / max) * 100) : 0;
	return (
		<div
			style={{
				flex: 1,
				background: '#f1f5f9',
				borderRadius: 4,
				height: 6,
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					width: `${pct}%`,
					height: '100%',
					background: color,
					borderRadius: 4,
					transition: 'width .4s',
				}}
			/>
		</div>
	);
}
