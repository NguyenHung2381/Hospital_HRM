import type React from 'react';

// ── Props ──────────────────────────────────────────────────
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalFormProps {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
	/** sm=360 | md=480(default) | lg=640 | xl=820 | full=92vw */
	size?: ModalSize;
	/** @deprecated dùng size="lg" thay thế */
	wide?: boolean;
	/** Dùng cho các notice/alert không có header chuẩn (vd: dev notice) */
	bare?: boolean;
}

// ── ModalForm ──────────────────────────────────────────────
export default function ModalForm({
	title,
	onClose,
	children,
	size,
	wide = false,
	bare = false,
}: ModalFormProps) {
	// Backwards-compat: wide → lg
	const resolvedSize: ModalSize = size ?? (wide ? 'lg' : 'md');

	if (bare) {
		return (
			<div
				className='overlay'
				onClick={onClose}
			>
				<div
					className='dev-notice'
					onClick={(e) => e.stopPropagation()}
				>
					{children}
				</div>
			</div>
		);
	}

	return (
		<div
			className='overlay'
			onClick={onClose}
		>
			<div
				className={`modal modal--${resolvedSize}`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className='modal-hdr'>
					<span className='modal-title'>{title}</span>
					<button
						className='modal-x'
						onClick={onClose}
						aria-label='Đóng'
					>
						✕
					</button>
				</div>
				<div className='modal-body'>{children}</div>
			</div>
		</div>
	);
}
