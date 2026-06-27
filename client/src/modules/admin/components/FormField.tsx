import type { ReactNode } from 'react';

interface FormFieldProps {
	label: ReactNode;
	hint?: ReactNode; // Dùng cho đoạn text nhỏ, in nghiêng
	children: ReactNode; // Input, Select, Textarea
	className?: string;
}

export default function FormField({
	label,
	hint,
	children,
	className = '',
}: FormFieldProps) {
	return (
		<label className={`fi ${className}`}>
			<span className='fi-label'>
				{label}
				{hint && <span className='dept-hs-hint'> {hint}</span>}
			</span>
			{children}
		</label>
	);
}
