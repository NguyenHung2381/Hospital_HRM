import type { ApiReport } from '@/types/apiType';
import { useCallback, useEffect, useState } from 'react';
import { useAppSSE } from './useAppSSE';

/** Fetch 30 ngày báo cáo gần nhất + tự cập nhật qua SSE (DashboardPage). */
export function useDashboardReports() {
	const [allReports, setAllReports] = useState<ApiReport[]>([]);
	const [loading, setLoading] = useState(true);
	// Index của báo cáo đang xem (0 = mới nhất)
	const [selIdx, setSelIdx] = useState(0);

	const fetchData = useCallback(async () => {
		try {
			const from = new Date();
			from.setDate(from.getDate() - 30);
			const fromStr = from.toISOString().slice(0, 10);

			const listRes = await fetch(`/api/reports?from=${fromStr}`);
			const listData = (await listRes.json()) as {
				success: boolean;
				data: { id_report: number; report_date: string }[];
			};

			if (!listData.success || !listData.data.length) {
				setLoading(false);
				return;
			}

			// Lấy chi tiết tất cả báo cáo (tối đa 30 ngày)
			const detailResults = await Promise.all(
				listData.data.map((r) =>
					fetch(`/api/reports/${r.id_report}`).then(
						(res) =>
							res.json() as Promise<{
								success: boolean;
								data: ApiReport;
							}>,
					),
				),
			);

			const reports = detailResults.filter((r) => r.success).map((r) => r.data);

			// Sắp xếp mới nhất lên đầu
			reports.sort((a, b) => b.report_date.localeCompare(a.report_date));

			setAllReports(reports);
			setSelIdx(0);
		} catch {
			/* bỏ qua */
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// ── Realtime: tự cập nhật khi có báo cáo mới/đổi ────────
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'reports') {
					fetchData();
				}
			},
			[fetchData],
		),
	);

	return { allReports, loading, selIdx, setSelIdx };
}
