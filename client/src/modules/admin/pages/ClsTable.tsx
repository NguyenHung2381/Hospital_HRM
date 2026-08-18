import type { ApiClsRecord, ApiReport } from '@/types/apiType';
import type { KhoaClsRecord } from '@/types/clsType';
import { formatNumber } from '@/utils/formatUtils';
import type { aggregateClsDashboardStats } from '@/utils/clsCalc';
import { getClsFields, type ClsFieldId } from '@/utils/clsFieldConfig';
import type { DeptPerm } from './WardTable';

export interface ClsTableProps {
	clsRows: KhoaClsRecord[];
	report: ApiReport;
	clsStats: ReturnType<typeof aggregateClsDashboardStats>;
	getPermForDept: (id_department: number) => DeptPerm | undefined;
	onEdit: (rec: ApiClsRecord) => void;
	onDelete: (target: { id: number; name: string }) => void;
}

const n = formatNumber;

/** dv-td-na: cột không áp dụng cho khoa này (khác với ô áp dụng nhưng chưa nhập số liệu) */
const cellCls = (applicable: Set<ClsFieldId>, id: ClsFieldId) =>
	applicable.has(id) ? 'dv-td dv-td-c' : 'dv-td dv-td-c dv-td-na';

/** Bảng dữ liệu hệ Cận lâm sàng (CLS) — DataPage. */
export default function ClsTable({
	clsRows,
	report,
	clsStats,
	getPermForDept,
	onEdit,
	onDelete,
}: ClsTableProps) {
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
						colSpan={9}
						className='dv-th dv-th-grp dv-grp-nb'
					>
						Khối lượng công việc đã thực hiện
					</th>
					<th
						colSpan={8}
						className='dv-th dv-th-grp dv-grp-nb2'
					>
						Số lượng tồn / chờ
					</th>
					<th
						colSpan={4}
						className='dv-th dv-th-grp dv-grp-nl'
					>
						Nhân lực
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c dv-grp-kc'
					>
						Tỷ lệ
						<br />
						đi làm/KLCV
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
						Chênh
						<br />
						lệch
					</th>
					<th
						rowSpan={2}
						className='dv-th'
					>
						Ghi chú
					</th>
					<th
						rowSpan={2}
						className='dv-th dv-th-c'
					>
						Thao tác
					</th>
				</tr>
				<tr>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-wide'>
						Mẫu bệnh phẩm / Tiêu bản /<br />Người bệnh khám / Tư vấn
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						X-quang hoặc<br />siêu âm (lượt)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						CT / Nội soi<br />(lượt)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						MRI / Loãng xương<br />(lượt)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-med'>
						Điện tim hoặc<br />can thiệp (lượt)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-med'>
						Đồ vải (Kg) / Truyền thông<br />(số lượng khoa)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						Xử lý dụng cụ<br />sắt (Bộ)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						Xử lý dụng cụ<br />nhựa (Cái)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						Khoa giám sát<br />(số khoa)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-wide'>
						Mẫu bệnh phẩm / Tiêu bản /<br />Người bệnh khám / Tư vấn
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						X-quang hoặc<br />siêu âm (lượt)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						CT / Nội soi<br />(lượt)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						MRI / Loãng xương<br />(lượt)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-med'>
						Điện tim hoặc<br />can thiệp (lượt)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						Đồ vải<br />(Kg)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						Xử lý dụng cụ<br />sắt (Bộ)
					</th>
					<th className='dv-th dv-th-c dv-sub-nb dv-sub-sm'>
						Xử lý dụng cụ<br />nhựa (Cái)
					</th>
					<th className='dv-th dv-th-c dv-sub-nl'>Tổng</th>
					<th className='dv-th dv-th-c dv-sub-nl'>Nghỉ trực</th>
					<th className='dv-th dv-th-c dv-sub-nl'>Nghỉ &gt;2 ngày</th>
					<th className='dv-th dv-th-c dv-sub-nl'>Đi làm</th>
				</tr>
			</thead>
			<tbody>
				{clsRows.length === 0 ? (
					<tr>
						<td
							colSpan={28}
							style={{
								textAlign: 'center',
								padding: '40px',
								color: 'var(--mut)',
								fontSize: '.85rem',
							}}
						>
							Chưa có khoa CLS nào nhập dữ liệu ngày này
						</td>
					</tr>
				) : (
					clsRows.map((r, i) => {
						const apiRec = report.cls_records.find(
							(rec) => rec.id_department === r.id_department,
						);
						const perm = apiRec
							? getPermForDept(apiRec.id_department)
							: undefined;
						const canEdit = perm?.can_edit ?? false;
						const dp = r.chenhLech;
						const rowClass =
							dp !== null && dp < 0
								? 'dv-tr-deficit'
								: dp !== null && dp > 0
									? 'dv-tr-surplus'
									: i % 2 === 1
										? 'dv-tr-alt'
										: '';
						const applicable = new Set(getClsFields(r.code).map((f) => f.id));
						return (
							<tr
								key={r.tt}
								className={rowClass}
							>
								<td className='dv-td dv-td-sticky dv-td-idx'>{r.tt}</td>
								<td className='dv-td dv-td-sticky dv-td-name'>{r.ten}</td>
								<td className={cellCls(applicable, 'sampleOrVisit')}>
									{n(r.daLam.sampleOrVisit)}
								</td>
								<td className={cellCls(applicable, 'xrayUs')}>{n(r.daLam.xrayUs)}</td>
								<td className={cellCls(applicable, 'ctEndoscopy')}>
									{n(r.daLam.ctEndoscopy)}
								</td>
								<td className={cellCls(applicable, 'mriBoneDensity')}>
									{n(r.daLam.mriBoneDensity)}
								</td>
								<td className={cellCls(applicable, 'ecgIntervention')}>
									{n(r.daLam.ecgIntervention)}
								</td>
								<td className={cellCls(applicable, 'linen')}>{n(r.daLam.linenMedia)}</td>
								<td className={cellCls(applicable, 'toolMetal')}>
									{n(r.daLam.toolMetal)}
								</td>
								<td className={cellCls(applicable, 'toolPlastic')}>
									{n(r.daLam.toolPlastic)}
								</td>
								<td className={cellCls(applicable, 'supervisedDept')}>
									{n(r.daLam.supervisedDept)}
								</td>
								<td className={cellCls(applicable, 'sampleOrVisit')}>
									{n(r.tonCho.sampleOrVisit)}
								</td>
								<td className={cellCls(applicable, 'xrayUs')}>{n(r.tonCho.xrayUs)}</td>
								<td className={cellCls(applicable, 'ctEndoscopy')}>
									{n(r.tonCho.ctEndoscopy)}
								</td>
								<td className={cellCls(applicable, 'mriBoneDensity')}>
									{n(r.tonCho.mriBoneDensity)}
								</td>
								<td className={cellCls(applicable, 'ecgIntervention')}>
									{n(r.tonCho.ecgIntervention)}
								</td>
								<td className={cellCls(applicable, 'linen')}>{n(r.tonCho.linen)}</td>
								<td className={cellCls(applicable, 'toolMetal')}>
									{n(r.tonCho.toolMetal)}
								</td>
								<td className={cellCls(applicable, 'toolPlastic')}>
									{n(r.tonCho.toolPlastic)}
								</td>
								<td className='dv-td dv-td-c'>{n(r.nlTong)}</td>
								<td className='dv-td dv-td-c'>{n(r.nghiTruc)}</td>
								<td className='dv-td dv-td-c'>{n(r.nghiTren2)}</td>
								<td className='dv-td dv-td-c dv-td-nl dv-td-bold'>
									{n(r.diLam)}
								</td>
								<td className='dv-td dv-td-c dv-td-kc'>
									{r.tyLe !== null ? `${(r.tyLe * 100).toFixed(1)}%` : '—'}
								</td>
								<td className='dv-td dv-td-c dv-td-kc'>{r.khuyenCao ?? '—'}</td>
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
			{clsRows.length > 0 && (
				<tfoot>
					<tr className='dv-tfoot'>
						<td
							colSpan={2}
							className='dv-tf-label'
						>
							∑ Tổng ({clsRows.length} khoa)
						</td>
						<td colSpan={17} />
						<td className='dv-td-c'>{clsStats.totalNL}</td>
						<td className='dv-td-c'>{clsStats.totalNghiTruc}</td>
						<td className='dv-td-c'>{clsStats.totalNghiDai}</td>
						<td className='dv-td-c dv-td-bold dv-td-nl'>
							{clsStats.totalDiLam}
						</td>
						<td className='dv-td-c dv-td-kc'>
							{clsStats.totalKhoiLuong > 0 ? `${clsStats.rateDiLam}%` : '—'}
						</td>
						<td className='dv-td-c dv-td-kc'>
							{clsStats.totalKhuyenCao > 0 ? clsStats.totalKhuyenCao : '—'}
						</td>
						<td />
						<td />
						<td />
					</tr>
				</tfoot>
			)}
		</table>
	);
}
