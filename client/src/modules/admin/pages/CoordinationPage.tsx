import { useAuth } from '@/context/useAuth';
import { useAppSSE } from '@/hooks/useAppSSE';
import { useReportData } from '@/hooks/useReportData';
import type { ApiCoordination } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';
import { fmtUpdatedAt, formatDateToVN, getTodayDateString } from '@/utils/dateUtils';
import { toKhoaRecord } from '@/utils/staffingCalc';
import { useCallback, useEffect, useState } from 'react';
import CreateCoordinationModal from '../components/modal/CreateCoordinationModal';
import PageHeader from '../components/PageHeader';

type SortField = 'ten' | 'nlTong' | 'diLam' | 'khuyenCao' | 'dieuPhoi';

/**
 * Trang điều phối nhân lực giữa các khoa.
 * Chỉ là lớp ghi nhận/theo dõi độc lập — KHÔNG đụng vào staff_working
 * hay bất kỳ số liệu báo cáo TT03 gốc nào (xem staffingCalc.ts).
 * Ai cũng xem được (cùng quyền dashboard), nhưng chỉ Admin mới được
 * tạo/xoá điều phối.
 */
export default function CoordinationPage() {
	const { user } = useAuth();
	const isAdmin = user?.vaiTro === 'admin';

	const [selDate, setSelDate] = useState(getTodayDateString());
	const { report, loadingReport } = useReportData(selDate);

	const [history, setHistory] = useState<ApiCoordination[]>([]);
	const [loadingHistory, setLoadingHistory] = useState(true);
	// null = đóng modal; { fromId, toId } = mở modal (toId/fromId có thể null
	// nếu mở bằng nút "+ Tạo điều phối" hoặc chưa xác định vai trò khoa,
	// hoặc điền sẵn nếu bấm nút trên bảng / kéo-thả)
	const [modalPrefill, setModalPrefill] = useState<{
		fromId: number | null;
		toId: number | null;
	} | null>(null);
	// Khoa "thiếu" đang được kéo-thả rê qua, dùng để highlight
	const [dragOverId, setDragOverId] = useState<number | null>(null);

	const [sortField, setSortField] = useState<SortField>('dieuPhoi');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

	const toggleSort = (field: SortField) => {
		if (field === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setSortField(field);
			setSortDir('asc');
		}
	};

	const fetchHistory = useCallback(async () => {
		setLoadingHistory(true);
		try {
			const res = await fetch(`/api/coordination?date=${selDate}`);
			const data = (await res.json()) as {
				success: boolean;
				data: ApiCoordination[];
			};
			if (data.success) setHistory(data.data);
		} catch {
			/* bỏ qua */
		} finally {
			setLoadingHistory(false);
		}
	}, [selDate]);

	useEffect(() => {
		fetchHistory();
	}, [fetchHistory]);

	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'coordination') fetchHistory();
			},
			[fetchHistory],
		),
	);

	const handleDelete = async (id: number) => {
		if (!confirm('Xoá bản ghi điều phối này?')) return;
		try {
			const res = await fetch(`/api/coordination/${id}`, { method: 'DELETE' });
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				alert(data.message ?? 'Lỗi khi xoá');
				return;
			}
			fetchHistory();
		} catch {
			alert('Lỗi kết nối server.');
		}
	};

	const openCoordinate = (r: KhoaRecord) => {
		const dp = r.dieuPhoi ?? 0;
		if (dp > 0) setModalPrefill({ fromId: r.id_department, toId: null });
		else if (dp < 0) setModalPrefill({ fromId: null, toId: r.id_department });
		else setModalPrefill({ fromId: null, toId: null });
	};

	const rawRows = report?.records.map((r, i) => toKhoaRecord(r, i + 1)) ?? [];

	// dieuPhoi tính từ báo cáo gốc KHÔNG tự trừ/cộng theo điều phối đã ghi
	// nhận (đúng như đã chốt — không đụng số liệu báo cáo). Nhưng để trang
	// này phản ánh đúng thực tế "còn dư/còn thiếu bao nhiêu", cộng bù thêm
	// phần đã điều chuyển trong ngày (chỉ tính toán hiển thị phía client,
	// không ghi lại vào report).
	const netAdjust = new Map<number, number>();
	for (const h of history) {
		netAdjust.set(
			h.id_department_from,
			(netAdjust.get(h.id_department_from) ?? 0) - h.staff_count,
		);
		netAdjust.set(
			h.id_department_to,
			(netAdjust.get(h.id_department_to) ?? 0) + h.staff_count,
		);
	}
	const rows = rawRows.map((r) => {
		const adjust = netAdjust.get(r.id_department) ?? 0;
		return adjust === 0 ? r : { ...r, dieuPhoi: (r.dieuPhoi ?? 0) + adjust };
	});

	const sortedRows = [...rows].sort((a, b) => {
		let cmp: number;
		if (sortField === 'ten') cmp = a.ten.localeCompare(b.ten);
		else cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0);
		return sortDir === 'asc' ? cmp : -cmp;
	});

	const sortArrow = (field: SortField) =>
		field === sortField ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

	return (
		<div className='pg'>
			<PageHeader
				title='Điều phối nhân lực'
				subtitle='Ghi nhận điều chuyển nhân lực từ khoa dư sang khoa thiếu — không ảnh hưởng số liệu báo cáo TT03 gốc'
			>
				<div className='ov-date-select-wrap'>
					<label
						className='ov-date-select-lbl'
						htmlFor='coord-date-sel'
					>
						📅 Ngày
					</label>
					<input
						id='coord-date-sel'
						type='date'
						className='ov-date-select'
						value={selDate}
						onChange={(e) => setSelDate(e.target.value)}
					/>
				</div>
				{isAdmin && (
					<button
						className='btn-primary'
						onClick={() => setModalPrefill({ fromId: null, toId: null })}
						disabled={!report}
					>
						＋ Tạo điều phối
					</button>
				)}
			</PageHeader>

			{loadingReport ? (
				<div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
					Đang tải dữ liệu...
				</div>
			) : !report ? (
				<div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
					Chưa có báo cáo ngày {formatDateToVN(selDate)}. Vui lòng nhập số liệu
					ngày này trước khi điều phối.
				</div>
			) : (
				<>
					<section className='hcard'>
						<h3 className='hcard-title'>📊 Tình trạng nhân lực theo khoa</h3>
						{isAdmin && (
							<p
								style={{
									fontSize: '.68rem',
									color: '#94a3b8',
									margin: '-4px 0 8px',
								}}
							>
								💡 Bấm cột tiêu đề để sắp xếp · Kéo 1 dòng đang dư rồi thả vào
								dòng đang thiếu để điều phối nhanh
							</p>
						)}
						<div style={{ overflowX: 'auto' }}>
							<table className='tbl'>
								<thead>
									<tr>
										<th
											className='td-center'
											style={{ width: 36 }}
										>
											#
										</th>
										<th
											onClick={() => toggleSort('ten')}
											style={{ cursor: 'pointer' }}
										>
											Khoa{sortArrow('ten')}
										</th>
										<th
											className='td-center'
											onClick={() => toggleSort('nlTong')}
											style={{ cursor: 'pointer' }}
										>
											Tổng NL{sortArrow('nlTong')}
										</th>
										<th
											className='td-center'
											onClick={() => toggleSort('diLam')}
											style={{ cursor: 'pointer' }}
										>
											Đi làm{sortArrow('diLam')}
										</th>
										<th
											className='td-center'
											onClick={() => toggleSort('khuyenCao')}
											style={{ cursor: 'pointer' }}
										>
											Khuyến nghị{sortArrow('khuyenCao')}
										</th>
										<th
											className='td-center'
											onClick={() => toggleSort('dieuPhoi')}
											style={{ cursor: 'pointer' }}
										>
											Chênh lệch{sortArrow('dieuPhoi')}
										</th>
										<th className='td-center'>Trạng thái</th>
										{isAdmin && <th className='td-center'>Thao tác</th>}
									</tr>
								</thead>
								<tbody>
									{sortedRows.length === 0 ? (
										<tr>
											<td
												colSpan={isAdmin ? 8 : 7}
												className='tbl-empty'
											>
												Chưa có dữ liệu khoa nào trong báo cáo ngày này
											</td>
										</tr>
									) : (
										sortedRows.map((r) => {
											const dp = r.dieuPhoi ?? 0;
											const adjusted = netAdjust.get(r.id_department);
											const rawDp =
												rawRows.find((x) => x.id_department === r.id_department)
													?.dieuPhoi ?? 0;
											return (
												<tr
													key={r.id_department}
													draggable={isAdmin && dp > 0}
													onDragStart={
														isAdmin && dp > 0
															? (e) => {
																	e.dataTransfer.setData(
																		'text/plain',
																		String(r.id_department),
																	);
																	e.dataTransfer.effectAllowed = 'move';
																}
															: undefined
													}
													onDragOver={
														isAdmin && dp < 0
															? (e) => {
																	e.preventDefault();
																	e.dataTransfer.dropEffect = 'move';
																	if (dragOverId !== r.id_department)
																		setDragOverId(r.id_department);
																}
															: undefined
													}
													onDragLeave={
														isAdmin && dp < 0
															? () => setDragOverId(null)
															: undefined
													}
													onDrop={
														isAdmin && dp < 0
															? (e) => {
																	e.preventDefault();
																	setDragOverId(null);
																	const fromId = Number(
																		e.dataTransfer.getData('text/plain'),
																	);
																	if (fromId && fromId !== r.id_department)
																		setModalPrefill({
																			fromId,
																			toId: r.id_department,
																		});
																}
															: undefined
													}
													style={{
														cursor: isAdmin && dp > 0 ? 'grab' : undefined,
														background:
															dragOverId === r.id_department
																? '#fef2f2'
																: undefined,
														outline:
															dragOverId === r.id_department
																? '2px dashed #dc2626'
																: undefined,
														outlineOffset:
															dragOverId === r.id_department ? -2 : undefined,
													}}
												>
													<td className='td-num td-center'>{r.tt}</td>
													<td>{r.ten}</td>
													<td className='td-center'>{r.nlTong ?? '—'}</td>
													<td className='td-center'>{r.diLam ?? '—'}</td>
													<td className='td-center'>
														{r.khuyenCao !== null
															? r.khuyenCao.toFixed(1)
															: '—'}
													</td>
													<td
														className='td-center'
														style={{
															fontWeight: 800,
															color:
																dp > 0
																	? '#079341'
																	: dp < 0
																		? '#dc2626'
																		: '#94a3b8',
														}}
													>
														{dp > 0 ? `+${dp}` : dp}
														{adjusted ? (
															<div
																style={{
																	fontSize: '.6rem',
																	fontWeight: 500,
																	color: '#94a3b8',
																}}
															>
																gốc {rawDp > 0 ? `+${rawDp}` : rawDp}
															</div>
														) : null}
													</td>
													<td className='td-center'>
														{dp > 0 ? (
															<span className='badge badge-green'>Dư</span>
														) : dp < 0 ? (
															<span
																className='badge'
																style={{ background: '#fee2e2', color: '#dc2626' }}
															>
																Thiếu
															</span>
														) : (
															<span className='badge badge-gray'>Đủ</span>
														)}
													</td>
													{isAdmin && (
														<td className='td-center'>
															<button
																className='btn-ghost'
																style={{
																	fontSize: '.72rem',
																	padding: '4px 10px',
																}}
																onClick={() => openCoordinate(r)}
															>
																⇄ Điều phối
															</button>
														</td>
													)}
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</section>

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
															onClick={() => handleDelete(h.id)}
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
				</>
			)}

			{modalPrefill && report && (
				<CreateCoordinationModal
					reportDate={selDate}
					rows={rows}
					userId={user?.id}
					initialFromId={modalPrefill.fromId}
					initialToId={modalPrefill.toId}
					onCreated={() => fetchHistory()}
					onClose={() => setModalPrefill(null)}
				/>
			)}
		</div>
	);
}
