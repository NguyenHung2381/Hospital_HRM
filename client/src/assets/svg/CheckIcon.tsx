export default function CheckIcon({ size = 15, color = 'currentColor' }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke={color}
			strokeWidth='3.5'
			strokeLinecap='round'
			strokeLinejoin='round'
		>
			<polyline points='20 6 9 17 4 12' />
		</svg>
	);
}
