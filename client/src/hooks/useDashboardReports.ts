import type { ApiReport, ReportMeta } from '@/types/apiType';
import { useCallback, useEffect, useState } from 'react';
import { useAppSSE } from './useAppSSE';

/** Số ngày có dữ liệu tối đa mà Dashboard tải chi tiết. */
const MAX_REPORTS = 30;

/** Fetch 30 ngày báo cáo có dữ liệu gần nhất + tự cập nhật qua SSE (DashboardPage). */
export function useDashboardReports() {
	const [allReports, setAllReports] = useState<ApiReport[]>([]);
	const [loading, setLoading] = useState(true);
	// Index của báo cáo đang xem (0 = mới nhất)
	const [selIdx, setSelIdx] = useState(0);

	const fetchData = useCallback(async () => {
		try {
			// Không giới hạn theo lịch: ngày có dữ liệu gần nhất có thể đã quá 30 ngày
			const listRes = await fetch(`/api/reports`);
			const listData = (await listRes.json()) as {
				success: boolean;
				data: ReportMeta[];
			};

			// Bỏ các ngày đã tạo báo cáo nhưng chưa có khoa nào nhập liệu
			// (API đã sắp xếp report_date giảm dần → lấy MAX_REPORTS ngày mới nhất)
			const withRecords = listData.success
				? listData.data.filter((r) => r.has_records).slice(0, MAX_REPORTS)
				: [];

			if (!withRecords.length) {
				setAllReports([]);
				setSelIdx(0);
				return;
			}

			// Lấy chi tiết các báo cáo (tối đa MAX_REPORTS ngày)
			const detailResults = await Promise.all(
				withRecords.map((r) =>
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
