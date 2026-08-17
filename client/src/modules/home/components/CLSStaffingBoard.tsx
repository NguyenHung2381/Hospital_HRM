import ModalForm from '@/components/common/ModalForm';
import Calendar from '@/components/ui/Calendar';
import StatCard from '@/components/ui/StatCard';
import { useAuth } from '@/context/useAuth';
import { useAppSSE } from '@/hooks/useAppSSE';
import type { ApiClsRecord } from '@/types/apiType';
import type { DailyClsRecord } from '@/types/clsType';
import { blankDailyClsRecord } from '@/types/clsType';
import type { KhoaItem } from '@/types/staffingType';
import {
	apiToDailyClsRecord,
	computeCls,
	dailyClsToApiBody,
} from '@/utils/clsCalc';
import {
	formatDateToVN,
	getNextAvailableDate,
	getTodayDateString,
} from '@/utils/dateUtils';
import { isReportLocked } from '@/utils/staffingCalc';
import { useCallback, useEffect, useState } from 'react';
import CLSStaffingForm from './CLSStaffingForm';
import DeptSelector from './DeptSelector';
import ChangePasswordModal from './modal/ChangePasswordModal';
import ReportPage from '../pages/ReportPage';

export interface CLSStaffingBoardProps {
	userKhoa: KhoaItem[];
	onDeptNameChange: (name: string) => void;
	showReportModal: boolean;
	onCloseReportModal: () => void;
	showPasswordModal: boolean;
	onClosePasswordModal: () => void;
}

export default function CLSStaffingBoard({
	userKhoa,
	onDeptNameChange,
	showReportModal,
	onCloseReportModal,
	showPasswordModal,
	onClosePasswordModal,
}: CLSStaffingBoardProps) {
	const { user, deptPermissions } = useAuth();
	const [activeKhoaId, setActiveKhoaId] = useState<number>(
		userKhoa.length > 0 ? userKhoa[0].id : 0,
	);
	const [recommendedStaff, setRecommendedStaff] = useState<number | null>(
		userKhoa.length > 0 ? (userKhoa[0].heSoRec?.fixedAdd ?? null) : null,
	);

	const [records, setRecords] = useState<DailyClsRecord[]>([]);
	const [recordIds, setRecordIds] = useState<
		Record<string, { id_report: number; record_id: number }>
	>({});
	const [activeDate, setActiveDate] = useState(getTodayDateString());
	const [loadingRecords, setLoadingRecords] = useState(false);
	const [saving, setSaving] = useState(false);
	const [apiError, setApiError] = useState('');

	useEffect(() => {
		if (userKhoa.length > 0 && activeKhoaId === 0) {
			setActiveKhoaId(userKhoa[0].id);
			setRecommendedStaff(userKhoa[0].heSoRec?.fixedAdd ?? null);
			onDeptNameChange(userKhoa[0].ten);
		}
	}, [userKhoa, activeKhoaId, onDeptNameChange]);

	type MMode = 'add' | 'edit' | null;
	const [mMode, setMMode] = useState<MMode>(null);
	const [formInitial, setFormInitial] = useState<DailyClsRecord>(
		blankDailyClsRecord(getTodayDateString()),
	);
	const [delDate, setDelDate] = useState<string | null>(null);

	const active = records.find((r) => r.date === activeDate) ?? null;
	const stats = active ? computeCls(active, recommendedStaff) : null;

	const _perm = deptPermissions.find((p) => p.id_department === activeKhoaId);
	const _accessType = user?.department_access_type;
	const hasEditPerm = _perm?.can_edit ?? false;
	const hasDeletePerm = _perm?.can_delete ?? false;

	const canAddForDate = (date: string) =>
		hasEditPerm && !isReportLocked(date, _accessType);
	const lockedActive = isReportLocked(activeDate, _accessType);
	const canEdit = hasEditPerm && !lockedActive;
	const canDelete = hasDeletePerm && !lockedActive;
	const lockReason = lockedActive
		? `Đã chốt sổ ngày ${formatDateToVN(activeDate)} — chỉ Admin mới có thể chỉnh sửa`
		: '';

	// ── Fetch records từ API khi đổi khoa ────────────────────
	const fetchKhoaRecords = useCallback(async () => {
		if (!activeKhoaId) return;
		setLoadingRecords(true);
		try {
			const from = new Date();
			from.setDate(from.getDate() - 30);
			const fromStr = from.toISOString().slice(0, 10);
			const listRes = await fetch(`/api/reports?from=${fromStr}`);
			const listData = (await listRes.json()) as {
				success: boolean;
				data: { id_report: number; report_date: string }[];
			};
			if (!listData.success) return;

			const detailPromises = listData.data.map((rep) =>
				fetch(`/api/reports/${rep.id_report}`).then(
					(r) =>
						r.json() as Promise<{
							success: boolean;
							data: {
								id_report: number;
								report_date: string;
								cls_records: ApiClsRecord[];
							};
						}>,
				),
			);
			const details = await Promise.all(detailPromises);

			const newRecords: DailyClsRecord[] = [];
			const newIds: Record<string, { id_report: number; record_id: number }> =
				{};

			for (const detail of details) {
				if (!detail.success) continue;
				const { id_report, report_date, cls_records: recs } = detail.data;
				const deptRec = recs.find((r) => r.id_department === activeKhoaId);
				if (!deptRec) continue;
				const dateKey = report_date.slice(0, 10);
				newRecords.push(apiToDailyClsRecord(dateKey, deptRec));
				newIds[dateKey] = { id_report, record_id: deptRec.id };
				if (deptRec.recommended_staff !== null)
					setRecommendedStaff(deptRec.recommended_staff);
			}

			newRecords.sort((a, b) => a.date.localeCompare(b.date));
			setRecords(newRecords);
			setRecordIds(newIds);
			const today = getTodayDateString();
			const hasToday = newRecords.some((r) => r.date === today);
			if (!hasToday && newRecords.length)
				setActiveDate(newRecords[newRecords.length - 1].date);
		} finally {
			setLoadingRecords(false);
		}
	}, [activeKhoaId]);

	useEffect(() => {
		fetchKhoaRecords();
	}, [fetchKhoaRecords]);

	// ── Realtime: tự cập nhật khi có thay đổi từ server ──────
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'reports') {
					fetchKhoaRecords();
				}
			},
			[fetchKhoaRecords],
		),
	);

	const openAdd = (date?: string) => {
		setFormInitial(
			blankDailyClsRecord(
				date ?? getNextAvailableDate(records.map((r) => r.date)),
			),
		);
		setApiError('');
		setMMode('add');
	};

	const openEdit = () => {
		if (active) {
			setFormInitial(JSON.parse(JSON.stringify(active)));
			setApiError('');
			setMMode('edit');
		}
	};

	const saveRecord = async (draft: DailyClsRecord) => {
		setSaving(true);
		setApiError('');
		try {
			const ids = recordIds[draft.date];
			if (ids) {
				const res = await fetch(
					`/api/reports/${ids.id_report}/cls-records/${ids.record_id}`,
					{
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(dailyClsToApiBody(draft)),
					},
				);
				if (!res.ok) {
					const err = (await res.json().catch(() => ({}))) as {
						message?: string;
					};
					setApiError(err.message ?? 'Lỗi khi cập nhật dữ liệu');
					return;
				}
			} else {
				const checkRes = await fetch(
					`/api/reports?from=${draft.date}&to=${draft.date}`,
				);
				const checkData = (await checkRes.json().catch(() => ({}))) as {
					success?: boolean;
					data?: { id_report: number; report_date: string }[];
				};
				const existingReport = checkData.data?.[0];
				let targetIdReport: number | undefined;

				if (existingReport) {
					const addRes = await fetch(
						`/api/reports/${existingReport.id_report}/cls-records`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id_department: activeKhoaId,
								created_by: user?.id ?? null,
								...dailyClsToApiBody(draft),
							}),
						},
					);
					if (!addRes.ok) {
						setApiError('Lỗi khi thêm bản ghi vào báo cáo');
						return;
					}
					targetIdReport = existingReport.id_report;
				} else {
					const createRes = await fetch(`/api/reports`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							report_date: draft.date,
							created_by: user?.id ?? null,
						}),
					});
					if (!createRes.ok) {
						setApiError('Lỗi khi tạo báo cáo mới');
						return;
					}
					const createData = (await createRes.json()) as {
						success: boolean;
						data: { id_report: number };
					};
					targetIdReport = createData.data?.id_report;

					if (targetIdReport) {
						const addRes = await fetch(
							`/api/reports/${targetIdReport}/cls-records`,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									id_department: activeKhoaId,
									created_by: user?.id ?? null,
									...dailyClsToApiBody(draft),
								}),
							},
						);
						if (!addRes.ok) {
							setApiError('Lỗi khi thêm bản ghi vào báo cáo');
							return;
						}
					}
				}

				if (targetIdReport) {
					setRecordIds((prev) => ({
						...prev,
						[draft.date]: {
							id_report: targetIdReport!,
							record_id: 0,
						},
					}));
				}
			}

			setRecords((prev) =>
				[...prev.filter((r) => r.date !== draft.date), draft].sort((a, b) =>
					a.date.localeCompare(b.date),
				),
			);
			setActiveDate(draft.date);
			setMMode(null);
			fetchKhoaRecords();
		} finally {
			setSaving(false);
		}
	};

	const confirmDel = async () => {
		if (!delDate) return;
		const ids = recordIds[delDate];
		setSaving(true);
		setApiError('');
		try {
			if (ids?.record_id) {
				const res = await fetch(
					`/api/reports/${ids.id_report}/cls-records/${ids.record_id}`,
					{ method: 'DELETE' },
				);
				if (!res.ok) {
					setApiError('Lỗi khi xoá bản ghi');
					setDelDate(null);
					return;
				}
				setRecordIds((prev) => {
					const next = { ...prev };
					delete next[delDate];
					return next;
				});
			}
			const remaining = records.filter((r) => r.date !== delDate);
			setRecords(remaining);
			setActiveDate(
				remaining.length
					? remaining[remaining.length - 1].date
					: getTodayDateString(),
			);
			setDelDate(null);
		} finally {
			setSaving(false);
		}
	};

	const handleKhoaChange = (k: KhoaItem) => {
		setActiveKhoaId(k.id);
		setRecommendedStaff(k.heSoRec?.fixedAdd ?? null);
		onDeptNameChange(k.ten);
	};

	return (
		<>
			<aside className='sidebar'>
				<DeptSelector
					khoaList={userKhoa}
					activeId={activeKhoaId}
					onChange={handleKhoaChange}
				/>
				<Calendar
					records={records}
					activeDate={activeDate}
					onSelect={setActiveDate}
					onAdd={(date) => {
						if (canAddForDate(date ?? getTodayDateString())) openAdd(date);
					}}
				/>
				<div className='cal-legend'>
					<div className='legend-item'>
						<span className='cal-dot' /> Đã có dữ liệu
					</div>
					<div className='legend-item'>
						<span className='legend-circle' /> Ngày đang chọn
					</div>
				</div>
				{hasEditPerm && (
					<button
						className='btn-add-full'
						onClick={() => openAdd()}
					>
						＋ Thêm ngày mới
					</button>
				)}
			</aside>

			<div className='content'>
				{apiError && <div className='api-error-banner'>⚠️ {apiError}</div>}
				{lockedActive && (
					<div className='lock-banner'>
						<span className='lock-banner-icon'>🔒</span>
						<span>{lockReason}</span>
					</div>
				)}

				{loadingRecords ? (
					<div className='empty'>
						<p className='empty-icon'>⏳</p>
						<p className='empty-title'>Đang tải dữ liệu...</p>
					</div>
				) : !active || !stats ? (
					<div className='empty'>
						<p className='empty-icon'>📋</p>
						<p className='empty-title'>Chưa có dữ liệu cho ngày này</p>
						<p className='empty-sub'>{formatDateToVN(activeDate)}</p>
						{canAddForDate(activeDate) && (
							<button
								className='btn-primary'
								onClick={() => openAdd(activeDate)}
							>
								＋ Thêm bản ghi
							</button>
						)}
					</div>
				) : (
					<>
						<div className='date-hdr'>
							<div>
								<p className='date-hdr-label'>Ngày đang xem</p>
								<p className='date-hdr-val'>{formatDateToVN(activeDate)}</p>
							</div>
							<div className='date-hdr-actions'>
								<button
									className='btn-outline'
									onClick={() =>
										window.open(
											`/api/reports/cls-export?date=${activeDate}`,
											'_blank',
										)
									}
									title='Xuất Excel đúng mẫu báo cáo hệ CLS cho ngày này'
								>
									📥 Xuất Excel (mẫu CLS)
								</button>
								{hasEditPerm && (
									<button
										className='btn-edit'
										onClick={canEdit ? openEdit : undefined}
										disabled={!canEdit}
										title={lockedActive ? lockReason : 'Sửa bản ghi'}
									>
										✏️ Sửa{' '}
										{lockedActive && <span className='btn-lock-ico'>🔒</span>}
									</button>
								)}
								{hasDeletePerm && (
									<button
										className='btn-del'
										onClick={
											canDelete ? () => setDelDate(activeDate) : undefined
										}
										disabled={!canDelete}
										title={lockedActive ? lockReason : 'Xoá bản ghi'}
									>
										🗑 Xoá{' '}
										{lockedActive && <span className='btn-lock-ico'>🔒</span>}
									</button>
								)}
							</div>
						</div>

						<div className='stats-row'>
							<StatCard
								icon='📊'
								label='Tổng khối lượng CV'
								value={String(stats.tongKhoiLuong)}
								accent='blue'
							/>
							<StatCard
								icon='👥'
								label='Tổng nhân lực'
								value={String(active.nl.tong ?? '—')}
								accent='teal'
							/>
							<StatCard
								icon='✅'
								label='Đi làm'
								value={String(stats.diLam)}
								accent='green'
							/>
							<StatCard
								icon='📈'
								label='Tỷ lệ đi làm/KLCV'
								value={
									stats.tyLe !== null ? `${(stats.tyLe * 100).toFixed(1)}%` : '—'
								}
								accent='purple'
							/>
							<StatCard
								icon={stats.chenhLech !== null && stats.chenhLech < 0 ? '⬇️' : '⬆️'}
								label='Chênh lệch'
								value={
									stats.chenhLech === null
										? '—'
										: stats.chenhLech > 0
											? `+${stats.chenhLech}`
											: String(stats.chenhLech)
								}
								accent={
									stats.chenhLech === null
										? 'neutral'
										: stats.chenhLech > 0
											? 'surplus'
											: stats.chenhLech < 0
												? 'deficit'
												: 'balanced'
								}
							/>
						</div>

						<div className='detail-grid'>
							<section className='dcard'>
								<h2 className='dcard-title'>📊 Khối lượng công việc đã thực hiện</h2>
								<div className='cap-row'>
									{[
										['Mẫu BP / Tiêu bản / NB khám / tư vấn', active.daLam.sampleOrVisit],
										['X-quang hoặc siêu âm', active.daLam.xrayUs],
										['CT / Nội soi', active.daLam.ctEndoscopy],
										['MRI / Loãng xương', active.daLam.mriBoneDensity],
										['Điện tim hoặc can thiệp', active.daLam.ecgIntervention],
										['Đồ vải (Kg) / Truyền thông', active.daLam.linenMedia],
										['Xử lý dụng cụ sắt (Bộ)', active.daLam.toolMetal],
										['Xử lý dụng cụ nhựa (Cái)', active.daLam.toolPlastic],
										['Khoa giám sát (số khoa)', active.daLam.supervisedDept],
									].map(([label, val]) => (
										<div
											key={label as string}
											className='info-row'
										>
											<span className='info-lbl'>{label}</span>
											<span className='info-val'>{val ?? 0}</span>
										</div>
									))}
								</div>
							</section>

							<section className='dcard'>
								<h2 className='dcard-title'>⏳ Số lượng tồn / chờ</h2>
								<div className='cap-row'>
									{[
										['Mẫu BP / Tiêu bản / NB khám / tư vấn', active.tonCho.sampleOrVisit],
										['X-quang hoặc siêu âm', active.tonCho.xrayUs],
										['CT / Nội soi', active.tonCho.ctEndoscopy],
										['MRI / Loãng xương', active.tonCho.mriBoneDensity],
										['Điện tim hoặc Can thiệp', active.tonCho.ecgIntervention],
										['Đồ vải (Kg)', active.tonCho.linen],
										['Xử lý dụng cụ sắt (Bộ)', active.tonCho.toolMetal],
										['Xử lý dụng cụ nhựa (Cái)', active.tonCho.toolPlastic],
									].map(([label, val]) => (
										<div
											key={label as string}
											className='info-row'
										>
											<span className='info-lbl'>{label}</span>
											<span className='info-val'>{val ?? 0}</span>
										</div>
									))}
								</div>
							</section>

							<section className='dcard'>
								<h2 className='dcard-title'>👩‍⚕️ Nhân lực</h2>
								<div className='nl-grid'>
									<div className='nl-box nl-total'>
										<span className='nl-num'>{active.nl.tong ?? 0}</span>
										<span className='nl-lbl'>Tổng</span>
									</div>
									<div className='nl-box nl-diLam'>
										<span className='nl-num c-green'>{stats.diLam}</span>
										<span className='nl-lbl'>Đi làm</span>
										<span className='nl-formula'>
											= Tổng - Nghỉ trực - Nghỉ ≥2 ngày
										</span>
									</div>
									<div className='nl-box'>
										<span className='nl-num c-yellow'>
											{active.nl.nghiTruc ?? 0}
										</span>
										<span className='nl-lbl'>Nghỉ trực</span>
									</div>
									<div className='nl-box'>
										<span className='nl-num c-red'>
											{active.nl.nghiTren2Ngay ?? 0}
										</span>
										<span className='nl-lbl'>Nghỉ ≥ 2 ngày</span>
									</div>
								</div>
								<div
									className={`dp-box ${
										stats.chenhLech !== null && stats.chenhLech > 0
											? 'dp-surplus'
											: stats.chenhLech !== null && stats.chenhLech < 0
												? 'dp-deficit'
												: 'dp-balanced'
									}`}
								>
									<div>
										<p className='dp-lbl'>Chênh lệch (so với khuyến cáo)</p>
										<p className='dp-sub'>
											= Đi làm ({stats.diLam}) - Khuyến cáo ({stats.khuyenCao ?? 0})
										</p>
									</div>
									<div>
										{stats.chenhLech !== null &&
											(stats.chenhLech > 0 ? (
												<span className='tag tag-green'>
													Dư +{stats.chenhLech} người
												</span>
											) : stats.chenhLech < 0 ? (
												<span className='tag tag-red'>
													Thiếu {Math.abs(stats.chenhLech)} người
												</span>
											) : (
												<span className='tag tag-blue'>Đủ nhân lực</span>
											))}
									</div>
								</div>
							</section>

							<section className='dcard'>
								<h2 className='dcard-title'>📝 Ghi chú</h2>
								<p className='note-text'>
									{active.ghiChu || '(Không có ghi chú)'}
								</p>
							</section>
						</div>
					</>
				)}
			</div>

			{/* Các Modals */}
			{mMode && (
				<CLSStaffingForm
					mode={mMode}
					initialDraft={formInitial}
					onSave={saveRecord}
					onClose={() => setMMode(null)}
					fmtDisplay={formatDateToVN}
					saving={saving}
					error={apiError}
					recommendedStaff={recommendedStaff}
					existingDates={records.map((r) => r.date)}
				/>
			)}

			{delDate && (
				<ModalForm
					title='⚠️ Xác nhận xoá'
					onClose={() => setDelDate(null)}
				>
					<p className='confirm-txt'>
						Xoá dữ liệu ngày <strong>{formatDateToVN(delDate)}</strong>?<br />
						<span style={{ fontSize: '.8rem', color: '#64748b' }}>
							Toàn bộ dữ liệu báo cáo ngày này sẽ bị xoá vĩnh viễn.
						</span>
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setDelDate(null)}
							disabled={saving}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={confirmDel}
							disabled={saving}
						>
							{saving ? '⏳ Đang xoá...' : '🗑 Xoá'}
						</button>
					</div>
				</ModalForm>
			)}

			<ChangePasswordModal
				isOpen={showPasswordModal}
				onClose={onClosePasswordModal}
			/>

			{showReportModal && (
				<ModalForm
					title='📊 Báo cáo nhân lực'
					onClose={onCloseReportModal}
					size='full'
				>
					<ReportPage inModal />
				</ModalForm>
			)}
		</>
	);
}
