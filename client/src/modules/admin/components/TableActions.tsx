import EditIcon from '@/assets/svg/EditIcon';
import ResetIcon from '@/assets/svg/ResetIcon';
import TrashIcon from '@/assets/svg/TrashIcon';

interface TableActionsProps {
	onEdit?: () => void;
	onDelete?: () => void;
	onReset?: () => void; // Thêm hành động reset
	editTitle?: string;
	delTitle?: string;
	resetTitle?: string;
}

export default function TableActions({
	onEdit,
	onDelete,
	onReset,
	editTitle = 'Sửa',
	delTitle = 'Xoá',
	resetTitle = 'Cấp lại mật khẩu',
}: TableActionsProps) {
	return (
		<div className='td-actions'>
			{/* Nút Reset Mật Khẩu */}
			{onReset && (
				<button
					className='tbl-btn tbl-btn-edit'
					style={{ color: '#d97706', background: '#fef3c7' }}
					onClick={onReset}
					title={resetTitle}
				>
					<ResetIcon size={14} />
				</button>
			)}

			{onEdit && (
				<button
					className='tbl-btn tbl-btn-edit'
					onClick={onEdit}
					title={editTitle}
				>
					<EditIcon size={14} />
				</button>
			)}
			{onDelete && (
				<button
					className='tbl-btn tbl-btn-del'
					onClick={onDelete}
					title={delTitle}
				>
					<TrashIcon size={14} />
				</button>
			)}
		</div>
	);
}
