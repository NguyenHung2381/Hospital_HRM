import ErrorIllustration, { type ErrorVariant } from './ErrorIllustration';

interface ErrorAction {
	label: string;
	onClick: () => void;
}

interface ErrorPageProps {
	variant: ErrorVariant;
	code: string;
	title: string;
	message: string;
	primaryAction?: ErrorAction;
	secondaryAction?: ErrorAction;
}

export default function ErrorPage({ variant, code, title, message, primaryAction, secondaryAction }: ErrorPageProps) {
	return (
		<div className='error-page'>
			<div className='error-card'>
				<ErrorIllustration variant={variant} />
				<p className='error-code'>{code}</p>
				<h1 className='error-title'>{title}</h1>
				<p className='error-message'>{message}</p>
				{(primaryAction || secondaryAction) && (
					<div className='error-actions'>
						{primaryAction && (
							<button
								className='btn-primary'
								onClick={primaryAction.onClick}
							>
								{primaryAction.label}
							</button>
						)}
						{secondaryAction && (
							<button
								className='btn-outline'
								onClick={secondaryAction.onClick}
							>
								{secondaryAction.label}
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
