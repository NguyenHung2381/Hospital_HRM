import { useAuth } from '@/context/useAuth';
import { useDeptFilter } from '@/hooks/useDeptFilter';
import { useDeptPermissions } from '@/hooks/UseDeptPermissionsReturn';
import usePagination from '@/hooks/usePagination';
import { useReportData } from '@/hooks/useReportData';
import { useDualScrollSync } from '@/hooks/useDualScrollSync';
import { useDataPageDeletions } from '@/hooks/useDataPageDeletions';
import type { ApiClsRecord, ApiRecord } from '@/types/apiType';
import { formatDateToVN, getTodayDateString } from '@/utils/dateUtils';
import { aggregateDashboardStats, toKhoaRecord } from '@/utils/staffingCalc';
import {
	aggregateClsDashboardStats,
	toKhoaClsRecord,
} from '@/utils/clsCalc';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import WardTabActions from './WardTabActions';
import ClsTabActions from './ClsTabActions';
import ClsTabPanel from './ClsTabPanel';
import DataPageModals from './DataPageModals';
import DataPageSidebar from './DataPageSidebar';
import WardTabPanel from './WardTabPanel';

export default function DataPage() {
	const today = getTodayDateString();
	const { deptPermissions, user } = useAuth();

	// ── State điều hướng ─────────────────────────────────────────────────
	const [selDate, setSelDate] = useState(today);
	const [activeTab, setActiveTab] = useState<'ward' | 'cls'>('ward');
	const [drawerOpen, setDrawer] = useState(false);
	const [allDepts, setAllDepts] = useState<
		{ id_department: number; department_name: string }[]
	>([]);
	const [allClsDepts, setAllClsDepts] = useState<
		{ id_department: number; department_name: string }[]
	>([]);

	// ── Fetch danh sách tất cả khoa active (1 lần khi mount) ─────────────
	useEffect(() => {
		fetch('/api/departments/simple?group=ward')
			.then((r) => r.json())
			.then((d) => {
				if (d.success && Array.isArray(d.data)) setAllDepts(d.data);
			})
			.catch(() => {});
		fetch('/api/departments/simple?group=cls')
			.then((r) => r.json())
			.then((d) => {
				if (d.success && Array.isArray(d.data)) setAllClsDepts(d.data);
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
	const [showAddRecord, setShowAddRecord] = useState(false);
	const [showCreate, setShowCreate] = useState(false);

	// ── Modal state — hệ CLS ─────────────────────────────────────────────
	const [editClsRecord, setEditClsRecord] = useState<ApiClsRecord | null>(
		null,
	);
	const [showAddClsRecord, setShowAddClsRecord] = useState(false);

	const {
		saving,
		showDelConfirm,
		setShowDelConfirm,
		delRecord,
		setDelRecord,
		delClsRecord,
		setDelClsRecord,
		delReport,
		confirmDelRecord,
		confirmDelClsRecord,
	} = useDataPageDeletions({ report, setReport, setReportMetas, setApiError, selDate });

	const clsRows = useMemo(
		() => (report?.cls_records ?? []).map((r, i) => toKhoaClsRecord(r, i + 1)),
		[report],
	);
	const clsStats = aggregateClsDashboardStats(clsRows);
	const enteredClsDeptIds = useMemo(
		() => new Set(report?.cls_records.map((r) => r.id_department) ?? []),
		[report],
	);
	const missingClsDepts = useMemo(
		() => allClsDepts.filter((d) => !enteredClsDeptIds.has(d.id_department)),
		[allClsDepts, enteredClsDeptIds],
	);

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
	const wardScroll = useDualScrollSync(report);
	const clsScroll = useDualScrollSync(report);

	// ────────────────────────────────────────────────────────────────────
	return (
		<div className='pg dv-pg'>
			<DataPageSidebar
				drawerOpen={drawerOpen}
				onCloseDrawer={() => setDrawer(false)}
				reportMetas={reportMetas}
				selDate={selDate}
				onSelectDate={setSelDate}
				activeTab={activeTab}
				allRows={allRows}
				selKhoa={selKhoa}
				toggleKhoa={toggleKhoa}
				selectAll={selectAll}
				clearAll={clearAll}
				sidebarSearch={sidebarSearch}
				setSidebarSearch={setSidebarSearch}
				report={report}
				missingDepts={missingDepts}
				missingClsDepts={missingClsDepts}
			/>

			{/* ── Mobile Filter Drawer Overlay ── */}
			{drawerOpen && (
				<div
					className='dv-overlay'
					onClick={() => setDrawer(false)}
				/>
			)}

			{/* ── Main ── */}
			<div className='dv-main'>
				<div className='dv-hero-card'>
					<PageHeader
						icon={
							<span
								className={`pg-hdr-icon${activeTab === 'cls' ? ' pg-hdr-icon--cls' : ''}`}
							>
								{activeTab === 'ward' ? '🏥' : '🧪'}
							</span>
						}
						title={activeTab === 'ward' ? 'Khoa nội trú' : 'Hệ Cận lâm sàng'}
						subtitle={
							<>
								<span className='dv-hero-sub-label'>
									{activeTab === 'ward'
										? 'NHÂN LỰC ĐD - HỘ SINH - KTV'
										: 'DỮ LIỆU HỆ CẬN LÂM SÀNG'}
								</span>
								<span className='dv-progress-pill'>
									<span className='dv-progress-track'>
										<span
											className='dv-progress-fill'
											style={{
												width: `${Math.min(
													100,
													Math.round(
														(activeTab === 'ward'
															? allRows.length / (allDepts.length || 37)
															: clsRows.length / (allClsDepts.length || 10)) * 100,
													),
												)}%`,
											}}
										/>
									</span>
									{activeTab === 'ward'
										? `${allRows.length} / ${allDepts.length || 37} khoa đã nhập`
										: `${clsRows.length} / ${allClsDepts.length || 10} khoa đã nhập`}
								</span>
								<span className='dv-date-badge'>
									📅 Ngày xem: {formatDateToVN(selDate)}
								</span>
							</>
						}
					>
						{activeTab === 'ward' ? (
							<WardTabActions
								report={report}
								loadingReport={loadingReport}
								selKhoa={selKhoa}
								allRows={allRows}
								canDeleteReport={canDeleteReport}
								onToggleDrawer={() => setDrawer((o) => !o)}
								onOpenAddRecord={() => setShowAddRecord(true)}
								onClearFilter={() => setSelKhoa(new Set(allRows.map((k) => k.tt)))}
								onOpenDeleteReport={() => {
									setApiError('');
									setShowDelConfirm(true);
								}}
								onOpenCreateReport={() => setShowCreate(true)}
							/>
						) : (
							<ClsTabActions
								report={report}
								loadingReport={loadingReport}
								canDeleteReport={canDeleteReport}
								onOpenAddClsRecord={() => setShowAddClsRecord(true)}
								onOpenDeleteReport={() => {
									setApiError('');
									setShowDelConfirm(true);
								}}
								onOpenCreateReport={() => setShowCreate(true)}
							/>
						)}
					</PageHeader>

					<div className='dv-hero-divider' />

					<div className='tab-bar-wrap'>
						<div className='tab-bar'>
							<button
								className={`tab-btn${activeTab === 'ward' ? ' tab-btn--active' : ''}`}
								onClick={() => setActiveTab('ward')}
							>
								🏥 Khoa nội trú
							</button>
							<button
								className={`tab-btn${activeTab === 'cls' ? ' tab-btn--active' : ''}`}
								onClick={() => setActiveTab('cls')}
							>
								🧪 Hệ Cận lâm sàng
							</button>
						</div>
					</div>
				</div>

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

				{activeTab === 'ward' && (
					<WardTabPanel
						selDate={selDate}
						report={report}
						loadingReport={loadingReport}
						missingDepts={missingDepts}
						onOpenCreateReport={() => setShowCreate(true)}
						stats={stats}
						filtered={filtered}
						pageRows={pageRows}
						getPermForDept={getPermForDept}
						onEdit={setEditRecord}
						onDelete={setDelRecord}
						scrollTopRef={wardScroll.scrollTopRef}
						tblOuterRef={wardScroll.tblOuterRef}
						scrollThumb={wardScroll.thumb}
						onThumbPointerDown={wardScroll.onThumbPointerDown}
						onThumbPointerMove={wardScroll.onThumbPointerMove}
						onThumbPointerUp={wardScroll.onThumbPointerUp}
						onTrackPointerDown={wardScroll.onTrackPointerDown}
						onTableWheel={wardScroll.onWheel}
						page={page}
						setPage={setPage}
						pageSize={pageSize}
						setPageSize={setPageSize}
						totalPages={totalPages}
					/>
				)}

				{activeTab === 'cls' && (
					<ClsTabPanel
						selDate={selDate}
						report={report}
						loadingReport={loadingReport}
						onOpenCreateReport={() => setShowCreate(true)}
						clsRows={clsRows}
						clsStats={clsStats}
						getPermForDept={getPermForDept}
						onEdit={setEditClsRecord}
						onDelete={setDelClsRecord}
						scrollTopRef={clsScroll.scrollTopRef}
						tblOuterRef={clsScroll.tblOuterRef}
						scrollThumb={clsScroll.thumb}
						onThumbPointerDown={clsScroll.onThumbPointerDown}
						onThumbPointerMove={clsScroll.onThumbPointerMove}
						onThumbPointerUp={clsScroll.onThumbPointerUp}
						onTrackPointerDown={clsScroll.onTrackPointerDown}
						onTableWheel={clsScroll.onWheel}
					/>
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
			<DataPageModals
				report={report}
				setReport={setReport}
				setReportMetas={setReportMetas}
				selDate={selDate}
				userId={user?.id}
				apiError={apiError}
				saving={saving}
				editRecord={editRecord}
				setEditRecord={setEditRecord}
				editClsRecord={editClsRecord}
				setEditClsRecord={setEditClsRecord}
				showCreate={showCreate}
				setShowCreate={setShowCreate}
				showAddRecord={showAddRecord}
				setShowAddRecord={setShowAddRecord}
				showAddClsRecord={showAddClsRecord}
				setShowAddClsRecord={setShowAddClsRecord}
				grantLocalPerm={grantLocalPerm}
				showDelConfirm={showDelConfirm}
				setShowDelConfirm={setShowDelConfirm}
				delReport={delReport}
				delRecord={delRecord}
				setDelRecord={setDelRecord}
				confirmDelRecord={confirmDelRecord}
				delClsRecord={delClsRecord}
				setDelClsRecord={setDelClsRecord}
				confirmDelClsRecord={confirmDelClsRecord}
			/>
		</div>
	);
}
