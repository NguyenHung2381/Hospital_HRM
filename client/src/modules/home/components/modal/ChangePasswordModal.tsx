import { UserRound } from 'lucide-react';
import ModalForm from '@/components/common/ModalForm';
import { usePasswordChange } from '@/hooks/usePasswordChange';
import '@/styles/accountSecurity.css';
import { useEffect, useState } from 'react';
import SessionsTab from './SessionsTab';
import TwoFactorTab from './TwoFactorTab';

type SecurityTab = 'password' | '2fa' | 'sessions';

export interface ChangePasswordModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function ChangePasswordModal({
	isOpen,
	onClose,
}: ChangePasswordModalProps) {
	const pwd = usePasswordChange();
	const [tab, setTab] = useState<SecurityTab>('password');

	const handleClose = () => {
		setTab('password');
		pwd.reset();
		onClose();
	};

	// Đổi thành công → hiện thông báo 1,5 giây rồi đóng
	const { success } = pwd;
	useEffect(() => {
		if (!success) return;
		const t = setTimeout(handleClose, 1500);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [success]);

	if (!isOpen) return null;

	return (
		<ModalForm
			title='Bảo mật tài khoản'
			onClose={handleClose}
		>
			<div className='sec-tabs'>
				{(
					[
						['password', 'Đổi mật khẩu'],
						['2fa', 'Xác thực 2 lớp'],
						['sessions', 'Thiết bị đăng nhập'],
					] as const
				).map(([key, label]) => (
					<button
						key={key}
						type='button'
						className={`sec-tab${tab === key ? ' sec-tab--active' : ''}`}
						onClick={() => setTab(key)}
					>
						{label}
					</button>
				))}
			</div>

			{tab === '2fa' && <TwoFactorTab />}
			{tab === 'sessions' && <SessionsTab />}

			{tab === 'password' && (
			<div className='mform'>
				<div className='pwd-user-info'>
					<UserRound className='pwd-user-icon' size={20} />
					<div>
						<p className='pwd-user-name'>{pwd.user?.hoTen}</p>
						<p className='pwd-user-account'>{pwd.user?.taiKhoan}</p>
					</div>
				</div>

				{pwd.error && <p className='login-error'>{pwd.error}</p>}
				{pwd.success && <p className='pwd-success'>{pwd.success}</p>}

				<label className='fi'>
					<span className='fi-label'>Mật khẩu hiện tại</span>
					<input
						type='password'
						className='fi-input'
						value={pwd.oldPassword}
						autoComplete='current-password'
						onChange={pwd.onOldChange}
					/>
				</label>

				<label className='fi'>
					<span className='fi-label'>Mật khẩu mới</span>
					<input
						type='password'
						className='fi-input'
						value={pwd.newPassword}
						autoComplete='new-password'
						placeholder='Ít nhất 8 ký tự, gồm chữ và số'
						onChange={pwd.onNewChange}
					/>
				</label>

				<label className='fi'>
					<span className='fi-label'>Xác nhận mật khẩu mới</span>
					<input
						type='password'
						className='fi-input'
						value={pwd.confirmPassword}
						autoComplete='new-password'
						placeholder='Nhập lại mật khẩu mới'
						onChange={pwd.onConfirmChange}
					/>
				</label>

				<div className='mfooter'>
					<button
						className='btn-ghost'
						onClick={handleClose}
						disabled={pwd.saving}
					>
						Huỷ
					</button>
					<button
						className='btn-primary'
						onClick={() => void pwd.submit()}
						disabled={pwd.saving}
					>
						{pwd.saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
					</button>
				</div>
			</div>
			)}
		</ModalForm>
	);
}
