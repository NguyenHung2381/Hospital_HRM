import type { ApiRecord, ApiReport } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';
import { fmtUpdatedAt } from '@/utils/dateUtils';
import { formatNumber } from '@/utils/formatUtils';
import type { aggregateDashboardStats } from '@/utils/staffingCalc';

export interface DeptPerm {
	can_edit: boolean;
	can_delete: boolean;
	can_export: boolean;
}

export interface WardTableProps {
	filtered: KhoaRecord[];
	pageRows: KhoaRecord[];
	report: ApiReport;
	stats: ReturnType<typeof aggregateDashboardStats>;
	getPermForDept: (id_department: number) => DeptPerm | undefined;
	onEdit: (rec: ApiRecord) => void;
	onDelete: (target: { id: number; name: string }) => void;
}

const n = formatNumber;

/** Bảng dữ liệu khối nội trú (ward) — DataPage. */
export default function WardTable({
	filtered,
	pageRows,
	report,
	stats,
	getPermForDept,
	onEdit,
	onDelete,
}: WardTableProps) {
	return (
		<table className='tbl dv-tbl'>
			<thead>
				<tr>
					<th
						rowSpan={2}
						className='dv-th dv-th-sticky dv-th-idx'
					>
						#
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-sticky dv-th-name-h'
					>
						Khoa / Trung tâm
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c'
					>
						Giường
						<br />/ máy
					</th>
					<th
						colSpan={4}
						className='dv-th dv-th-grp dv-grp-nb'
					>
						Số người bệnh
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c dv-grp-nb2'
					>
						NB khám/
						<br />
						PT KH
					</th>
					<th
						colSpan={4}
						className='dv-th dv-th-grp dv-grp-nl'
					>
						Nhân lực (ĐD - HS - KTV)
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c dv-grp-kc'
					>
						KC theo
						<br />
						TT 03
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c dv-grp-kc'
					>
						Khuyến
						<br />
						cáo
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c dv-grp-dp'
					>
						Điều
						<br />
						phối
					</th>
					<th
						rowSpan={2}
						className='dv-th'
					>
						Ghi chú
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c dv-th-upd'
					>
						Cập nhật
						<br />
						lúc
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c dv-th-upd'
					>
						Tạo lúc
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c'
					>
						Thao tác
					</th>
				</tr>
				<tr>
					<th className='dv-th dv-th-c dv-sub-nb'>CSC1</th>
					<th className='dv-th dv-th-c dv-sub-nb'>CSC2</th>
					<th className='dv-th dv-th-c dv-sub-nb'>CSC3</th>
					<th className='dv-th dv-th-c dv-sub-nb'>Tổng</th>
					<th className='dv-th dv-th-c dv-sub-nl'>Tổng</th>
					<th className='dv-th dv-th-c dv-sub-nl'>Nghỉ trực</th>
					<th className='dv-th dv-th-c dv-sub-nl'>Nghỉ &gt;2ng</th>
					<th className='dv-th dv-th-c dv-sub-nl'>Đi làm</th>
				</tr>
			</thead>
			<tbody>
				{filtered.length === 0 ? (
					<tr>
						<td
							colSpan={18}
							style={{
								textAlign: 'center',
								padding: '40px',
								color: 'var(--mut)',
								fontSize: '.85rem',
							}}
						>
							Không có khoa nào phù hợp
						</td>
					</tr>
				) : (
					pageRows.map((r, i) => {
						const dp = r.dieuPhoi;
						const apiRec = report.records.find(
							(rec) => rec.id_department === r.id_department,
						);
						const perm = apiRec
							? getPermForDept(apiRec.id_department)
							: undefined;
						const canEdit = perm?.can_edit ?? false;
						const rowClass =
							dp !== null && dp < 0
								? 'dv-tr-deficit'
								: dp !== null && dp > 0
									? 'dv-tr-surplus'
									: i % 2 === 1
										? 'dv-tr-alt'
										: '';
						return (
							<tr
								key={r.tt}
								className={rowClass}
							>
								<td className='dv-td dv-td-sticky dv-td-idx'>{r.tt}</td>
								<td className='dv-td dv-td-sticky dv-td-name'>{r.ten}</td>
								<td className='dv-td dv-td-c'>{n(r.giuong)}</td>
								<td className='dv-td dv-td-c dv-td-nb'>{n(r.csc1)}</td>
								<td className='dv-td dv-td-c dv-td-nb'>{n(r.csc2)}</td>
								<td className='dv-td dv-td-c dv-td-nb'>{n(r.csc3)}</td>
								<td className='dv-td dv-td-c dv-td-nb dv-td-bold'>
									{n(r.tongNB)}
								</td>
								<td className='dv-td dv-td-c'>{n(r.nbKhamPT)}</td>
								<td className='dv-td dv-td-c'>{n(r.nlTong)}</td>
								<td className='dv-td dv-td-c'>{n(r.nghiTruc)}</td>
								<td className='dv-td dv-td-c'>{n(r.nghiTren2)}</td>
								<td className='dv-td dv-td-c dv-td-nl dv-td-bold'>
									{n(r.diLam)}
								</td>
								<td className='dv-td dv-td-c dv-td-kc'>{n(r.tt03, 2)}</td>
								<td className='dv-td dv-td-c dv-td-kc'>
									{r.khuyenNghi != null ? n(r.khuyenNghi, 2) : '—'}
								</td>
								<td className='dv-td dv-td-c'>
									{dp === null ? (
										<span className='dp-pill dp-pill-null'>—</span>
									) : dp > 0 ? (
										<span className='dp-pill dp-pill-surplus'>+{dp}</span>
									) : dp < 0 ? (
										<span className='dp-pill dp-pill-deficit'>{dp}</span>
									) : (
										<span className='dp-pill dp-pill-zero'>0</span>
									)}
								</td>
								<td className='dv-td dv-td-note'>{r.ghiChu ?? ''}</td>
								<td
									className='dv-td dv-td-c dv-td-upd'
									title={apiRec?.updated_at ?? ''}
								>
									{fmtUpdatedAt(apiRec?.updated_at)}
								</td>
								<td
									className='dv-td dv-td-c dv-td-upd'
									title={apiRec?.created_at ?? ''}
								>
									{fmtUpdatedAt(apiRec?.created_at)}
								</td>
								<td className='dv-td dv-td-c'>
									<div
										style={{
											display: 'flex',
											gap: 4,
											justifyContent: 'center',
										}}
									>
										{canEdit && apiRec && (
											<button
												className='tbl-btn tbl-btn-edit'
												title='Sửa dữ liệu khoa này'
												onClick={() => onEdit(apiRec)}
											>
												✏️
											</button>
										)}
										{(perm?.can_delete ?? false) && apiRec && (
											<button
												className='tbl-btn tbl-btn-del'
												title='Xóa bản ghi khoa này'
												onClick={() => onDelete({ id: apiRec.id, name: r.ten })}
											>
												🗑
											</button>
										)}
									</div>
								</td>
							</tr>
						);
					})
				)}
			</tbody>
			<tfoot>
				<tr className='dv-tfoot'>
					<td
						colSpan={2}
						className='dv-tf-label'
					>
						∑ Tổng ({filtered.length} khoa)
					</td>
					<td className='dv-td-c' />
					<td className='dv-td-c'>{stats.totalCSC1}</td>
					<td className='dv-td-c'>{stats.totalCSC2}</td>
					<td className='dv-td-c'>{stats.totalCSC3}</td>
					<td className='dv-td-c dv-td-bold'>{stats.totalNB}</td>
					<td className='dv-td-c'>{stats.totalNBKham}</td>
					<td className='dv-td-c'>{stats.totalNL}</td>
					<td className='dv-td-c'>{stats.totalNghiTruc}</td>
					<td className='dv-td-c'>{stats.totalNghiDai}</td>
					<td className='dv-td-c dv-td-bold dv-td-nl'>{stats.totalDiLam}</td>
					<td className='dv-td-c dv-td-kc'>{stats.totalTT03.toFixed(1)}</td>
					<td className='dv-td-c dv-td-kc'>
						{stats.totalKhuyenNghi > 0 ? stats.totalKhuyenNghi.toFixed(1) : '—'}
					</td>
					<td />
					<td />
					<td />
					<td />
					<td />
				</tr>
			</tfoot>
		</table>
	);
}
