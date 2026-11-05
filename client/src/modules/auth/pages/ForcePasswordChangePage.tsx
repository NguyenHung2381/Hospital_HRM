import { LogOut } from 'lucide-react';
import EyeIcon from '@/assets/svg/EyeClosedIcon';
import EyeClosedIcon from '@/assets/svg/EyeIcon';
import GuardIcon from '@/assets/svg/GuardIcon';
import InfoIcon from '@/assets/svg/InfoIcon';
import LockIcon from '@/assets/svg/LockIcon';
import { useAuth } from '@/context/useAuth';
import { usePasswordChange } from '@/hooks/usePasswordChange';
import AuthLayout from '@/layouts/AuthLayout';
import { useState } from 'react';

// Tài khoản đang dùng mật khẩu do quản trị cấp (mới tạo / vừa đặt lại) phải
// đặt mật khẩu mới trước khi vào hệ thống. Server cũng chặn mọi API khác cho
// tới khi đổi xong (403 PASSWORD_CHANGE_REQUIRED), nên đây không chỉ là giao diện.
export default function ForcePasswordChangePage() {
	const { logout, markPasswordChanged } = useAuth();
	const pwd = usePasswordChange(markPasswordChanged);
	const [showPass, setShowPass] = useState(false);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		void pwd.submit();
	};

	const fields = [
		{
			id: 'old-password',
			label: 'Mật khẩu hiện tại (mật khẩu tạm)',
			value: pwd.oldPassword,
			onChange: pwd.onOldChange,
			autoComplete: 'current-password',
			placeholder: 'Mật khẩu quản trị đã cấp cho bạn',
		},
		{
			id: 'new-password',
			label: 'Mật khẩu mới',
			value: pwd.newPassword,
			onChange: pwd.onNewChange,
			autoComplete: 'new-password',
			placeholder: 'Ít nhất 8 ký tự, gồm chữ và số',
		},
		{
			id: 'confirm-password',
			label: 'Nhập lại mật khẩu mới',
			value: pwd.confirmPassword,
			onChange: pwd.onConfirmChange,
			autoComplete: 'new-password',
			placeholder: 'Nhập lại đúng mật khẩu mới',
		},
	];

	return (
		<AuthLayout>
			<div className='login-header'>
				<div className='login-tag'>
					<GuardIcon size={14} />
					Bảo mật tài khoản
				</div>
				<h2 className='login-title'>
					Đặt <span>mật khẩu mới</span>
				</h2>
				<p className='login-desc'>
					Tài khoản <b>{pwd.user?.taiKhoan}</b> đang dùng mật khẩu do quản trị cấp.
					Vui lòng đặt mật khẩu của riêng bạn trước khi tiếp tục.
				</p>
			</div>

			<div className='login-card'>
				{pwd.error && (
					<div
						className='auth-alert'
						role='alert'
					>
						<InfoIcon size={16} />
						<span>{pwd.error}</span>
					</div>
				)}

				<form
					onSubmit={handleSubmit}
					className='login-form'
					noValidate
				>
					{/* Giúp trình quản lý mật khẩu lưu đúng tài khoản */}
					<input
						type='text'
						name='username'
						autoComplete='username'
						value={pwd.user?.taiKhoan ?? ''}
						readOnly
						hidden
					/>
					{fields.map((f, i) => (
						<div
							className='field-group'
							key={f.id}
						>
							<label
								className='field-label'
								htmlFor={f.id}
							>
								{f.label} <span className='field-required'>*</span>
							</label>
							<div className='field-input-wrap'>
								<span className='field-icon'>
									<LockIcon size={18} />
								</span>
								<input
									id={f.id}
									type={showPass ? 'text' : 'password'}
									className='field-input'
									placeholder={f.placeholder}
									value={f.value}
									onChange={f.onChange}
									autoComplete={f.autoComplete}
									autoFocus={i === 0}
									disabled={pwd.saving}
								/>
								{i === 0 && (
									<button
										type='button'
										className='toggle-pass'
										onClick={() => setShowPass(!showPass)}
										aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
										tabIndex={-1}
									>
										{showPass ? <EyeClosedIcon size={18} /> : <EyeIcon size={18} />}
									</button>
								)}
							</div>
						</div>
					))}

					<p className='login-desc'>
						Không dùng mật khẩu phổ biến (vd <i>password123</i>), không chứa tên
						đăng nhập. Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.
					</p>

					<button
						type='submit'
						className='submit-btn'
						disabled={pwd.saving}
					>
						{pwd.saving ? (
							<>
								<span className='btn-spinner' />
								Đang lưu...
							</>
						) : (
							'Đổi mật khẩu và tiếp tục'
						)}
					</button>

					<button
						type='button'
						className='back-link'
						onClick={logout}
						disabled={pwd.saving}
					>
						<LogOut size={14} /> Đăng xuất
					</button>
				</form>
			</div>
		</AuthLayout>
	);
}
