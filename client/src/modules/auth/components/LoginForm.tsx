import EyeIcon from '@/assets/svg/EyeClosedIcon';
import EyeClosedIcon from '@/assets/svg/EyeIcon';
import GuardIcon from '@/assets/svg/GuardIcon';
import InfoIcon from '@/assets/svg/InfoIcon';
import LockIcon from '@/assets/svg/LockIcon';
import UserIcon from '@/assets/svg/UserIcon';
import { DASHBOARD_ROLES } from '@/context/AuthRoles';
import type { LoginResult } from '@/context/AuthContext';
import { useAuth } from '@/context/useAuth';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginForm() {
	const { login, verify2FA } = useAuth();
	const navigate = useNavigate();

	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [remember, setRemember] = useState(false);
	const [showPass, setShowPass] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	// Bước 2 (chỉ khi tài khoản đã bật xác thực 2 lớp): nhập mã 6 số từ app
	const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
	const [otpCode, setOtpCode] = useState('');

	const backToPasswordStep = () => {
		setPreAuthToken(null);
		setOtpCode('');
		setPassword('');
	};

	const handleResult = (result: LoginResult) => {
		switch (result.status) {
			case 'ok':
				navigate(
					DASHBOARD_ROLES.includes(result.user.vaiTro) ? '/dashboard' : '/home',
					{ replace: true },
				);
				return;
			case 'requires_2fa':
				setPreAuthToken(result.preAuthToken);
				setOtpCode('');
				return;
			case 'not_found':
				setError('Tài khoản không tồn tại hoặc đã bị khoá.');
				return;
			case 'wrong_pass':
				setError('Tên đăng nhập hoặc mật khẩu không đúng.');
				return;
			case 'wrong_code':
				setError(result.message);
				setOtpCode('');
				return;
			case 'pre_auth_expired':
				backToPasswordStep();
				setError('Phiên xác thực đã hết hạn, vui lòng đăng nhập lại.');
				return;
			case 'locked':
				backToPasswordStep();
				setError(result.message);
				return;
			case 'rate_limited':
				setError(
					result.message ??
						'Bạn đã nhập sai quá nhiều lần, vui lòng thử lại sau ít phút.',
				);
				return;
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		handleResult(await login(username.trim(), password, remember));
		setLoading(false);
	};

	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!preAuthToken || otpCode.length !== 6) return;
		setError('');
		setLoading(true);
		handleResult(await verify2FA(preAuthToken, otpCode));
		setLoading(false);
	};

	const alert = error && (
		<div
			className='auth-alert'
			role='alert'
		>
			<InfoIcon size={16} />
			<span>{error}</span>
		</div>
	);

	if (preAuthToken) {
		return (
			<>
				<div className='login-header'>
					<div className='login-tag'>
						<GuardIcon size={14} />
						Xác thực 2 lớp
					</div>
					<h2 className='login-title'>
						Nhập mã <span>xác thực</span>
					</h2>
					<p className='login-desc'>
						Nhập mã 6 số trong ứng dụng xác thực (Google Authenticator,
						Microsoft Authenticator...) của tài khoản <b>{username.trim()}</b>
					</p>
				</div>

				<div className='login-card'>
					{alert}

					<form
						onSubmit={handleVerifyOtp}
						className='login-form'
						noValidate
					>
						<div className='field-group'>
							<label
								className='field-label'
								htmlFor='otp'
							>
								Mã xác thực <span className='field-required'>*</span>
							</label>
							<div className='field-input-wrap'>
								<span className='field-icon'>
									<LockIcon size={18} />
								</span>
								<input
									id='otp'
									type='text'
									inputMode='numeric'
									autoComplete='one-time-code'
									maxLength={6}
									className='field-input'
									placeholder='000000'
									value={otpCode}
									onChange={(e) => {
										setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
										setError('');
									}}
									autoFocus
									disabled={loading}
								/>
							</div>
						</div>

						<button
							type='submit'
							className='submit-btn'
							disabled={loading || otpCode.length !== 6}
						>
							{loading ? (
								<>
									<span className='btn-spinner' />
									Đang xác thực...
								</>
							) : (
								'Xác nhận'
							)}
						</button>

						<button
							type='button'
							className='back-link'
							onClick={() => {
								backToPasswordStep();
								setError('');
							}}
							disabled={loading}
						>
							← Quay lại đăng nhập
						</button>
					</form>
				</div>
			</>
		);
	}

	return (
		<>
			<div className='login-header'>
				<h2 className='login-title'>
					Đăng nhập <span>nhân sự</span>
				</h2>
			</div>

			<div className='login-card'>
				{alert}

				<form
					onSubmit={handleSubmit}
					className='login-form'
					noValidate
				>
					{/* Username */}
					<div className='field-group'>
						<label
							className='field-label'
							htmlFor='username'
						>
							Tên đăng nhập <span className='field-required'>*</span>
						</label>
						<div className='field-input-wrap'>
							<span className='field-icon'>
								<UserIcon size={18} />
							</span>
							<input
								id='username'
								type='text'
								className='field-input'
								placeholder='Nhập tên đăng nhập...'
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								autoComplete='username'
								autoFocus
								disabled={loading}
							/>
						</div>
					</div>

					{/* Password */}
					<div className='field-group'>
						<label
							className='field-label'
							htmlFor='password'
						>
							Mật khẩu <span className='field-required'>*</span>
						</label>
						<div className='field-input-wrap'>
							<span className='field-icon'>
								<LockIcon size={18} />
							</span>
							<input
								id='password'
								type={showPass ? 'text' : 'password'}
								className='field-input'
								placeholder='Nhập mật khẩu...'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete='current-password'
								disabled={loading}
							/>
							<button
								type='button'
								className='toggle-pass'
								onClick={() => setShowPass(!showPass)}
								aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
								tabIndex={-1}
							>
								{showPass ? <EyeClosedIcon size={18} /> : <EyeIcon size={18} />}
							</button>
						</div>
					</div>

					{/* Options */}
					<div className='form-options'>
						<label className='remember-label'>
							<input
								type='checkbox'
								className='remember-check'
								checked={remember}
								onChange={(e) => setRemember(e.target.checked)}
								disabled={loading}
							/>
							<span className='remember-text'>Ghi nhớ đăng nhập</span>
						</label>
						<a
							href='#'
							className='forgot-link'
						>
							Quên mật khẩu?
						</a>
					</div>

					{/* Submit */}
					<button
						type='submit'
						className='submit-btn'
						disabled={loading || !username.trim()}
					>
						{loading ? (
							<>
								<span className='btn-spinner' />
								Đang xác thực...
							</>
						) : (
							'Đăng nhập hệ thống'
						)}
					</button>
				</form>
			</div>

			{/* Hỗ trợ */}
			<div className='support-box'>
				<div className='support-icon'>
					<InfoIcon size={18} />
				</div>
				<div>
					<div className='support-title'>Cần hỗ trợ?</div>
					<p className='support-text'>
						Liên hệ Phòng CNTT: <a href='tel:02383123456'>0238.312.3456</a> hoặc{' '}
						<a href='mailto:cntt@bvhndk.vn'>cntt@bvhndk.vn</a>
					</p>
				</div>
			</div>
		</>
	);
}
