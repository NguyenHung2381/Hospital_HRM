export default function FormErrorBanner({ error }: { error: string }) {
	if (!error) return null;
	return (
		<p
			style={{
				color: '#dc2626',
				fontSize: '.82rem',
				marginBottom: 8,
				background: '#fef2f2',
				borderRadius: 6,
				padding: '6px 10px',
			}}
		>
			⚠️ {error}
		</p>
	);
}
