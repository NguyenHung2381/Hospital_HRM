import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppSSE } from '@/hooks/useAppSSE';
import { getMonthRange } from '@/utils/dateUtils';

type RecordIds = Record<string, { id_report: number; record_id: number }>;
type MonthRange = ReturnType<typeof getMonthRange>;

/** Tháng lệch `offset` so với tháng hiện tại (0 = tháng này, -1 = tháng trước). */
const monthFromNow = (offset: number): MonthRange => {
	const d = new Date();
	d.setDate(1);
	d.setMonth(d.getMonth() + offset);
	return getMonthRange(d.getFullYear(), d.getMonth());
};

interface ApiRowBase {
	id: number;
	id_report: number;
	report_date: string;
}

/**
 * Tải bản ghi của 1 khoa theo từng tháng lịch đang xem
 * (GET /api/reports/department/:id[/cls]?from=&to= — 1 truy vấn/tháng).
 *
 *  - Đổi khoa: tải tháng hiện tại + tháng trước (tương đương 30 ngày cũ)
 *  - Chuyển tháng trên lịch (loadMonth): tải tháng đó nếu chưa có trong cache
 *  - SSE 'reports': tải lại tháng đang xem + tháng hiện tại; các tháng khác
 *    đánh dấu cũ, tải lại khi mở tới
 *
 * `records` là hợp của các tháng đã tải, sắp xếp theo ngày tăng dần.
 */
export function useDeptMonthRecords<TApi extends ApiRowBase, TRec extends { date: string }>(
	activeKhoaId: number,
	kind: 'ward' | 'cls',
	toRecord: (date: string, row: TApi) => TRec,
	onInitialLoaded?: (records: TRec[], rows: TApi[]) => void,
) {
	const [records, setRecords] = useState<TRec[]>([]);
	const [recordIds, setRecordIds] = useState<RecordIds>({});
	const [loadingRecords, setLoadingRecords] = useState(false);

	const loadedMonths = useRef(new Set<string>());
	const viewMonth = useRef<MonthRange | null>(null);
	// 1 controller cho mỗi khoa: chỉ huỷ khi đổi khoa (dữ liệu tháng của
	// cùng khoa không bao giờ "lỗi thời" nên không cần huỷ lẫn nhau)
	const abortRef = useRef<AbortController | null>(null);
	// Giữ callback mới nhất mà không làm đổi identity của fetch
	const toRecordRef = useRef(toRecord);
	const onInitialRef = useRef(onInitialLoaded);
	toRecordRef.current = toRecord;
	onInitialRef.current = onInitialLoaded;

	const fetchMonths = useCallback(
		async (ranges: MonthRange[], signal: AbortSignal) => {
			const suffix = kind === 'cls' ? '/cls' : '';
			const results = await Promise.all(
				ranges.map((r) =>
					fetch(
						`/api/reports/department/${activeKhoaId}${suffix}?from=${r.from}&to=${r.to}`,
						{ signal },
					).then((res) => res.json() as Promise<{ success: boolean; data: TApi[] }>),
				),
			);
			if (signal.aborted) return null;

			const okRanges = ranges.filter((_, i) => results[i].success);
			const rows = results.flatMap((r) => (r.success ? r.data : []));
			const inRanges = (date: string) => okRanges.some((r) => date.startsWith(r.key));
			const newRecs = rows.map((row) => toRecordRef.current(row.report_date, row));

			okRanges.forEach((r) => loadedMonths.current.add(r.key));
			setRecords((prev) =>
				[...prev.filter((x) => !inRanges(x.date)), ...newRecs].sort((a, b) =>
					a.date.localeCompare(b.date),
				),
			);
			setRecordIds((prev) => {
				const next: RecordIds = {};
				for (const [d, v] of Object.entries(prev)) if (!inRanges(d)) next[d] = v;
				for (const row of rows)
					next[row.report_date] = { id_report: row.id_report, record_id: row.id };
				return next;
			});
			return { newRecs, rows };
		},
		[activeKhoaId, kind],
	);

	const run = useCallback(
		async (ranges: MonthRange[], initial = false) => {
			const ctrl = abortRef.current;
			if (!activeKhoaId || !ranges.length || !ctrl) return;
			if (initial) setLoadingRecords(true);
			try {
				const res = await fetchMonths(ranges, ctrl.signal);
				if (res && initial) onInitialRef.current?.(res.newRecs, res.rows);
			} catch {
				/* bỏ qua (kể cả abort) */
			} finally {
				if (initial && !ctrl.signal.aborted) setLoadingRecords(false);
			}
		},
		[activeKhoaId, fetchMonths],
	);

	// ── Đổi khoa → reset + tải tháng hiện tại & tháng trước ──
	useEffect(() => {
		const ctrl = new AbortController();
		abortRef.current = ctrl;
		loadedMonths.current.clear();
		setRecords([]);
		setRecordIds({});
		const ranges = [monthFromNow(-1), monthFromNow(0)];
		// Lịch đang mở tháng khác → tải luôn tháng đó cho khoa mới
		const view = viewMonth.current;
		if (view && !ranges.some((r) => r.key === view.key)) ranges.push(view);
		run(ranges, true);
		return () => ctrl.abort();
	}, [run]);

	// ── Lịch chuyển tháng ────────────────────────────────────
	const loadMonth = useCallback(
		(year: number, month: number) => {
			const range = getMonthRange(year, month);
			viewMonth.current = range;
			if (!loadedMonths.current.has(range.key)) run([range]);
		},
		[run],
	);

	/** Tải lại tháng chứa `date` (vd. sau khi lưu để lấy record_id thật). */
	const reloadMonthOf = useCallback(
		(date: string) => {
			const [y, m] = date.split('-').map(Number);
			run([getMonthRange(y, m - 1)]);
		},
		[run],
	);

	// ── Realtime ─────────────────────────────────────────────
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource !== 'reports') return;
				const ranges = [monthFromNow(0)];
				if (viewMonth.current && viewMonth.current.key !== ranges[0].key)
					ranges.push(viewMonth.current);
				loadedMonths.current.clear();
				run(ranges);
			},
			[run],
		),
	);

	return {
		records,
		setRecords,
		recordIds,
		setRecordIds,
		loadingRecords,
		loadMonth,
		reloadMonthOf,
	};
}
