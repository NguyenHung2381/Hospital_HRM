import { ClipboardList, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
	/** Tiêu đề chính, ví dụ "Chưa có báo cáo cho ngày …" */
	title: ReactNode;
	/** Dòng phụ giải thích / gợi ý bước tiếp theo */
	sub?: ReactNode;
	/** Nút hành động (thường là .btn-primary) */
	action?: ReactNode;
	icon?: LucideIcon;
	/** Hiện vòng xoay thay cho icon — dùng cho trạng thái đang tải */
	loading?: boolean;
	/** Bọc trong khung trắng viền mảnh khi đứng riêng trên nền trang */
	card?: boolean;
}

/**
 * Trạng thái trống / đang tải dùng chung cho các trang quản trị và trang khoa
 * (style .empty* trong main.css), thay cho các khối chữ xám viết inline.
 */
export default function EmptyState({
	title,
	sub,
	action,
	icon: Icon = ClipboardList,
	loading = false,
	card = false,
}: EmptyStateProps) {
	return (
		<div
			className={`empty${card ? ' empty--card' : ''}`}
			role={loading ? 'status' : undefined}
			aria-live={loading ? 'polite' : undefined}
		>
			{loading ? (
				<LoaderCircle
					className='empty-icon spin'
					size={32}
					strokeWidth={1.5}
				/>
			) : (
				<Icon
					className='empty-icon'
					size={36}
					strokeWidth={1.5}
				/>
			)}
			<p className='empty-title'>{title}</p>
			{sub && <p className='empty-sub'>{sub}</p>}
			{action && <div className='empty-action'>{action}</div>}
		</div>
	);
}
