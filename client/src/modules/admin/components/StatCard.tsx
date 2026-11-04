import type { ReactNode } from 'react';

const SEMANTIC_TONES = new Set([
	'var(--color-error)',
	'var(--color-error-dark)',
	'var(--color-warning)',
	'var(--red)',
]);

interface StatCardProps {
	label: string;
	value: string | number;
	icon?: ReactNode;
	subText?: string;
	textColor: string; // VD: 'var(--pd)'
	bgColor?: string; // VD: 'var(--color-primary-pale)'
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
	// Chỉ giữ màu khi mang ý nghĩa cảnh báo (đỏ / vàng); còn lại dùng màu chữ
	// trung tính để các ô số liệu không bị "loè loẹt".
	const tone = SEMANTIC_TONES.has(textColor) ? textColor : 'var(--txt)';
	const style = {
		'--dc': tone,
		'--db': bgColor,
		'--kc': tone, // Dành cho AdminHomePage (.ov-kpi)
		'--kb': bgColor,
		'--sc': tone, // Dành cho AdminDataPage (.dv-strip-card)
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
