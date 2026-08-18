import type { ApiCoordination } from '@/types/apiType';
import { fmtUpdatedAt, formatDateToVN } from '@/utils/dateUtils';

export interface CoordinationHistoryTableProps {
	selDate: string;
	history: ApiCoordination[];
	loadingHistory: boolean;
	isAdmin: boolean;
	onDelete: (id: number) => void;
}

/** Bảng lịch sử điều phối nhân lực trong ngày. */
export default function CoordinationHistoryTable({
	selDate,
	history,
	loadingHistory,
	isAdmin,
	onDelete,
}: CoordinationHistoryTableProps) {
	return (
		<section className='hcard'>
			<h3 className='hcard-title'>
				📋 Lịch sử điều phối ngày {formatDateToVN(selDate)}
			</h3>
			<div style={{ overflowX: 'auto' }}>
				<table className='tbl'>
					<thead>
						<tr>
							<th>Khoa gửi</th>
							<th>Khoa nhận</th>
							<th className='td-center'>Số người</th>
							<th>Ghi chú</th>
							<th>Người tạo</th>
							<th>Thời gian</th>
							{isAdmin && <th className='td-center'>Thao tác</th>}
						</tr>
					</thead>
					<tbody>
						{loadingHistory ? (
							<tr>
								<td
									colSpan={isAdmin ? 7 : 6}
									className='tbl-empty'
								>
									Đang tải...
								</td>
							</tr>
						) : history.length === 0 ? (
							<tr>
								<td
									colSpan={isAdmin ? 7 : 6}
									className='tbl-empty'
								>
									Chưa có điều phối nào trong ngày này
								</td>
							</tr>
						) : (
							history.map((h) => (
								<tr key={h.id}>
									<td>{h.from_department_name}</td>
									<td>{h.to_department_name}</td>
									<td
										className='td-center'
										style={{ fontWeight: 800, color: '#2563eb' }}
									>
										{h.staff_count}
									</td>
									<td>{h.note ?? '—'}</td>
									<td>{h.created_by_name ?? 'N/A'}</td>
									<td className='td-mono'>{fmtUpdatedAt(h.created_at)}</td>
									{isAdmin && (
										<td className='td-center'>
											<button
												className='tbl-btn tbl-btn-del'
												title='Xoá bản ghi điều phối'
												onClick={() => onDelete(h.id)}
											>
												🗑
											</button>
										</td>
									)}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}
