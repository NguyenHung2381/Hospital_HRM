import Calendar from '@/components/ui/Calendar';
import type { KhoaItem } from '@/types/staffingType';
import { getTodayDateString } from '@/utils/dateUtils';
import DeptSelector from './DeptSelector';

export interface StaffingBoardSidebarProps {
	khoaList: KhoaItem[];
	activeId: number;
	onKhoaChange: (k: KhoaItem) => void;
	records: { date: string }[];
	activeDate: string;
	onSelectDate: (d: string) => void;
	canAddForDate: (date: string) => boolean;
	onAdd: (date?: string) => void;
	showAddButton: boolean;
}

/** Sidebar dùng chung giữa DailyStaffingBoard và CLSStaffingBoard: chọn khoa + lịch + nút thêm ngày. */
export default function StaffingBoardSidebar({
	khoaList,
	activeId,
	onKhoaChange,
	records,
	activeDate,
	onSelectDate,
	canAddForDate,
	onAdd,
	showAddButton,
}: StaffingBoardSidebarProps) {
	return (
		<aside className='sidebar'>
			<DeptSelector
				khoaList={khoaList}
				activeId={activeId}
				onChange={onKhoaChange}
			/>
			<Calendar
				records={records}
				activeDate={activeDate}
				onSelect={onSelectDate}
				onAdd={(date) => {
					if (canAddForDate(date ?? getTodayDateString())) onAdd(date);
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
			{showAddButton && (
				<button
					className='btn-add-full'
					onClick={() => onAdd()}
				>
					＋ Thêm ngày mới
				</button>
			)}
		</aside>
	);
}
