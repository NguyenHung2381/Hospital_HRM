export default function ResetIcon({ size = 15, color = 'currentColor' }) {
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
			<g
				fill='none'
				fillRule='evenodd'
				stroke='#000000'
				strokeLinecap='round'
				strokeLinejoin='round'
				transform='translate(2 2)'
			>
				<path d='m12.5 1.5c2.4138473 1.37729434 4 4.02194088 4 7 0 4.418278-3.581722 8-8 8s-8-3.581722-8-8 3.581722-8 8-8'></path>

				<path d='m12.5 5.5v-4h4'></path>
			</g>
		</svg>
	);
}
