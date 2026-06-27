import CheckIcon from '@/assets/svg/CheckIcon';
import XIcon from '@/assets/svg/XIcon';
import ModalForm from '@/components/common/ModalForm';
import Calendar from '@/components/ui/Calendar';
import { useAuth } from '@/context/useAuth';
import { useDeptFilter } from '@/hooks/useDeptFilter';
import { useDeptPermissions } from '@/hooks/UseDeptPermissionsReturn';
import usePagination from '@/hooks/usePagination';
import { useReportData } from '@/hooks/useReportData';
import type { ApiRecord } from '@/types/apiType';
import {
	fmtUpdatedAt,
	formatDateToVN,
	getTodayDateString,
} from '@/utils/dateUtils';
import { formatNumber } from '@/utils/formatUtils';
import { aggregateDashboardStats, toKhoaRecord } from '@/utils/staffingCalc';
import { buildStripItems } from '@/utils/UIHelperUtils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddRecordModal from '../components/modal/AddRecordModal';
import CreateReportModal from '../components/modal/CreateReportModal';
import EditRecordModal from '../components/modal/EditRecordModal';
import PageHeader from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import StatCard from '../components/StatCard';

export default function DataPage() {
	const today = getTodayDateString();
	const n = formatNumber;
	const { deptPermissions, user } = useAuth();

	// ── State điều hướng ─────────────────────────────────────────────────
	const [selDate, setSelDate] = useState(today);
	const [drawerOpen, setDrawer] = useState(false);
	const [allDepts, setAllDepts] = useState<
		{ id_department: number; department_name: string }[]
	>([]);

	// ── Fetch danh sách tất cả khoa active (1 lần khi mount) ─────────────
	useEffect(() => {
		fetch('/api/departments/simple')
			.then((r) => r.json())
			.then((d) => {
				if (d.success && Array.isArray(d.data)) setAllDepts(d.data);
			})
			.catch(() => {});
	}, []);

	// ── Custom hooks ─────────────────────────────────────────────────────
	const {
		report,
		setReport,
		reportMetas,
		setReportMetas,
		loadingReport,
		apiError,
		setApiError,
	} = useReportData(selDate);

	const allRows = useMemo(
		() => (report?.records ?? []).map((r, i) => toKhoaRecord(r, i + 1)),
		[report],
	);

	const {
		selKhoa,
		setSelKhoa,
		sidebarSearch,
		setSidebarSearch,
		toggleKhoa,
		selectAll,
		clearAll,
	} = useDeptFilter(allRows);

	const { grantLocalPerm, getPermForDept, canDeleteReport } =
		useDeptPermissions(report, deptPermissions, user?.vaiTro);

	// ── Modal state ──────────────────────────────────────────────────────
	const [editRecord, setEditRecord] = useState<ApiRecord | null>(null);
	const [showDelConfirm, setShowDelConfirm] = useState(false);
	const [showAddRecord, setShowAddRecord] = useState(false);
	const [showCreate, setShowCreate] = useState(false);
	const [delRecord, setDelRecord] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [saving, setSaving] = useState(false);

	// ── Filtered rows + stats + pagination ───────────────────────────────
	const filtered = allRows.filter((r) => selKhoa.has(r.tt));
	const stats = aggregateDashboardStats(filtered);

	// ── Khoa chưa nhập dữ liệu ───────────────────────────────────────────
	const enteredDeptIds = useMemo(
		() => new Set(report?.records.map((r) => r.id_department) ?? []),
		[report],
	);
	const missingDepts = useMemo(
		() => allDepts.filter((d) => !enteredDeptIds.has(d.id_department)),
		[allDepts, enteredDeptIds],
	);

	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		totalPages,
		paginatedData: pageRows,
	} = usePagination(filtered, 15);

	// ── Dual scroll sync ─────────────────────────────────────────────────
	const tblOuterRef = useRef<HTMLDivElement>(null);
	const scrollTopRef = useRef<HTMLDivElement>(null);
	const scrollInnerRef = useRef<HTMLDivElement>(null);

	const syncScrollWidth = useCallback(() => {
		const outer = tblOuterRef.current;
		const inner = scrollInnerRef.current;
		if (outer && inner) inner.style.width = outer.scrollWidth + 'px';
	}, []);

	useEffect(() => {
		const outer = tblOuterRef.current;
		const topBar = scrollTopRef.current;
		if (!outer || !topBar) return;
		syncScrollWidth();
		const ro = new ResizeObserver(syncScrollWidth);
		ro.observe(outer);
		let fromOuter = false,
			fromTop = false;
		const onOuter = () => {
			if (fromTop) {
				fromTop = false;
				return;
			}
			fromOuter = true;
			topBar.scrollLeft = outer.scrollLeft;
		};
		const onTop = () => {
			if (fromOuter) {
				fromOuter = false;
				return;
			}
			fromTop = true;
			outer.scrollLeft = topBar.scrollLeft;
		};
		outer.addEventListener('scroll', onOuter, { passive: true });
		topBar.addEventListener('scroll', onTop, { passive: true });
		return () => {
			ro.disconnect();
			outer.removeEventListener('scroll', onOuter);
			topBar.removeEventListener('scroll', onTop);
		};
	}, [report, syncScrollWidth]);

	// ── Xóa toàn bộ báo cáo ngày ────────────────────────────────────────
	const delReport = async () => {
		if (!report) return;
		setSaving(true);
		setApiError('');
		try {
			const res = await fetch(`/api/reports/${report.id_report}`, {
				method: 'DELETE',
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setApiError(data.message ?? 'Lỗi khi xóa');
				return;
			}
			setReportMetas((prev) =>
				prev.filter((m) => m.id_report !== report.id_report),
			);
			setReport(null);
			setShowDelConfirm(false);
		} catch {
			setApiError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	// ── Xóa 1 record khoa ────────────────────────────────────────────────
	const confirmDelRecord = async () => {
		if (!delRecord || !report) return;
		setSaving(true);
		setApiError('');
		try {
			const res = await fetch(
				`/api/reports/${report.id_report}/records/${delRecord.id}`,
				{ method: 'DELETE' },
			);
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setApiError(data.message ?? 'Lỗi khi xóa');
				return;
			}
			const rRes = await fetch(`/api/reports/date/${selDate}`);
			const rData = (await rRes.json()) as {
				success: boolean;
				data: typeof report;
			};
			if (rData.success) setReport(rData.data);
			setDelRecord(null);
		} catch {
			setApiError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	// ────────────────────────────────────────────────────────────────────
	return (
		<div className='pg dv-pg'>
			{/* ── Sidebar ── */}
			<aside className={`dv-aside${drawerOpen ? ' dv-aside-open' : ''}`}>
				<button
					className='dv-aside-close'
					onClick={() => setDrawer(false)}
				>
					✕
				</button>

				<div className='dv-cal-wrap'>
					<Calendar
						records={reportMetas.map((d) => ({
							date: d.report_date.slice(0, 10),
						}))}
						activeDate={selDate}
						onSelect={(d) => setSelDate(d)}
						onAdd={(d) => setSelDate(d)}
					/>
				</div>

				<div className='dv-khoa-panel'>
					<div className='dv-khoa-panel-hdr'>
						<span className='dv-khoa-panel-title'>
							Khoa / Phòng
							{selKhoa.size > 0 && (
								<span className='dv-khoa-badge'>{selKhoa.size}</span>
							)}
						</span>
						<div style={{ display: 'flex', gap: 4 }}>
							<button
								className='dv-kp-btn'
								onClick={selectAll}
							>
								Tất cả
							</button>
							<button
								className='dv-kp-btn'
								onClick={clearAll}
							>
								Bỏ
							</button>
						</div>
					</div>
					<div style={{ padding: '0 12px 12px' }}>
						<SearchInput
							placeholder='Tìm khoa…'
							value={sidebarSearch}
							onChange={setSidebarSearch}
						/>
					</div>
					<div className='dv-khoa-list-scroll'>
						{allRows
							.filter(
								(k) =>
									sidebarSearch === '' ||
									k.ten.toLowerCase().includes(sidebarSearch.toLowerCase()),
							)
							.map((k) => {
								const checked = selKhoa.has(k.tt);
								const dp = k.dieuPhoi;
								const rowAccent =
									dp !== null && dp < 0
										? 'dv-kr-deficit'
										: dp !== null && dp > 0
											? 'dv-kr-surplus'
											: '';
								return (
									<button
										key={k.tt}
										className={`dv-khoa-row ${checked ? 'dv-kr-on' : 'dv-kr-off'} ${rowAccent}`}
										onClick={() => toggleKhoa(k.tt)}
									>
										<span
											className={`dv-kr-check ${checked ? 'dv-kr-check-on' : 'dv-kr-check-off'}`}
										>
											{checked && <CheckIcon />}
										</span>
										<span className='dv-kr-num'>{k.tt}</span>
										<span className='dv-kr-name'>{k.ten}</span>
										{dp !== null && dp !== 0 && (
											<span
												className={`dv-kr-dp ${dp < 0 ? 'dv-kr-dp-red' : 'dv-kr-dp-green'}`}
											>
												{dp > 0 ? `+${dp}` : dp}
											</span>
										)}
									</button>
								);
							})}
					</div>
				</div>

				{/* ── Khoa chưa nhập dữ liệu ── */}
				{report && missingDepts.length > 0 && (
					<div
						className='dv-khoa-panel'
						style={{ marginTop: 8 }}
					>
						<div className='dv-khoa-panel-hdr'>
							<span
								className='dv-khoa-panel-title'
								style={{ color: '#b45309' }}
							>
								⚠ Chưa nhập
								<span
									className='dv-khoa-badge'
									style={{ background: '#fef3c7', color: '#b45309' }}
								>
									{missingDepts.length}
								</span>
							</span>
						</div>
						<div className='dv-khoa-list-scroll'>
							{missingDepts.map((d, idx) => (
								<div
									key={d.id_department}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 6,
										padding: '5px 12px',
										background: '#fffbeb',
										borderLeft: '3px solid #f59e0b',
										color: '#92400e',
										fontSize: '.78rem',
									}}
								>
									<span className='dv-kr-num'>{idx + 1}</span>
									<span className='dv-kr-name'>{d.department_name}</span>
								</div>
							))}
						</div>
					</div>
				)}
			</aside>

			{/* ── Mobile Filter Drawer Overlay ── */}
			{drawerOpen && (
				<div
					className='dv-overlay'
					onClick={() => setDrawer(false)}
				/>
			)}

			{/* ── Main ── */}
			<div className='dv-main'>
				<PageHeader
					title='Dữ liệu nhân lực'
					subtitle={
						<>
							BẢNG THEO DÕI NHÂN LỰC ĐD - HỘ SINH - KTV
							<span
								className='dv-date-badge'
								style={{ marginLeft: '8px' }}
							>
								{formatDateToVN(selDate)}
							</span>
						</>
					}
				>
					<button
						className='dv-drawer-toggle'
						onClick={() => setDrawer((o) => !o)}
					>
						<XIcon size={16} /> Bộ lọc
					</button>
					{report && (
						<button
							className='btn-outline'
							style={{
								fontSize: '0.82rem',
								fontWeight: 600,
								border: '1.5px solid var(--p)',
								borderRadius: '8px',
								padding: '6px 12px',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
							}}
							onClick={() => setShowAddRecord(true)}
						>
							+ Thêm báo cáo khoa
						</button>
					)}
					{selKhoa.size > 0 && selKhoa.size < allRows.length && (
						<button
							className='btn-ghost'
							style={{
								fontSize: '0.82rem',
								fontWeight: 600,
								color: 'var(--red)',
								border: '1.5px solid #fecaca',
								backgroundColor: '#fff5f5',
								borderRadius: '8px',
								padding: '6px 12px',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								cursor: 'pointer',
							}}
							onClick={() => setSelKhoa(new Set(allRows.map((k) => k.tt)))}
						>
							✕ Bỏ lọc ({selKhoa.size} khoa)
						</button>
					)}
					{report && missingDepts.length > 0 && (
						<span
							style={{
								fontSize: '0.82rem',
								fontWeight: 600,
								background: '#fffbeb',
								color: '#b45309',
								border: '1.5px solid #fcd34d',
								borderRadius: '8px',
								padding: '6px 12px',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								cursor: 'default',
								userSelect: 'none',
							}}
							title={missingDepts.map((d) => d.department_name).join('\n')}
						>
							⚠ {missingDepts.length} khoa chưa nhập
						</span>
					)}
					{report && canDeleteReport && (
						<button
							className='btn-ghost'
							style={{
								fontSize: '0.82rem',
								fontWeight: 600,
								color: 'var(--red)',
								border: '1.5px solid #fecaca',
								backgroundColor: '#fff5f5',
								borderRadius: '8px',
								padding: '6px 12px',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								cursor: 'pointer',
							}}
							onClick={() => {
								setApiError('');
								setShowDelConfirm(true);
							}}
						>
							🗑 Xóa báo cáo
						</button>
					)}
					{!report && !loadingReport && (
						<button
							className='btn-primary'
							style={{ fontSize: '.78rem' }}
							onClick={() => setShowCreate(true)}
						>
							＋ Tạo báo cáo
						</button>
					)}
				</PageHeader>

				{apiError && (
					<div
						style={{
							background: '#fef2f2',
							border: '1px solid #fecaca',
							borderRadius: 8,
							padding: '8px 14px',
							marginBottom: 12,
							fontSize: '.82rem',
							color: '#dc2626',
						}}
					>
						⚠️ {apiError}
					</div>
				)}

				{/* Strip tổng hợp */}
				<div className='dv-strip'>
					{buildStripItems(
						stats.totalNB,
						stats.totalNL,
						stats.totalDiLam,
						stats.totalTT03,
						Number(stats.totalKhuyenNghi.toFixed(2)),
						stats.totalKC,
						filtered.length,
						37,
						missingDepts.length,
					).map((s) => (
						<StatCard
							key={s.label}
							className='dv-strip-card'
							label={s.label}
							value={s.val}
							textColor={s.color}
							bgColor={s.bg}
						/>
					))}
				</div>

				{/* Bảng dữ liệu */}
				<div className='dv-tbl-wrap'>
					<div
						className='dv-scroll-top'
						ref={scrollTopRef}
					>
						<div
							className='dv-scroll-top-inner'
							ref={scrollInnerRef}
						/>
					</div>
					<div
						className='dv-tbl-outer'
						ref={tblOuterRef}
					>
						{loadingReport ? (
							<div
								style={{
									textAlign: 'center',
									padding: '60px',
									color: 'var(--mut)',
									fontSize: '.85rem',
								}}
							>
								Đang tải dữ liệu...
							</div>
						) : !report ? (
							<div style={{ textAlign: 'center', padding: '60px' }}>
								<p style={{ fontSize: '2rem', marginBottom: 8 }}>📋</p>
								<p
									style={{
										color: 'var(--mut)',
										fontSize: '.85rem',
										marginBottom: 16,
									}}
								>
									Chưa có báo cáo cho ngày {formatDateToVN(selDate)}
								</p>
								<button
									className='btn-primary'
									onClick={() => setShowCreate(true)}
								>
									＋ Tạo báo cáo ngày này
								</button>
							</div>
						) : (
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
													<td className='dv-td dv-td-sticky dv-td-idx'>
														{r.tt}
													</td>
													<td className='dv-td dv-td-sticky dv-td-name'>
														{r.ten}
													</td>
													<td className='dv-td dv-td-c'>{n(r.giuong)}</td>
													<td className='dv-td dv-td-c dv-td-nb'>
														{n(r.csc1)}
													</td>
													<td className='dv-td dv-td-c dv-td-nb'>
														{n(r.csc2)}
													</td>
													<td className='dv-td dv-td-c dv-td-nb'>
														{n(r.csc3)}
													</td>
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
													<td className='dv-td dv-td-c dv-td-kc'>
														{n(r.tt03, 2)}
													</td>
													<td className='dv-td dv-td-c dv-td-kc'>
														{r.khuyenNghi != null ? n(r.khuyenNghi, 2) : '—'}
													</td>
													<td
														className={`dv-td dv-td-c dv-td-bold${dp === null ? '' : dp > 0 ? ' dv-dp-p' : dp < 0 ? ' dv-dp-m' : ' dv-dp-z'}`}
													>
														{dp === null ? '—' : dp > 0 ? `+${dp}` : String(dp)}
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
																	onClick={() => setEditRecord(apiRec)}
																>
																	✏️
																</button>
															)}
															{(perm?.can_delete ?? false) && apiRec && (
																<button
																	className='tbl-btn tbl-btn-del'
																	title='Xóa bản ghi khoa này'
																	onClick={() =>
																		setDelRecord({ id: apiRec.id, name: r.ten })
																	}
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
										<td className='dv-td-c dv-td-bold dv-td-nl'>
											{stats.totalDiLam}
										</td>
										<td className='dv-td-c dv-td-kc'>
											{stats.totalTT03.toFixed(1)}
										</td>
										<td className='dv-td-c dv-td-kc'>
											{stats.totalKhuyenNghi > 0
												? stats.totalKhuyenNghi.toFixed(1)
												: '—'}
										</td>
										<td />
										<td />
										<td />
										<td />
										<td />
									</tr>
								</tfoot>
							</table>
						)}
					</div>
				</div>

				{/* Phân trang */}
				{report && filtered.length > 0 && (
					<div className='dv-pager'>
						<div className='dv-pager-info'>
							Hiển thị{' '}
							<strong>
								{Math.min((page - 1) * pageSize + 1, filtered.length)}–
								{Math.min(page * pageSize, filtered.length)}
							</strong>{' '}
							trong <strong>{filtered.length}</strong> khoa
						</div>
						<div className='dv-pager-nav'>
							<button
								className='dv-pager-btn'
								onClick={() => setPage(1)}
								disabled={page === 1}
								title='Trang đầu'
							>
								«
							</button>
							<button
								className='dv-pager-btn'
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page === 1}
								title='Trang trước'
							>
								‹
							</button>
							{Array.from({ length: totalPages }, (_, i) => i + 1)
								.filter(
									(p) =>
										totalPages <= 7 ||
										p === 1 ||
										p === totalPages ||
										Math.abs(p - page) <= 1,
								)
								.reduce<(number | '...')[]>((acc, p, idx, arr) => {
									if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1)
										acc.push('...');
									acc.push(p);
									return acc;
								}, [])
								.map((p, idx) =>
									p === '...' ? (
										<span
											key={`dot-${idx}`}
											className='dv-pager-dots'
										>
											…
										</span>
									) : (
										<button
											key={p}
											className={`dv-pager-btn${p === page ? ' dv-pager-btn-active' : ''}`}
											onClick={() => setPage(p as number)}
										>
											{p}
										</button>
									),
								)}
							<button
								className='dv-pager-btn'
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page === totalPages}
								title='Trang sau'
							>
								›
							</button>
							<button
								className='dv-pager-btn'
								onClick={() => setPage(totalPages)}
								disabled={page === totalPages}
								title='Trang cuối'
							>
								»
							</button>
						</div>
						<div className='dv-pager-size'>
							<span>Hiển thị</span>
							<select
								className='dv-pager-select'
								value={pageSize}
								onChange={(e) => setPageSize(Number(e.target.value))}
							>
								{[10, 15, 20, 36].map((s) => (
									<option
										key={s}
										value={s}
									>
										{s} khoa/trang
									</option>
								))}
							</select>
						</div>
					</div>
				)}
			</div>

			{/* Overlay mobile */}
			{drawerOpen && (
				<div
					className='dv-overlay'
					onClick={() => setDrawer(false)}
				/>
			)}

			{/* ── Modals ── */}

			{editRecord && report && (
				<EditRecordModal
					record={editRecord}
					report={report}
					selDate={selDate}
					userId={user?.id}
					onSaved={(updated) => {
						setReport(updated);
						setEditRecord(null);
					}}
					onClose={() => setEditRecord(null)}
				/>
			)}

			{showCreate && (
				<CreateReportModal
					selDate={selDate}
					userId={user?.id}
					onCreated={(newReport) => {
						setReport(newReport);
						setReportMetas((prev) => [
							...prev,
							{ id_report: newReport.id_report, report_date: selDate },
						]);
					}}
					onClose={() => setShowCreate(false)}
				/>
			)}

			{showAddRecord && report && (
				<AddRecordModal
					reportId={report.id_report}
					selDate={selDate}
					existingDeptIds={new Set(report.records.map((r) => r.id_department))}
					userId={user?.id}
					onAdded={(updatedReport, newDeptId) => {
						setReport(updatedReport);
						grantLocalPerm(newDeptId);
					}}
					onClose={() => setShowAddRecord(false)}
				/>
			)}

			{showDelConfirm && (
				<ModalForm
					title='⚠️ Xác nhận xóa báo cáo'
					onClose={() => setShowDelConfirm(false)}
					size='sm'
				>
					{apiError && <p className='login-error'>⚠️ {apiError}</p>}
					<p className='confirm-txt'>
						Xóa toàn bộ báo cáo ngày <strong>{formatDateToVN(selDate)}</strong>?
						<br />
						<span style={{ fontSize: '.8rem', color: '#64748b' }}>
							Dữ liệu tất cả {report?.records.length ?? 0} khoa trong ngày này
							sẽ bị xóa vĩnh viễn.
						</span>
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setShowDelConfirm(false)}
							disabled={saving}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={delReport}
							disabled={saving}
						>
							{saving ? '⏳ Đang xóa...' : '🗑 Xóa báo cáo'}
						</button>
					</div>
				</ModalForm>
			)}

			{delRecord && (
				<ModalForm
					title='⚠️ Xác nhận xóa bản ghi'
					onClose={() => setDelRecord(null)}
					size='sm'
				>
					{apiError && <p className='login-error'>⚠️ {apiError}</p>}
					<p className='confirm-txt'>
						Xóa bản ghi của <strong>{delRecord.name}</strong> khỏi báo cáo ngày{' '}
						<strong>{formatDateToVN(selDate)}</strong>?
						<br />
						<span style={{ fontSize: '.8rem', color: '#64748b' }}>
							Chỉ xóa dữ liệu của khoa này, không ảnh hưởng các khoa khác.
						</span>
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setDelRecord(null)}
							disabled={saving}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={confirmDelRecord}
							disabled={saving}
						>
							{saving ? '⏳...' : '🗑 Xóa bản ghi'}
						</button>
					</div>
				</ModalForm>
			)}
		</div>
	);
}
