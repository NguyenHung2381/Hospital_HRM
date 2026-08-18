import Calendar from '@/components/ui/Calendar';
import CheckIcon from '@/assets/svg/CheckIcon';
import type { ApiReport, ReportMeta } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';
import SearchInput from '../components/SearchInput';

export interface MissingDept {
	id_department: number;
	department_name: string;
}

export interface DataPageSidebarProps {
	drawerOpen: boolean;
	onCloseDrawer: () => void;
	reportMetas: ReportMeta[];
	selDate: string;
	onSelectDate: (d: string) => void;
	activeTab: 'ward' | 'cls';
	allRows: KhoaRecord[];
	selKhoa: Set<number>;
	toggleKhoa: (tt: number) => void;
	selectAll: () => void;
	clearAll: () => void;
	sidebarSearch: string;
	setSidebarSearch: (v: string) => void;
	report: ApiReport | null;
	missingDepts: MissingDept[];
	missingClsDepts: MissingDept[];
}

/** Sidebar lịch + danh sách khoa (lọc) + khoa chưa nhập dữ liệu — DataPage. */
export default function DataPageSidebar({
	drawerOpen,
	onCloseDrawer,
	reportMetas,
	selDate,
	onSelectDate,
	activeTab,
	allRows,
	selKhoa,
	toggleKhoa,
	selectAll,
	clearAll,
	sidebarSearch,
	setSidebarSearch,
	report,
	missingDepts,
	missingClsDepts,
}: DataPageSidebarProps) {
	return (
		<aside className={`dv-aside${drawerOpen ? ' dv-aside-open' : ''}`}>
			<button
				className='dv-aside-close'
				onClick={onCloseDrawer}
			>
				✕
			</button>

			<div className='dv-cal-wrap'>
				<Calendar
					records={reportMetas
						.filter((d) => d.has_records)
						.map((d) => ({
							date: d.report_date.slice(0, 10),
						}))}
					activeDate={selDate}
					onSelect={(d) => onSelectDate(d)}
					onAdd={(d) => onSelectDate(d)}
				/>
			</div>

			{activeTab === 'ward' && (
				<>
					<div className='dv-khoa-panel'>
						<div className='dv-khoa-panel-hdr'>
							<span className='dv-khoa-panel-title'>
								Khoa / Phòng
								{selKhoa.size > 0 && (
									<span className='dv-khoa-badge'>{selKhoa.size}</span>
								)}
							</span>
							<div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
								<button
									className='dv-kp-btn'
									onClick={selectAll}
									title='Chọn tất cả khoa'
								>
									Tất cả
								</button>
								<button
									className='dv-kp-btn'
									onClick={clearAll}
									title='Bỏ chọn tất cả'
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
							style={{ marginTop: 12 }}
						>
							<div className='dv-khoa-panel-hdr'>
								<span
									className='dv-khoa-panel-title'
									style={{ color: '#d97706' }}
								>
									<span>⚠️</span> CHƯA NHẬP
									<span className='dv-missing-badge'>{missingDepts.length}</span>
								</span>
							</div>
							<div className='dv-khoa-list-scroll'>
								{missingDepts.map((d, idx) => (
									<div
										key={d.id_department}
										className='dv-missing-item'
									>
										<span className='dv-missing-num'>{idx + 1}</span>
										<span className='dv-missing-name'>{d.department_name}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}

			{activeTab === 'cls' && (
				<>
					{report && missingClsDepts.length > 0 && (
						<div
							className='dv-khoa-panel'
							style={{ marginTop: 12 }}
						>
							<div className='dv-khoa-panel-hdr'>
								<span
									className='dv-khoa-panel-title'
									style={{ color: '#d97706' }}
								>
									<span>⚠️</span> KHOA CLS CHƯA NHẬP
									<span className='dv-missing-badge'>
										{missingClsDepts.length}
									</span>
								</span>
							</div>
							<div className='dv-khoa-list-scroll'>
								{missingClsDepts.map((d, idx) => (
									<div
										key={d.id_department}
										className='dv-missing-item'
									>
										<span className='dv-missing-num'>{idx + 1}</span>
										<span className='dv-missing-name'>{d.department_name}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}
		</aside>
	);
}
