import { useAuth } from '@/context/useAuth';
import { useAppSSE } from '@/hooks/useAppSSE';
import { useReportData } from '@/hooks/useReportData';
import type { ApiCoordination } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';
import { formatDateToVN, getTodayDateString } from '@/utils/dateUtils';
import { toKhoaRecord } from '@/utils/staffingCalc';
import { useCallback, useEffect, useState } from 'react';
import CreateCoordinationModal from '../components/modal/CreateCoordinationModal';
import PageHeader from '../components/PageHeader';
import CoordinationHistoryTable from './CoordinationHistoryTable';
import ShortageBoard, { type SortField } from './ShortageBoard';

/**
 * Trang điều phối nhân lực giữa các khoa.
 * Chỉ là lớp ghi nhận/theo dõi độc lập — KHÔNG đụng vào staff_working
 * hay bất kỳ số liệu báo cáo TT03 gốc nào (xem staffingCalc.ts).
 * Ai cũng xem được (cùng quyền dashboard), nhưng chỉ Admin mới được
 * tạo/xoá điều phối.
 */
export default function CoordinationPage() {
	const { user } = useAuth();
	const isAdmin = user?.vaiTro === 'admin';

	const [selDate, setSelDate] = useState(getTodayDateString());
	const { report, loadingReport } = useReportData(selDate);

	const [history, setHistory] = useState<ApiCoordination[]>([]);
	const [loadingHistory, setLoadingHistory] = useState(true);
	// null = đóng modal; { fromId, toId } = mở modal (toId/fromId có thể null
	// nếu mở bằng nút "+ Tạo điều phối" hoặc chưa xác định vai trò khoa,
	// hoặc điền sẵn nếu bấm nút trên bảng / kéo-thả)
	const [modalPrefill, setModalPrefill] = useState<{
		fromId: number | null;
		toId: number | null;
	} | null>(null);
	// Khoa "thiếu" đang được kéo-thả rê qua, dùng để highlight
	const [dragOverId, setDragOverId] = useState<number | null>(null);

	const [sortField, setSortField] = useState<SortField>('dieuPhoi');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

	const toggleSort = (field: SortField) => {
		if (field === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setSortField(field);
			setSortDir('asc');
		}
	};

	const fetchHistory = useCallback(async () => {
		setLoadingHistory(true);
		try {
			const res = await fetch(`/api/coordination?date=${selDate}`);
			const data = (await res.json()) as {
				success: boolean;
				data: ApiCoordination[];
			};
			if (data.success) setHistory(data.data);
		} catch {
			/* bỏ qua */
		} finally {
			setLoadingHistory(false);
		}
	}, [selDate]);

	useEffect(() => {
		fetchHistory();
	}, [fetchHistory]);

	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'coordination') fetchHistory();
			},
			[fetchHistory],
		),
	);

	const handleDelete = async (id: number) => {
		if (!confirm('Xoá bản ghi điều phối này?')) return;
		try {
			const res = await fetch(`/api/coordination/${id}`, { method: 'DELETE' });
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				alert(data.message ?? 'Lỗi khi xoá');
				return;
			}
			fetchHistory();
		} catch {
			alert('Lỗi kết nối server.');
		}
	};

	const openCoordinate = (r: KhoaRecord) => {
		const dp = r.dieuPhoi ?? 0;
		if (dp > 0) setModalPrefill({ fromId: r.id_department, toId: null });
		else if (dp < 0) setModalPrefill({ fromId: null, toId: r.id_department });
		else setModalPrefill({ fromId: null, toId: null });
	};

	const rawRows = report?.records.map((r, i) => toKhoaRecord(r, i + 1)) ?? [];

	// dieuPhoi tính từ báo cáo gốc KHÔNG tự trừ/cộng theo điều phối đã ghi
	// nhận (đúng như đã chốt — không đụng số liệu báo cáo). Nhưng để trang
	// này phản ánh đúng thực tế "còn dư/còn thiếu bao nhiêu", cộng bù thêm
	// phần đã điều chuyển trong ngày (chỉ tính toán hiển thị phía client,
	// không ghi lại vào report).
	const netAdjust = new Map<number, number>();
	for (const h of history) {
		netAdjust.set(
			h.id_department_from,
			(netAdjust.get(h.id_department_from) ?? 0) - h.staff_count,
		);
		netAdjust.set(
			h.id_department_to,
			(netAdjust.get(h.id_department_to) ?? 0) + h.staff_count,
		);
	}
	const rows = rawRows.map((r) => {
		const adjust = netAdjust.get(r.id_department) ?? 0;
		return adjust === 0 ? r : { ...r, dieuPhoi: (r.dieuPhoi ?? 0) + adjust };
	});

	const sortedRows = [...rows].sort((a, b) => {
		let cmp: number;
		if (sortField === 'ten') cmp = a.ten.localeCompare(b.ten);
		else cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0);
		return sortDir === 'asc' ? cmp : -cmp;
	});

	return (
		<div className='pg'>
			<PageHeader
				title='Điều phối nhân lực'
				subtitle='Ghi nhận điều chuyển nhân lực từ khoa dư sang khoa thiếu — không ảnh hưởng số liệu báo cáo TT03 gốc'
			>
				<div className='ov-date-select-wrap'>
					<label
						className='ov-date-select-lbl'
						htmlFor='coord-date-sel'
					>
						📅 Ngày
					</label>
					<input
						id='coord-date-sel'
						type='date'
						className='ov-date-select'
						value={selDate}
						onChange={(e) => setSelDate(e.target.value)}
					/>
				</div>
				{isAdmin && (
					<button
						className='btn-primary'
						onClick={() => setModalPrefill({ fromId: null, toId: null })}
						disabled={!report}
					>
						＋ Tạo điều phối
					</button>
				)}
			</PageHeader>

			{loadingReport ? (
				<div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
					Đang tải dữ liệu...
				</div>
			) : !report ? (
				<div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
					Chưa có báo cáo ngày {formatDateToVN(selDate)}. Vui lòng nhập số liệu
					ngày này trước khi điều phối.
				</div>
			) : (
				<>
					<ShortageBoard
						sortedRows={sortedRows}
						rawRows={rawRows}
						netAdjust={netAdjust}
						isAdmin={isAdmin}
						sortField={sortField}
						sortDir={sortDir}
						toggleSort={toggleSort}
						dragOverId={dragOverId}
						setDragOverId={setDragOverId}
						onCoordinate={openCoordinate}
						onDrop={(fromId, toId) => setModalPrefill({ fromId, toId })}
					/>

					<CoordinationHistoryTable
						selDate={selDate}
						history={history}
						loadingHistory={loadingHistory}
						isAdmin={isAdmin}
						onDelete={handleDelete}
					/>
				</>
			)}

			{modalPrefill && report && (
				<CreateCoordinationModal
					reportDate={selDate}
					rows={rows}
					userId={user?.id}
					initialFromId={modalPrefill.fromId}
					initialToId={modalPrefill.toId}
					onCreated={() => fetchHistory()}
					onClose={() => setModalPrefill(null)}
				/>
			)}
		</div>
	);
}
