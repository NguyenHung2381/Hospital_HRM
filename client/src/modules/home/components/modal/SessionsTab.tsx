import { useCallback, useEffect, useState } from 'react';

interface SessionItem {
	id: string;
	ip_address: string | null;
	user_agent: string | null;
	created_at: string;
	last_seen_at: string | null;
	expires_at: string;
	current: boolean;
}

// Rút gọn user-agent thành "Trình duyệt · Hệ điều hành" dễ đọc
function describeDevice(ua: string | null): string {
	if (!ua) return 'Thiết bị không xác định';
	const browser =
		/Edg\//.test(ua) ? 'Edge'
		: /OPR\/|Opera/.test(ua) ? 'Opera'
		: /Chrome\//.test(ua) ? 'Chrome'
		: /Firefox\//.test(ua) ? 'Firefox'
		: /Safari\//.test(ua) ? 'Safari'
		: 'Trình duyệt khác';
	const os =
		/Windows/.test(ua) ? 'Windows'
		: /Android/.test(ua) ? 'Android'
		: /iPhone|iPad|iOS/.test(ua) ? 'iOS'
		: /Mac OS X/.test(ua) ? 'macOS'
		: /Linux/.test(ua) ? 'Linux'
		: 'HĐH khác';
	return `${browser} · ${os}`;
}

function fmt(iso: string | null): string {
	return iso ? new Date(iso).toLocaleString('vi-VN') : '—';
}

/** Danh sách thiết bị đang đăng nhập + đăng xuất từ xa. */
export default function SessionsTab() {
	const [sessions, setSessions] = useState<SessionItem[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	const load = useCallback(async () => {
		try {
			const res = await fetch('/api/auth/sessions');
			const d = (await res.json()) as { success: boolean; data?: SessionItem[]; message?: string };
			if (d.success) setSessions(d.data ?? []);
			else setError(d.message ?? 'Không tải được danh sách phiên');
		} catch {
			setError('Lỗi kết nối server.');
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const act = async (url: string, method: 'POST' | 'DELETE') => {
		setBusy(true);
		setError('');
		setSuccess('');
		try {
			const res = await fetch(url, { method });
			const d = (await res.json()) as { success: boolean; message?: string };
			if (d.success) setSuccess(d.message ?? 'Đã thực hiện');
			else setError(d.message ?? 'Thao tác thất bại');
			await load();
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setBusy(false);
		}
	};

	const others = sessions?.filter((s) => !s.current) ?? [];

	return (
		<div className='mform'>
			<p className='sec-muted'>
				Các thiết bị đang đăng nhập tài khoản của bạn. Nếu thấy thiết bị lạ,
				hãy đăng xuất thiết bị đó và đổi mật khẩu ngay.
			</p>

			{error && <p className='login-error'>⚠️ {error}</p>}
			{success && <p className='pwd-success'>{success}</p>}

			{sessions === null && !error && <p className='sec-muted'>Đang tải...</p>}

			<ul className='sec-sessions'>
				{sessions?.map((s) => (
					<li
						key={s.id}
						className='sec-session'
					>
						<div>
							<p className='sec-session-dev'>
								{describeDevice(s.user_agent)}
								{s.current && <span className='sec-badge'>Thiết bị này</span>}
							</p>
							<p className='sec-muted'>
								IP {s.ip_address ?? '—'} · Đăng nhập {fmt(s.created_at)} · Hoạt động{' '}
								{fmt(s.last_seen_at)}
							</p>
						</div>
						{!s.current && (
							<button
								className='btn-ghost'
								disabled={busy}
								onClick={() => act(`/api/auth/sessions/${s.id}`, 'DELETE')}
							>
								Đăng xuất
							</button>
						)}
					</li>
				))}
			</ul>

			<div className='mfooter'>
				<button
					className='btn-danger'
					disabled={busy || others.length === 0}
					onClick={() => act('/api/auth/logout-all', 'POST')}
				>
					{busy ? '⏳ Đang xử lý...' : `Đăng xuất tất cả thiết bị khác (${others.length})`}
				</button>
			</div>
		</div>
	);
}
