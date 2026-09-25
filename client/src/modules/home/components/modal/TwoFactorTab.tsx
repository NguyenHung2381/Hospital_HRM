import { useEffect, useState } from 'react';

interface TwoFaSetup {
	secret: string;
	otpauth_uri: string;
	qr_data_url: string;
}

interface ApiResult<T = unknown> {
	success: boolean;
	message?: string;
	data?: T;
}

async function postJson<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	return (await res.json()) as ApiResult<T>;
}

/** Bật / tắt xác thực 2 lớp (TOTP) cho tài khoản đang đăng nhập. */
export default function TwoFactorTab() {
	const [enabled, setEnabled] = useState<boolean | null>(null);
	const [setup, setSetup] = useState<TwoFaSetup | null>(null);
	const [code, setCode] = useState('');
	const [showDisable, setShowDisable] = useState(false);
	const [password, setPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	useEffect(() => {
		fetch('/api/auth/2fa/status')
			.then((r) => r.json() as Promise<ApiResult<{ enabled: boolean }>>)
			.then((d) => setEnabled(!!d.data?.enabled))
			.catch(() => setError('Lỗi kết nối server.'));
	}, []);

	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		setError('');
		setSuccess('');
		try {
			await fn();
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setBusy(false);
		}
	};

	const startSetup = () =>
		run(async () => {
			const d = await postJson<TwoFaSetup>('/api/auth/2fa/setup');
			if (!d.success || !d.data) return setError(d.message ?? 'Không khởi tạo được 2FA');
			setSetup(d.data);
			setCode('');
		});

	const confirmSetup = () =>
		run(async () => {
			const d = await postJson('/api/auth/2fa/verify-setup', { code });
			if (!d.success) return setError(d.message ?? 'Mã xác thực không đúng');
			setSetup(null);
			setCode('');
			setEnabled(true);
			setSuccess('✅ Đã bật xác thực 2 lớp. Lần đăng nhập sau sẽ cần mã từ ứng dụng.');
		});

	const disable = () =>
		run(async () => {
			const d = await postJson('/api/auth/2fa/disable', { password });
			if (!d.success) return setError(d.message ?? 'Không tắt được 2FA');
			setShowDisable(false);
			setPassword('');
			setEnabled(false);
			setSuccess('Đã tắt xác thực 2 lớp.');
		});

	if (enabled === null && !error) return <p className='sec-muted'>Đang tải...</p>;

	return (
		<div className='mform'>
			<p className='sec-muted'>
				Khi bật, ngoài mật khẩu bạn cần nhập mã 6 số từ ứng dụng xác thực trên
				điện thoại (Google Authenticator, Microsoft Authenticator, Authy...) mỗi
				lần đăng nhập. Mất điện thoại → liên hệ quản trị để tắt 2FA.
			</p>

			{error && <p className='login-error'>⚠️ {error}</p>}
			{success && <p className='pwd-success'>{success}</p>}

			<div className='sec-status'>
				Trạng thái:{' '}
				<b className={enabled ? 'sec-on' : 'sec-off'}>{enabled ? 'Đang bật' : 'Đang tắt'}</b>
			</div>

			{!enabled && !setup && (
				<div className='mfooter'>
					<button
						className='btn-primary'
						onClick={startSetup}
						disabled={busy}
					>
						{busy ? '⏳ Đang xử lý...' : '🛡️ Bật xác thực 2 lớp'}
					</button>
				</div>
			)}

			{!enabled && setup && (
				<>
					<div className='sec-qr'>
						<img
							src={setup.qr_data_url}
							alt='Mã QR thiết lập xác thực 2 lớp'
							width={180}
							height={180}
						/>
						<div className='sec-steps'>
							<p>1. Quét mã QR bằng ứng dụng xác thực.</p>
							<p>
								Không quét được? Nhập khoá thủ công:
								<code className='sec-secret'>{setup.secret}</code>
							</p>
							<p>2. Nhập mã 6 số ứng dụng hiển thị để xác nhận.</p>
						</div>
					</div>
					<label className='fi'>
						<span className='fi-label'>Mã xác thực</span>
						<input
							className='fi-input'
							inputMode='numeric'
							autoComplete='one-time-code'
							maxLength={6}
							placeholder='000000'
							value={code}
							onChange={(e) => {
								setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
								setError('');
							}}
						/>
					</label>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => {
								setSetup(null);
								setCode('');
							}}
							disabled={busy}
						>
							Huỷ
						</button>
						<button
							className='btn-primary'
							onClick={confirmSetup}
							disabled={busy || code.length !== 6}
						>
							{busy ? '⏳ Đang xác nhận...' : 'Xác nhận & bật'}
						</button>
					</div>
				</>
			)}

			{enabled && !showDisable && (
				<div className='mfooter'>
					<button
						className='btn-danger'
						onClick={() => setShowDisable(true)}
					>
						Tắt xác thực 2 lớp
					</button>
				</div>
			)}

			{enabled && showDisable && (
				<>
					<label className='fi'>
						<span className='fi-label'>Nhập mật khẩu để xác nhận tắt 2FA</span>
						<input
							type='password'
							className='fi-input'
							autoComplete='current-password'
							value={password}
							onChange={(e) => {
								setPassword(e.target.value);
								setError('');
							}}
						/>
					</label>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => {
								setShowDisable(false);
								setPassword('');
							}}
							disabled={busy}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={disable}
							disabled={busy || !password}
						>
							{busy ? '⏳ Đang xử lý...' : 'Xác nhận tắt 2FA'}
						</button>
					</div>
				</>
			)}
		</div>
	);
}
