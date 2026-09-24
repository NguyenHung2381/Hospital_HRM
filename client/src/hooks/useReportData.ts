import { useAppSSE } from '@/hooks/useAppSSE';
import type { ApiReport, ReportMeta } from '@/types/apiType';
import { getMonthRange } from '@/utils/dateUtils';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseReportDataReturn {
	report: ApiReport | null;
	setReport: React.Dispatch<React.SetStateAction<ApiReport | null>>;
	reportMetas: ReportMeta[];
	setReportMetas: React.Dispatch<React.SetStateAction<ReportMeta[]>>;
	loadingReport: boolean;
	apiError: string;
	setApiError: React.Dispatch<React.SetStateAction<string>>;
	/** Gắn vào Calendar.onMonthChange → tải meta của tháng đang xem. */
	loadMonth: (year: number, month: number) => void;
}

/**
 * Quản lý toàn bộ việc fetch dữ liệu báo cáo:
 *  - Lấy danh sách ReportMeta theo từng tháng lịch đang xem (cache theo tháng)
 *  - Fetch chi tiết ApiReport mỗi khi selDate thay đổi
 *  - Tự cập nhật realtime qua SSE khi có thay đổi từ server
 */
export function useReportData(selDate: string): UseReportDataReturn {
	const [report, setReport] = useState<ApiReport | null>(null);
	const [reportMetas, setReportMetas] = useState<ReportMeta[]>([]);
	const [loadingReport, setLoadingReport] = useState(false);
	const [apiError, setApiError] = useState('');

	// ── Fetch meta theo tháng lịch đang xem ─────────────────────────────
	// Mỗi tháng chỉ ~31 dòng (có index report_date) → nhẹ; tháng đã tải được
	// cache lại, chuyển tháng qua lại không gọi API lần nữa.
	const loadedMonths = useRef(new Set<string>());
	const viewMonth = useRef(
		getMonthRange(new Date().getFullYear(), new Date().getMonth()),
	);
	const metaAbort = useRef<AbortController | null>(null);

	const fetchMetas = useCallback(async (force = false) => {
		const range = viewMonth.current;
		if (!force && loadedMonths.current.has(range.key)) return;
		metaAbort.current?.abort();
		const ctrl = new AbortController();
		metaAbort.current = ctrl;
		try {
			const res = await fetch(
				`/api/reports?from=${range.from}&to=${range.to}`,
				{ signal: ctrl.signal },
			);
			const data = (await res.json()) as {
				success: boolean;
				data: ReportMeta[];
			};
			if (!data.success) return;
			loadedMonths.current.add(range.key);
			// Thay phần của tháng này, giữ nguyên các tháng đã tải khác
			setReportMetas((prev) => [
				...prev.filter((m) => !m.report_date.startsWith(range.key)),
				...data.data,
			]);
		} catch {
			/* bỏ qua (kể cả abort) — calendar vẫn hiển thị, chỉ thiếu dấu chấm */
		}
	}, []);

	const loadMonth = useCallback(
		(year: number, month: number) => {
			viewMonth.current = getMonthRange(year, month);
			fetchMetas();
		},
		[fetchMetas],
	);

	useEffect(() => {
		fetchMetas();
		return () => metaAbort.current?.abort();
	}, [fetchMetas]);

	// ── Fetch chi tiết báo cáo mỗi khi đổi ngày ─────────────────────────
	const fetchReport = useCallback(async () => {
		setLoadingReport(true);
		setReport(null);
		setApiError('');
		try {
			const res = await fetch(`/api/reports/date/${selDate}`);
			if (res.status === 404) {
				setLoadingReport(false);
				return;
			}
			const data = (await res.json()) as {
				success: boolean;
				data: ApiReport;
			};
			if (data.success) setReport(data.data);
		} catch {
			/* bỏ qua */
		} finally {
			setLoadingReport(false);
		}
	}, [selDate]);

	useEffect(() => {
		fetchReport();
	}, [fetchReport]);

	// ── Realtime: tự cập nhật khi có thay đổi từ server ─────────────────
	// Chỉ refetch report + metas, không reset state cũ trước → không flicker
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'reports') {
					// Refresh meta tháng đang xem (calendar chấm) lẫn chi tiết ngày đang xem;
					// các tháng khác sẽ tải lại khi mở tới
					loadedMonths.current.clear();
					fetchMetas(true);
					fetchReport();
				}
			},
			[fetchMetas, fetchReport],
		),
	);

	return {
		report,
		setReport,
		reportMetas,
		setReportMetas,
		loadingReport,
		apiError,
		setApiError,
		loadMonth,
	};
}
