import type { ReactNode } from 'react';

interface PageHeaderProps {
	title: string;
	subtitle?: ReactNode;
	icon?: ReactNode;
	children?: ReactNode;
	className?: string;
}

export default function PageHeader({
	title,
	subtitle,
	icon,
	children,
	className = '',
}: PageHeaderProps) {
	return (
		<div className={`pg-hdr ${className}`}>
			<div className='pg-hdr-main'>
				{icon}
				<div>
					<h2 className='pg-title'>{title}</h2>
					{subtitle && <div className='pg-sub'>{subtitle}</div>}
				</div>
			</div>
			{children && (
				<div className='pg-hdr-actions'>
					{children}
				</div>
			)}
		</div>
	);
}
