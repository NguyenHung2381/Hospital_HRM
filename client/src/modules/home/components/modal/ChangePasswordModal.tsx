import ModalForm from '@/components/common/ModalForm';
import { useAuth } from '@/context/useAuth';
import { useState } from 'react';

export interface ChangePasswordModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function ChangePasswordModal({
	isOpen,
	onClose,
}: ChangePasswordModalProps) {
	const { user } = useAuth();
	const [pwdOld, setPwdOld] = useState('');
	const [pwdNew, setPwdNew] = useState('');
	const [pwdConfirm, setPwdConfirm] = useState('');
	const [pwdError, setPwdError] = useState('');
	const [pwdSuccess, setPwdSuccess] = useState('');
	const [savingPwd, setSavingPwd] = useState(false);

	if (!isOpen) return null;

	const handleClose = () => {
		setPwdOld('');
		setPwdNew('');
		setPwdConfirm('');
		setPwdError('');
		setPwdSuccess('');
		onClose();
	};

	const handleChangePassword = async () => {
		if (!pwdOld.trim()) {
			setPwdError('Vui lòng nhập mật khẩu hiện tại');
			return;
		}
		if (!pwdNew.trim() || pwdNew.length < 6) {
			setPwdError('Mật khẩu mới phải có ít nhất 6 ký tự');
			return;
		}
		if (pwdNew !== pwdConfirm) {
			setPwdError('Mật khẩu xác nhận không khớp');
			return;
		}
		if (!user?.id) {
			setPwdError('Không xác định được tài khoản');
			return;
		}

		setSavingPwd(true);
		setPwdError('');
		setPwdSuccess('');

		try {
			const res = await fetch(`/api/users/${user.id}/change-password`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ old_password: pwdOld, new_password: pwdNew }),
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setPwdError(data.message ?? 'Đổi mật khẩu thất bại');
			} else {
				setPwdSuccess('✅ Đổi mật khẩu thành công!');
				setPwdOld('');
				setPwdNew('');
				setPwdConfirm('');
				setTimeout(() => {
					handleClose();
				}, 1500);
			}
		} catch {
			setPwdError('Lỗi kết nối server.');
		} finally {
			setSavingPwd(false);
		}
	};

	return (
		<ModalForm
			title='🔑 Đổi mật khẩu'
			onClose={handleClose}
		>
			<div className='mform'>
				<div className='pwd-user-info'>
					<span className='pwd-user-icon'>👤</span>
					<div>
						<p className='pwd-user-name'>{user?.hoTen}</p>
						<p className='pwd-user-account'>{user?.taiKhoan}</p>
					</div>
				</div>

				{pwdError && <p className='login-error'>⚠️ {pwdError}</p>}
				{pwdSuccess && <p className='pwd-success'>{pwdSuccess}</p>}

				<label className='fi'>
					<span className='fi-label'>Mật khẩu hiện tại</span>
					<input
						type='password'
						className='fi-input'
						value={pwdOld}
						autoComplete='current-password'
						onChange={(e) => {
							setPwdOld(e.target.value);
							setPwdError('');
						}}
					/>
				</label>

				<label className='fi'>
					<span className='fi-label'>Mật khẩu mới</span>
					<input
						type='password'
						className='fi-input'
						value={pwdNew}
						autoComplete='new-password'
						placeholder='Ít nhất 6 ký tự'
						onChange={(e) => {
							setPwdNew(e.target.value);
							setPwdError('');
						}}
					/>
				</label>

				<label className='fi'>
					<span className='fi-label'>Xác nhận mật khẩu mới</span>
					<input
						type='password'
						className='fi-input'
						value={pwdConfirm}
						autoComplete='new-password'
						placeholder='Nhập lại mật khẩu mới'
						onChange={(e) => {
							setPwdConfirm(e.target.value);
							setPwdError('');
						}}
					/>
				</label>

				<div className='mfooter'>
					<button
						className='btn-ghost'
						onClick={handleClose}
						disabled={savingPwd}
					>
						Huỷ
					</button>
					<button
						className='btn-primary'
						onClick={handleChangePassword}
						disabled={savingPwd}
					>
						{savingPwd ? '⏳ Đang lưu...' : '🔑 Đổi mật khẩu'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
