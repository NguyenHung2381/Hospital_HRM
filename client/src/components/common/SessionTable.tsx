import type { AuthSession } from '@/types/logType';
import { describeUserAgent, formatDateTime, timeAgo } from '@/utils/logUtils';

interface SessionTableProps {
	sessions: AuthSession[];
	loading: boolean;
	/** Hiện cột tài khoản (trang quản trị xem phiên của mọi người) */
	showUser?: boolean;
	busyId?: string | null;
	onRevoke: (s: AuthSession) => void;
	onRevokeUser?: (s: AuthSession) => void;
}

// Bảng phiên đăng nhập — dùng chung cho modal "Phiên đăng nhập" của người
// dùng và tab "Phiên đăng nhập" trên trang Nhật ký hệ thống (admin).
export default function SessionTable({
	sessions,
	loading,
	showUser = false,
	busyId = null,
	onRevoke,
	onRevokeUser,
}: SessionTableProps) {
	return (
		<div className='lg-wrap'>
			<table className='lg-tbl'>
				<thead>
					<tr>
						{showUser && <th>Tài khoản</th>}
						<th>Thiết bị</th>
						<th>IP</th>
						<th>Đăng nhập lúc</th>
						<th>Hoạt động gần nhất</th>
						<th>Hết hạn</th>
						<th style={{ textAlign: 'right' }}>Thao tác</th>
					</tr>
				</thead>
				<tbody>
					{loading ? (
						<tr>
							<td
								colSpan={showUser ? 7 : 6}
								className='lg-empty'
							>
								Đang tải...
							</td>
						</tr>
					) : sessions.length === 0 ? (
						<tr>
							<td
								colSpan={showUser ? 7 : 6}
								className='lg-empty'
							>
								Không có phiên đăng nhập nào đang hoạt động
							</td>
						</tr>
					) : (
						sessions.map((s) => (
							<tr key={s.id}>
								{showUser && (
									<td>
										<div className='lg-actor'>
											<span className='lg-actor-name'>{s.full_name ?? s.username}</span>
											<span className='lg-actor-sub'>
												@{s.username}
												{s.name_role ? ` · ${s.name_role}` : ''}
											</span>
										</div>
									</td>
								)}
								<td>
									<div className='lg-actor'>
										<span className='lg-actor-name'>
											{describeUserAgent(s.user_agent)}
											{s.current && <span className='lg-chip lg-chip-ok'>Thiết bị này</span>}
										</span>
										<span className='lg-actor-sub'>
											{s.client_type === 'api' ? 'Client API (Bearer token)' : 'Trình duyệt web'}
											{s.remember && s.client_type === 'web' ? ' · Ghi nhớ đăng nhập' : ''}
										</span>
									</div>
								</td>
								<td className='lg-mono'>{s.ip_address ?? '—'}</td>
								<td>{formatDateTime(s.created_at)}</td>
								<td title={formatDateTime(s.last_used_at)}>{timeAgo(s.last_used_at)}</td>
								<td>{formatDateTime(s.expires_at)}</td>
								<td>
									<div className='lg-actions'>
										{onRevokeUser && (
											<button
												className='lg-btn-sm'
												disabled={busyId === `u${s.id_user}`}
												onClick={() => onRevokeUser(s)}
												title='Đăng xuất tài khoản này khỏi mọi thiết bị'
											>
												Mọi thiết bị
											</button>
										)}
										<button
											className='lg-btn-sm lg-btn-danger'
											disabled={busyId === s.id}
											onClick={() => onRevoke(s)}
										>
											{s.current ? 'Đăng xuất' : 'Thu hồi'}
										</button>
									</div>
								</td>
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
