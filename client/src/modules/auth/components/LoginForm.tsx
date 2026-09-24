import ArrowIcon from '@/assets/svg/ArrowIcon';
import EyeIcon from '@/assets/svg/EyeClosedIcon';
import EyeClosedIcon from '@/assets/svg/EyeIcon';
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
	const [focused, setFocused] = useState<string | null>(null);
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

	if (preAuthToken) {
		return (
			<div className='login-form-wrapper'>
				<div className='login-header'>
					<h2 className='login-title'>Xác thực 2 lớp</h2>
					<p className='login-desc'>
						Nhập mã 6 số trong ứng dụng xác thực (Google Authenticator,
						Microsoft Authenticator...) của tài khoản <b>{username.trim()}</b>
					</p>
				</div>

				<form
					onSubmit={handleVerifyOtp}
					className='login-form'
					noValidate
				>
					<div
						className={`field-group ${focused === 'otp' ? 'field-focused' : ''}`}
					>
						<label
							className='field-label'
							htmlFor='otp'
						>
							Mã xác thực
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
								onFocus={() => setFocused('otp')}
								onBlur={() => setFocused(null)}
								autoFocus
							/>
						</div>
					</div>

					{error && (
						<p
							className='login-error'
							role='alert'
						>
							{error}
						</p>
					)}

					<button
						type='submit'
						className={`submit-btn ${loading ? 'loading' : ''}`}
						disabled={loading || otpCode.length !== 6}
					>
						{loading ? (
							<span className='btn-spinner' />
						) : (
							<>
								<span>Xác nhận</span>
								<ArrowIcon />
							</>
						)}
					</button>

					<button
						type='button'
						className='forgot-link'
						style={{ background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'center' }}
						onClick={() => {
							backToPasswordStep();
							setError('');
						}}
						disabled={loading}
					>
						← Quay lại đăng nhập
					</button>
				</form>

				<p className='login-footer'>
					© {new Date().getFullYear()} Bệnh viện Hữu Nghị Đa Khoa Nghệ An
				</p>
			</div>
		);
	}

	return (
		<div className='login-form-wrapper'>
			<div className='login-header'>
				<h2 className='login-title'>Đăng nhập</h2>
				<p className='login-desc'>
					Vui lòng nhập thông tin tài khoản để tiếp tục
				</p>
			</div>

			<form
				onSubmit={handleSubmit}
				className='login-form'
				noValidate
			>
				{/* Username */}
				<div
					className={`field-group ${focused === 'username' ? 'field-focused' : ''}`}
				>
					<label
						className='field-label'
						htmlFor='username'
					>
						Tên đăng nhập
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
							onFocus={() => setFocused('username')}
							onBlur={() => setFocused(null)}
							autoComplete='username'
						/>
					</div>
				</div>

				{/* Password */}
				<div
					className={`field-group ${focused === 'password' ? 'field-focused' : ''}`}
				>
					<label
						className='field-label'
						htmlFor='password'
					>
						Mật khẩu
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
							onFocus={() => setFocused('password')}
							onBlur={() => setFocused(null)}
							autoComplete='current-password'
						/>
						<button
							type='button'
							className='toggle-pass'
							onClick={() => setShowPass(!showPass)}
							tabIndex={-1}
						>
							{showPass ? <EyeClosedIcon size={18} /> : <EyeIcon size={18} />}
						</button>
					</div>
				</div>

				{/* Thông báo lỗi */}
				{error && (
					<p
						className='login-error'
						role='alert'
					>
						{error}
					</p>
				)}

				{/* Options */}
				<div className='form-options'>
					<label className='remember-label'>
						<input
							type='checkbox'
							className='remember-check'
							checked={remember}
							onChange={(e) => setRemember(e.target.checked)}
						/>
						<span className='remember-custom' />
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
					className={`submit-btn ${loading ? 'loading' : ''}`}
					disabled={loading || !username.trim()}
				>
					{loading ? (
						<span className='btn-spinner' />
					) : (
						<>
							<span>Đăng nhập</span>
							<ArrowIcon />
						</>
					)}
				</button>
			</form>

			<p className='login-footer'>
				© {new Date().getFullYear()} Bệnh viện Hữu Nghị Đa Khoa Nghệ An
			</p>
		</div>
	);
}
