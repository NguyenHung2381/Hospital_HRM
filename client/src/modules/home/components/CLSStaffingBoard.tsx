import { ChartColumn, ClipboardList, Hourglass, LoaderCircle, Lock, NotebookPen, Pencil, Percent, Plus, Trash2, TrendingDown, TrendingUp, UserCheck, Users } from 'lucide-react';
import ModalForm from '@/components/common/ModalForm';
import StatCard from '@/components/ui/StatCard';
import type { KhoaItem } from '@/types/staffingType';
import { computeCls } from '@/utils/clsCalc';
import { getClsFields } from '@/utils/clsFieldConfig';
import { formatDateToVN } from '@/utils/dateUtils';
import { useClsStaffingRecords } from '@/hooks/useClsStaffingRecords';
import { useRecordPermissions } from '@/hooks/useRecordPermissions';
import { useState } from 'react';
import CLSStaffingForm from './CLSStaffingForm';
import StaffingBoardSidebar from './StaffingBoardSidebar';
import ChangePasswordModal from './modal/ChangePasswordModal';
import ConfirmDeleteModal from './modal/ConfirmDeleteModal';
import ReportPage from '@/modules/admin/pages/ReportPage';

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
	const [activeKhoaId, setActiveKhoaId] = useState<number>(
		userKhoa.length > 0 ? userKhoa[0].id : 0,
	);
	const [recommendedStaff, setRecommendedStaff] = useState<number | null>(
		userKhoa.length > 0 ? (userKhoa[0].heSoRec?.fixedAdd ?? null) : null,
	);

	const {
		records,
		activeDate,
		setActiveDate,
		loadingRecords,
		loadMonth,
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
	} = useClsStaffingRecords(activeKhoaId, setRecommendedStaff);

	const active = records.find((r) => r.date === activeDate) ?? null;
	const stats = active ? computeCls(active, recommendedStaff) : null;
	const activeKhoa = userKhoa.find((k) => k.id === activeKhoaId) ?? null;
	const clsFields = getClsFields(activeKhoa?.code);

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
		setRecommendedStaff(k.heSoRec?.fixedAdd ?? null);
		onDeptNameChange(k.ten);
	};

	return (
		<>
			<StaffingBoardSidebar
				khoaList={userKhoa}
				activeId={activeKhoaId}
				onKhoaChange={handleKhoaChange}
				onMonthChange={loadMonth}
				records={records}
				activeDate={activeDate}
				onSelectDate={setActiveDate}
				canAddForDate={canAddForDate}
				onAdd={openAdd}
				showAddButton={hasEditPerm}
			/>

			<div className='content'>
				{apiError && <div className='api-error-banner'>{apiError}</div>}
				{lockedActive && (
					<div className='lock-banner'>
						<Lock className='lock-banner-icon' size={16} />
						<span>{lockReason}</span>
					</div>
				)}

				{loadingRecords ? (
					<div className='empty'>
						<LoaderCircle className='empty-icon spin' size={36} strokeWidth={1.5} />
						<p className='empty-title'>Đang tải dữ liệu...</p>
					</div>
				) : !active || !stats ? (
					<div className='empty'>
						<ClipboardList className='empty-icon' size={40} strokeWidth={1.5} />
						<p className='empty-title'>Chưa có dữ liệu cho ngày này</p>
						<p className='empty-sub'>{formatDateToVN(activeDate)}</p>
						{canAddForDate(activeDate) && (
							<button
								className='btn-primary'
								onClick={() => openAdd(activeDate)}
							>
								<Plus size={15} /> Thêm bản ghi
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
										<Pencil size={13} /> Sửa{' '}
										{lockedActive && <Lock className='btn-lock-ico' size={12} />}
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
										<Trash2 size={13} /> Xoá{' '}
										{lockedActive && <Lock className='btn-lock-ico' size={12} />}
									</button>
								)}
							</div>
						</div>

						<div className='stats-row'>
							<StatCard
								icon={<ChartColumn size={20} />}
								label='Tổng khối lượng CV'
								value={String(stats.tongKhoiLuong)}
								accent='nb'
							/>
							<StatCard
								icon={<Users size={20} />}
								label='Tổng nhân lực'
								value={String(active.nl.tong ?? '—')}
								accent='nl'
							/>
							<StatCard
								icon={<UserCheck size={20} />}
								label='Đi làm'
								value={String(stats.diLam)}
								accent='nl'
							/>
							<StatCard
								icon={<Percent size={20} />}
								label='Tỷ lệ đi làm/KLCV'
								value={
									stats.tyLe !== null ? `${(stats.tyLe * 100).toFixed(1)}%` : '—'
								}
								accent='kc'
							/>
							<StatCard
								icon={
									stats.chenhLech !== null && stats.chenhLech < 0 ? (
										<TrendingDown size={20} />
									) : (
										<TrendingUp size={20} />
									)
								}
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
							<section className='dcard dcard--nb'>
								<h2 className='dcard-title'>
									<ChartColumn size={15} /> Khối lượng công việc đã thực hiện</h2>
								<div className='cap-row'>
									{clsFields.map((f) => (
										<div
											key={f.id}
											className='info-row'
										>
											<span className='info-lbl'>{f.label}</span>
											<span className='info-val'>{active.daLam[f.daLamKey] ?? 0}</span>
										</div>
									))}
								</div>
							</section>

							<section className='dcard dcard--nb'>
								<h2 className='dcard-title'>
									<Hourglass size={15} /> Số lượng tồn / chờ
								</h2>
								<div className='cap-row'>
									{clsFields
										.filter((f) => f.tonChoKey !== null)
										.map((f) => (
											<div
												key={f.id}
												className='info-row'
											>
												<span className='info-lbl'>{f.label}</span>
												<span className='info-val'>
													{active.tonCho[f.tonChoKey as keyof typeof active.tonCho] ?? 0}
												</span>
											</div>
										))}
								</div>
							</section>

							<section className='dcard dcard--nl'>
								<h2 className='dcard-title'>
									<Users size={15} /> Nhân lực
								</h2>
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
								<h2 className='dcard-title'>
									<NotebookPen size={15} /> Ghi chú
								</h2>
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
					deptCode={activeKhoa?.code}
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

			{showReportModal && (
				<ModalForm
					title='Báo cáo nhân lực'
					onClose={onCloseReportModal}
					size='full'
				>
					<ReportPage inModal />
				</ModalForm>
			)}
		</>
	);
}
