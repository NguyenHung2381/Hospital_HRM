import type { ReactNode } from 'react';

interface PageHeaderProps {
	title: string;
	subtitle?: ReactNode;
	children?: ReactNode;
	className?: string;
}

export default function PageHeader({
	title,
	subtitle,
	children,
	className = '',
}: PageHeaderProps) {
	return (
		<div className={`pg-hdr ${className}`}>
			<div>
				<h2 className='pg-title'>{title}</h2>
				{subtitle && <p className='pg-sub'>{subtitle}</p>}
			</div>
			{children && (
				<div className='pg-hdr-actions'>
					{children}
				</div>
			)}
		</div>
	);
}
