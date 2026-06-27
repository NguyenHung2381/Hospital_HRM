import ArrowIcon from '@/assets/svg/ArrowIcon';
import EyeIcon from '@/assets/svg/EyeClosedIcon';
import EyeClosedIcon from '@/assets/svg/EyeIcon';
import LockIcon from '@/assets/svg/LockIcon';
import UserIcon from '@/assets/svg/UserIcon';
import { DASHBOARD_ROLES } from '@/context/AuthRoles';
import { useAuth } from '@/context/useAuth';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginForm() {
	const { login } = useAuth();
	const navigate = useNavigate();

	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [remember, setRemember] = useState(false);
	const [showPass, setShowPass] = useState(false);
	const [loading, setLoading] = useState(false);
	const [focused, setFocused] = useState<string | null>(null);
	const [error, setError] = useState('');

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setLoading(true);

		const result = await login(username.trim(), password, remember);

		if (result.status === 'not_found') {
			setError('Tài khoản không tồn tại hoặc đã bị khoá.');
			setLoading(false);
			return;
		}

		if (result.status === 'wrong_pass') {
			setError('Mật khẩu không đúng.');
			setLoading(false);
			return;
		}

		if (DASHBOARD_ROLES.includes(result.user.vaiTro)) {
			navigate('/dashboard', { replace: true });
		} else {
			navigate('/home', { replace: true });
		}

		setLoading(false);
	};

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
