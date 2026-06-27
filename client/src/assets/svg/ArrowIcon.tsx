export default function ArrowIcon({ size = 15, color = 'currentColor' }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke={color}
			strokeWidth='2.5'
			strokeLinecap='round'
			strokeLinejoin='round'
		>
			<line
				x1='5'
				y1='12'
				x2='19'
				y2='12'
			/>
			<polyline points='12 5 19 12 12 19' />
		</svg>
	);
}
