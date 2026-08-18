import type { KhoaRecord } from '@/types/reportType';

export type SortField = 'ten' | 'nlTong' | 'diLam' | 'khuyenCao' | 'dieuPhoi';

export interface ShortageBoardProps {
	sortedRows: KhoaRecord[];
	rawRows: KhoaRecord[];
	netAdjust: Map<number, number>;
	isAdmin: boolean;
	sortField: SortField;
	sortDir: 'asc' | 'desc';
	toggleSort: (field: SortField) => void;
	dragOverId: number | null;
	setDragOverId: (id: number | null) => void;
	onCoordinate: (r: KhoaRecord) => void;
	onDrop: (fromId: number, toId: number) => void;
}

/** Bảng tình trạng nhân lực theo khoa — sắp xếp + kéo-thả để điều phối. */
export default function ShortageBoard({
	sortedRows,
	rawRows,
	netAdjust,
	isAdmin,
	sortField,
	sortDir,
	toggleSort,
	dragOverId,
	setDragOverId,
	onCoordinate,
	onDrop,
}: ShortageBoardProps) {
	const sortArrow = (field: SortField) =>
		field === sortField ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

	return (
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
											isAdmin && dp < 0 ? () => setDragOverId(null) : undefined
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
															onDrop(fromId, r.id_department);
													}
												: undefined
										}
										style={{
											cursor: isAdmin && dp > 0 ? 'grab' : undefined,
											background:
												dragOverId === r.id_department ? '#fef2f2' : undefined,
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
											{r.khuyenCao !== null ? r.khuyenCao.toFixed(1) : '—'}
										</td>
										<td
											className='td-center'
											style={{
												fontWeight: 800,
												color:
													dp > 0 ? '#079341' : dp < 0 ? '#dc2626' : '#94a3b8',
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
													onClick={() => onCoordinate(r)}
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
	);
}
