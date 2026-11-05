export default function FormErrorBanner({ error }: { error: string }) {
	if (!error) return null;
	return (
		<p
			style={{
				color: 'var(--color-error)',
				fontSize: 'var(--fs-sm)',
				marginBottom: 8,
				background: 'var(--color-error-bg)',
				borderRadius: 6,
				padding: '6px 10px',
			}}
		>
			{error}
		</p>
	);
}
