import ModalForm from '@/components/common/ModalForm';
import { formatDateToVN } from '@/utils/dateUtils';
import { compute } from '@/utils/staffingCalc';
import { useDailyStaffingRecords } from '@/hooks/useDailyStaffingRecords';
import { useRecordPermissions } from '@/hooks/useRecordPermissions';
import { useEffect, useState } from 'react';

// Các components đã tách
import DailyStaffingForm from './DailyStaffingForm';
import StaffingBoardSidebar from './StaffingBoardSidebar';
import {
	DailyStatsOverview,
	FormulaPreviewCard,
	PatientStatsCard,
	StaffingDetailCard,
} from './card/DailyStaffingCards';
import ChangePasswordModal from './modal/ChangePasswordModal';
import ConfirmDeleteModal from './modal/ConfirmDeleteModal';
import DeptConfigModal from './modal/DeptConfigModal';
import type { DeptConfig, KhoaItem } from '@/types/staffingType';
import ReportPage from '@/modules/admin/pages/ReportPage';

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

	const {
		records,
		activeDate,
		setActiveDate,
		loadingRecords,
		saving,
		apiError,
		mMode,
		setMMode,
		formInitial,
		delDate,
		setDelDate,
		openAdd,
		openEdit,
		saveRecord,
		confirmDel,
	} = useDailyStaffingRecords(activeKhoaId);

	const active = records.find((r) => r.date === activeDate) ?? null;
	const computed = active ? compute(active, dept) : null;

	const {
		hasEditPerm,
		hasDeletePerm,
		canAddForDate,
		lockedActive,
		canEdit,
		canDelete,
		lockReason,
	} = useRecordPermissions(activeKhoaId, activeDate);

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
			<StaffingBoardSidebar
				khoaList={userKhoa}
				activeId={activeKhoaId}
				onKhoaChange={handleKhoaChange}
				records={records}
				activeDate={activeDate}
				onSelectDate={setActiveDate}
				canAddForDate={canAddForDate}
				onAdd={openAdd}
				showAddButton={hasEditPerm}
			/>

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
										onClick={canEdit ? () => openEdit(active) : undefined}
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
				<ConfirmDeleteModal
					date={delDate}
					fmtDisplay={formatDateToVN}
					saving={saving}
					onClose={() => setDelDate(null)}
					onConfirm={confirmDel}
				/>
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
