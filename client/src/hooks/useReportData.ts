import { useAppSSE } from '@/hooks/useAppSSE';
import type { ApiReport, ReportMeta } from '@/types/apiType';
import { useCallback, useEffect, useState } from 'react';

interface UseReportDataReturn {
	report: ApiReport | null;
	setReport: React.Dispatch<React.SetStateAction<ApiReport | null>>;
	reportMetas: ReportMeta[];
	setReportMetas: React.Dispatch<React.SetStateAction<ReportMeta[]>>;
	loadingReport: boolean;
	apiError: string;
	setApiError: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Quản lý toàn bộ việc fetch dữ liệu báo cáo:
 *  - Lấy danh sách ReportMeta 30 ngày gần nhất (1 lần khi mount)
 *  - Fetch chi tiết ApiReport mỗi khi selDate thay đổi
 *  - Tự cập nhật realtime qua SSE khi có thay đổi từ server
 */
export function useReportData(selDate: string): UseReportDataReturn {
	const [report, setReport] = useState<ApiReport | null>(null);
	const [reportMetas, setReportMetas] = useState<ReportMeta[]>([]);
	const [loadingReport, setLoadingReport] = useState(false);
	const [apiError, setApiError] = useState('');

	// ── Fetch danh sách meta 30 ngày ─────────────────────────────────────
	const fetchMetas = useCallback(async () => {
		try {
			const from = new Date();
			from.setDate(from.getDate() - 30);
			const res = await fetch(
				`/api/reports?from=${from.toISOString().slice(0, 10)}`,
			);
			const data = (await res.json()) as {
				success: boolean;
				data: ReportMeta[];
			};
			if (data.success) setReportMetas(data.data);
		} catch {
			/* bỏ qua — calendar vẫn hiển thị, chỉ thiếu dấu chấm */
		}
	}, []);

	useEffect(() => {
		fetchMetas();
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
					// Refresh cả meta list (calendar chấm) lẫn chi tiết ngày đang xem
					fetchMetas();
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
	};
}
