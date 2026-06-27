import type { ReactNode } from 'react';

interface StatCardProps {
	label: string;
	value: string | number;
	icon?: ReactNode;
	subText?: string;
	textColor: string; // VD: '#065f2b'
	bgColor?: string; // VD: '#f0faf4'
	className?: string;
}

export default function StatCard({
	label,
	value,
	icon,
	subText,
	textColor,
	bgColor,
	className = 'dept-stat-card',
}: StatCardProps) {
	// Dùng CSS variables nội bộ để tuỳ biến màu dễ dàng
	const style = {
		'--dc': textColor,
		'--db': bgColor,
		'--kc': textColor, // Dành cho AdminHomePage (.ov-kpi)
		'--kb': bgColor,
		'--sc': textColor, // Dành cho AdminDataPage (.dv-strip-card)
		'--sb': bgColor,
	} as React.CSSProperties;

	const valClass =
		className === 'ov-kpi'
			? 'ov-kpi-val'
			: className === 'dv-strip-card'
				? 'dv-sc-val'
				: 'dept-stat-val';

	const lblClass =
		className === 'ov-kpi'
			? 'ov-kpi-lbl'
			: className === 'dv-strip-card'
				? 'dv-sc-lbl'
				: 'dept-stat-lbl';

	return (
		<div
			className={className}
			style={style}
		>
			{icon && <div className='ov-kpi-icon'>{icon}</div>}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
				<div className={valClass}>{value}</div>
				<div className={lblClass}>{label}</div>
				{subText && <div className='ov-kpi-sub'>{subText}</div>}
			</div>
		</div>
	);
}
