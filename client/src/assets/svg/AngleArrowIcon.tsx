export default function AngleArrowIcon({
	size = 15,
	color = 'currentColor',
	className = '',
}) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke={color}
			strokeWidth='2.5'
			strokeLinecap='round'
			strokeLinejoin='round'
		>
			<polyline points='6 9 12 15 18 9' />
		</svg>
	);
}
