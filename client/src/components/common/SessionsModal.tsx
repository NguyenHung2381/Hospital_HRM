import ModalForm from '@/components/common/ModalForm';
import SessionTable from '@/components/common/SessionTable';
import { useAuth } from '@/context/useAuth';
import type { AuthSession } from '@/types/logType';
import '@/styles/logs.css';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface SessionsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

// Các thiết bị đang đăng nhập bằng tài khoản của chính mình — thu hồi từng
// thiết bị hoặc đăng xuất mọi thiết bị khác (khi nghi bị lộ mật khẩu / quên
// đăng xuất ở máy dùng chung).
export default function SessionsModal({ isOpen, onClose }: SessionsModalProps) {
	const { logout } = useAuth();
	const navigate = useNavigate();
	const [sessions, setSessions] = useState<AuthSession[]>([]);
	const [loading, setLoading] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [message, setMessage] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/auth/sessions');
			const data = await res.json();
			// /api/auth/sessions trả last_seen_at → đổi về dạng dùng chung của SessionTable
			if (data.success)
				setSessions(
					data.data.map((s: AuthSession & { last_seen_at?: string | null }) => ({
						...s,
						last_used_at: s.last_seen_at ?? s.created_at,
					})),
				);
		} catch {
			setMessage('Không tải được danh sách phiên đăng nhập');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			setMessage('');
			load();
		}
	}, [isOpen, load]);

	if (!isOpen) return null;

	const revoke = async (s: AuthSession) => {
		if (s.current) {
			onClose();
			logout();
			navigate('/', { replace: true });
			return;
		}
		setBusyId(s.id);
		try {
			const res = await fetch(`/api/auth/sessions/${s.id}`, { method: 'DELETE' });
			const data = await res.json();
			setMessage(data.message ?? '');
			await load();
		} finally {
			setBusyId(null);
		}
	};

	const revokeOthers = async () => {
		if (!confirm('Đăng xuất tài khoản khỏi mọi thiết bị khác?')) return;
		setBusyId('others');
		try {
			const res = await fetch('/api/auth/logout-all', { method: 'POST' });
			const data = await res.json();
			setMessage(data.message ?? '');
			await load();
		} finally {
			setBusyId(null);
		}
	};

	const others = sessions.filter((s) => !s.current).length;

	return (
		<ModalForm
			title='Phiên đăng nhập'
			onClose={onClose}
			size='full'
		>
			<p className='lg-note'>
				Các thiết bị đang đăng nhập bằng tài khoản của bạn. Thấy thiết bị lạ → thu hồi ngay và đổi mật
				khẩu.
			</p>
			<SessionTable
				sessions={sessions}
				loading={loading}
				busyId={busyId}
				onRevoke={revoke}
			/>
			<div className='lg-modal-foot'>
				<span className='lg-note'>{message}</span>
				<button
					className='btn-danger'
					disabled={others === 0 || busyId === 'others'}
					onClick={revokeOthers}
				>
					Đăng xuất {others > 0 ? `${others} ` : ''}thiết bị khác
				</button>
			</div>
		</ModalForm>
	);
}
