import './Loading.css';

interface LoadingProps {
	label?: string;
	fullscreen?: boolean;
}

export default function Loading({ label = 'Đang tải...', fullscreen = true }: LoadingProps) {
	return (
		<div className={fullscreen ? 'loading-screen' : 'loading-inline'}>
			<div
				className='loading-spinner'
				role='status'
				aria-label={label}
			>
				<span className='loading-ring' />
				<span className='loading-ring loading-ring--delay' />
				<span className='loading-dot' />
			</div>
			{label && <p className='loading-label'>{label}</p>}
		</div>
	);
}
