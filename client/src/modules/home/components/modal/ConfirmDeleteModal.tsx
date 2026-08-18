import ModalForm from '@/components/common/ModalForm';

export interface ConfirmDeleteModalProps {
	date: string;
	fmtDisplay: (ds: string) => string;
	saving: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

export default function ConfirmDeleteModal({
	date,
	fmtDisplay,
	saving,
	onClose,
	onConfirm,
}: ConfirmDeleteModalProps) {
	return (
		<ModalForm
			title='⚠️ Xác nhận xoá'
			onClose={onClose}
		>
			<p className='confirm-txt'>
				Xoá dữ liệu ngày <strong>{fmtDisplay(date)}</strong>?<br />
				<span style={{ fontSize: '.8rem', color: '#64748b' }}>
					Toàn bộ dữ liệu báo cáo ngày này sẽ bị xoá vĩnh viễn.
				</span>
			</p>
			<div className='mfooter'>
				<button
					className='btn-ghost'
					onClick={onClose}
					disabled={saving}
				>
					Huỷ
				</button>
				<button
					className='btn-danger'
					onClick={onConfirm}
					disabled={saving}
				>
					{saving ? '⏳ Đang xoá...' : '🗑 Xoá'}
				</button>
			</div>
		</ModalForm>
	);
}
