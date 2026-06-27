import ModalForm from '@/components/common/ModalForm';
import Calendar from '@/components/ui/Calendar';
import { useAuth } from '@/context/useAuth';
import type { ApiDeptRecord } from '@/types/apiType';
import {
	formatDateToVN,
	getNextAvailableDate,
	getTodayDateString,
} from '@/utils/dateUtils';
import { compute, isReportLocked } from '@/utils/staffingCalc';
import { useAppSSE } from '@/hooks/useAppSSE';
import { useCallback, useEffect, useState } from 'react';

// Các components đã tách
import DailyStaffingForm from './DailyStaffingForm';
import DeptSelector from './DeptSelector';
import {
	DailyStatsOverview,
	FormulaPreviewCard,
	PatientStatsCard,
	StaffingDetailCard,
} from './card/DailyStaffingCards';
import ChangePasswordModal from './modal/ChangePasswordModal';
import DeptConfigModal from './modal/DeptConfigModal';
import type { DailyRecord, DeptConfig, KhoaItem } from '@/types/staffingType';
import { apiToDailyRecord, dailyToApiBody } from '@/utils/recordHelperUtils';
import { createEmptyRecord } from '../utils/recordHelpers';
import ReportPage from '../pages/ReportPage';

export interface DailyStaffingBoardProps {
	userKhoa: KhoaItem[];
	onDeptNameChange: (name: string) => void;
	onGiuongMayChange: (v: number | null) => void;
	showDeptModal: boolean;
	onCloseDeptModal: () => void;
	showReportModal: boolean;
	onCloseReportModal: () => void;
	showPasswordModal: boolean;
	onClosePasswordModal: () => void;
}

export default function DailyStaffingBoard({
	userKhoa,
	onDeptNameChange,
	onGiuongMayChange,
	showDeptModal,
	onCloseDeptModal,
	showReportModal,
	onCloseReportModal,
	showPasswordModal,
	onClosePasswordModal,
}: DailyStaffingBoardProps) {
	const { user, deptPermissions } = useAuth();
	const [activeKhoaId, setActiveKhoaId] = useState<number>(
		userKhoa.length > 0 ? userKhoa[0].id : 0,
	);

	const [dept, setDept] = useState<DeptConfig>({
		ten: userKhoa.length > 0 ? userKhoa[0].ten : '',
		giuongMay: userKhoa.length > 0 ? userKhoa[0].giuong : null,
		formulaType: userKhoa.length > 0 ? userKhoa[0].formulaType : 'custom_coef',
		tt03Note: userKhoa.length > 0 ? (userKhoa[0].tt03Note ?? '') : '',
		heSo:
			userKhoa.length > 0
				? userKhoa[0].heSo
				: {
						cap1: 0.5,
						cap2: 0.104,
						cap3: 0.104,
						tong: 0.12,
						patientRatio: 0.6,
						shiftDivisor: 3,
						shiftMultiplier: 2,
						fixedAdd: 0,
					},
		recFormulaType:
			userKhoa.length > 0 ? (userKhoa[0].recFormulaType ?? null) : null,
		heSoRec: userKhoa.length > 0 ? (userKhoa[0].heSoRec ?? null) : null,
	});

	const [records, setRecords] = useState<DailyRecord[]>([]);
	const [recordIds, setRecordIds] = useState<
		Record<string, { id_report: number; record_id: number }>
	>({});
	const [activeDate, setActiveDate] = useState(getTodayDateString());
	const [loadingRecords, setLoadingRecords] = useState(false);
	const [saving, setSaving] = useState(false);
	const [apiError, setApiError] = useState('');

	const [, setClockTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setClockTick((t) => t + 1), 60_000);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		if (userKhoa.length > 0 && activeKhoaId === 0) {
			setActiveKhoaId(userKhoa[0].id);
			setDept({
				ten: userKhoa[0].ten,
				giuongMay: userKhoa[0].giuong,
				heSo: userKhoa[0].heSo,
				formulaType: userKhoa[0].formulaType,
				tt03Note: userKhoa[0].tt03Note ?? '',
				recFormulaType: userKhoa[0].recFormulaType ?? null,
				heSoRec: userKhoa[0].heSoRec ?? null,
			});
			onDeptNameChange(userKhoa[0].ten);
			onGiuongMayChange(userKhoa[0].giuong);
		}
	}, [userKhoa, activeKhoaId, onDeptNameChange, onGiuongMayChange]);

	type MMode = 'add' | 'edit' | null;
	const [mMode, setMMode] = useState<MMode>(null);
	const [formInitial, setFormInitial] = useState<DailyRecord>(
		createEmptyRecord(getTodayDateString()),
	);
	const [delDate, setDelDate] = useState<string | null>(null);

	const active = records.find((r) => r.date === activeDate) ?? null;
	const computed = active ? compute(active, dept) : null;

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
								records: ApiDeptRecord[];
							};
						}>,
				),
			);
			const details = await Promise.all(detailPromises);

			const newRecords: DailyRecord[] = [];
			const newIds: Record<string, { id_report: number; record_id: number }> =
				{};

			for (const detail of details) {
				if (!detail.success) continue;
				const { id_report, report_date, records: recs } = detail.data;
				const deptRec = recs.find((r) => r.id_department === activeKhoaId);
				if (!deptRec) continue;
				const dateKey = report_date.slice(0, 10);
				newRecords.push(apiToDailyRecord(dateKey, deptRec));
				newIds[dateKey] = { id_report, record_id: deptRec.id };
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
			createEmptyRecord(
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

	const saveRecord = async (draft: DailyRecord) => {
		setSaving(true);
		setApiError('');
		try {
			const ids = recordIds[draft.date];
			if (ids) {
				const res = await fetch(
					`/api/reports/${ids.id_report}/records/${ids.record_id}`,
					{
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(dailyToApiBody(draft)),
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
						`/api/reports/${existingReport.id_report}/records`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id_department: activeKhoaId,
								sort_order: 1,
								...dailyToApiBody(draft),
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
							records: [
								{
									id_department: activeKhoaId,
									sort_order: 1,
									...dailyToApiBody(draft),
								},
							],
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
			if (ids) {
				const res = await fetch(`/api/reports/${ids.id_report}`, {
					method: 'DELETE',
				});
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
		setDept({
			...dept,
			ten: k.ten,
			giuongMay: k.giuong,
			heSo: k.heSo,
			formulaType: k.formulaType,
			tt03Note: k.tt03Note ?? '',
			recFormulaType: k.recFormulaType ?? null,
			heSoRec: k.heSoRec ?? null,
		});
		onDeptNameChange(k.ten);
		onGiuongMayChange(k.giuong);
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
				) : !active ? (
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

						{/* Dùng các Component hiển thị đã tách */}
						<DailyStatsOverview
							active={active}
							computed={computed}
						/>

						<div className='detail-grid'>
							<PatientStatsCard
								active={active}
								computed={computed}
							/>
							<StaffingDetailCard
								active={active}
								computed={computed}
							/>
							<FormulaPreviewCard
								active={active}
								dept={dept}
								computed={computed}
							/>

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
				<DailyStaffingForm
					mode={mMode}
					initialDraft={formInitial}
					onSave={saveRecord}
					onClose={() => setMMode(null)}
					fmtDisplay={formatDateToVN}
					saving={saving}
					error={apiError}
					deptId={activeKhoaId}
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

			<DeptConfigModal
				isOpen={showDeptModal}
				onClose={onCloseDeptModal}
				activeKhoaId={activeKhoaId}
				initialDept={dept}
				onSaveSuccess={(updatedDept) => {
					setDept(updatedDept);
					onDeptNameChange(updatedDept.ten);
					onGiuongMayChange(updatedDept.giuongMay);
					onCloseDeptModal();
				}}
			/>

			{/* Modal Báo cáo — nhúng ReportPage vào overlay full-screen */}
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
