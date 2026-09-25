import SessionTable from '@/components/common/SessionTable';
import type { AuthSession } from '@/types/logType';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Mọi phiên đăng nhập đang hoạt động trên toàn hệ thống — admin thu hồi từng
// phiên hoặc buộc 1 tài khoản đăng xuất khỏi mọi thiết bị.
export default function LogsSessionsTab() {
	const [sessions, setSessions] = useState<AuthSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [keyword, setKeyword] = useState('');
	const [message, setMessage] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/admin/sessions');
			const data = await res.json();
			if (data.success) setSessions(data.data);
		} catch {
			setMessage('Không tải được danh sách phiên');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const filtered = useMemo(() => {
		const k = keyword.trim().toLowerCase();
		if (!k) return sessions;
		return sessions.filter((s) =>
			[s.username, s.full_name, s.ip_address, s.name_role].some((v) => (v ?? '').toLowerCase().includes(k)),
		);
	}, [sessions, keyword]);

	const userCount = new Set(sessions.map((s) => s.id_user)).size;

	const revoke = async (s: AuthSession) => {
		if (s.current) {
			alert('Đây là phiên bạn đang dùng — hãy dùng nút Đăng xuất.');
			return;
		}
		if (!confirm(`Thu hồi phiên của ${s.username}? Thiết bị đó sẽ bị đăng xuất.`)) return;
		setBusyId(s.id);
		try {
			const res = await fetch(`/api/admin/sessions/${s.id}`, { method: 'DELETE' });
			const data = await res.json();
			setMessage(data.message ?? '');
			await load();
		} finally {
			setBusyId(null);
		}
	};

	const revokeUser = async (s: AuthSession) => {
		if (!confirm(`Đăng xuất tài khoản ${s.username} khỏi mọi thiết bị?`)) return;
		setBusyId(`u${s.id_user}`);
		try {
			const res = await fetch(`/api/admin/users/${s.id_user}/revoke-sessions`, { method: 'POST' });
			const data = await res.json();
			setMessage(data.message ?? '');
			await load();
		} finally {
			setBusyId(null);
		}
	};

	return (
		<>
			<div className='lg-filters'>
				<label className='lg-field lg-field-grow'>
					<span>Tìm phiên</span>
					<input
						type='search'
						placeholder='Tài khoản, họ tên, IP, vai trò...'
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
					/>
				</label>
				<span className='lg-note'>
					{sessions.length} phiên · {userCount} tài khoản
					{message ? ` — ${message}` : ''}
				</span>
				<button
					className='btn-outline lg-export'
					onClick={load}
					disabled={loading}
				>
					Tải lại
				</button>
			</div>
			<SessionTable
				sessions={filtered}
				loading={loading}
				showUser
				busyId={busyId}
				onRevoke={revoke}
				onRevokeUser={revokeUser}
			/>
		</>
	);
}
