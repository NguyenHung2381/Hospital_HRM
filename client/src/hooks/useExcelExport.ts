import { useState } from 'react';
import type { ReportConfig } from '@/types/reportType';
import {
	rangeToApiDates,
	type DayRange,
	type GroupBy,
	type MonthRange,
	type WeekRange,
	type YearRange,
} from '@/modules/admin/pages/reportRangeUtils';

/** Tải 1 file .xlsx từ 1 endpoint export (đọc Content-Disposition để đặt tên file). */
async function downloadExportFile(url: string, fallbackName: string) {
	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
		},
	});
	if (!res.ok) {
		const json = await res.json().catch(() => ({}));
		throw new Error((json as { message?: string }).message ?? `Lỗi ${res.status}`);
	}
	const disposition = res.headers.get('content-disposition') ?? '';
	const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;"\n]+)/i);
	const filename = match
		? decodeURIComponent(match[1].trim().replace(/"/g, ''))
		: fallbackName;
	const blob = await res.blob();
	const objUrl = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = objUrl;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(objUrl);
}

/** Gọi API xuất Excel báo cáo nhân lực + tải file về (dùng trong admin ReportPage). */
export function useExcelExport(
	cfg: ReportConfig,
	groupBy: GroupBy,
	dayRange: DayRange,
	weekRange: WeekRange,
	monthRange: MonthRange,
	yearRange: YearRange,
	rangeError: string,
) {
	const [loading, setLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState('');

	const handleExportExcel = async () => {
		if (rangeError) {
			setErrorMsg(rangeError);
			return;
		}
		const dates = rangeToApiDates(
			groupBy,
			dayRange,
			weekRange,
			monthRange,
			yearRange,
		);

		const exportWard = (department: string) => {
			const params = new URLSearchParams({
				from: dates.from,
				to: dates.to,
				department,
				groupBy,
			});
			return downloadExportFile(
				`/api/reports/export?${params}`,
				`BaoCaoNhanLuc_${dates.from}_${dates.to}.xlsx`,
			);
		};

		const exportCls = () => {
			const params = new URLSearchParams({ from: dates.from, to: dates.to });
			return downloadExportFile(
				`/api/reports/cls-export?${params}`,
				`BaoCaoNhanLuc_CLS_${dates.from}_${dates.to}.xlsx`,
			);
		};

		try {
			setLoading(true);
			setErrorMsg('');

			switch (cfg.rScope) {
				case 'all': {
					// Toàn bệnh viện: sinh 2 file — khối nội trú + hệ CLS
					await exportWard('all');
					try {
						await exportCls();
					} catch (clsErr) {
						setErrorMsg(
							`Đã xuất báo cáo khối nội trú. Không thể xuất báo cáo hệ CLS: ${
								clsErr instanceof Error ? clsErr.message : 'lỗi không xác định'
							}`,
						);
					}
					break;
				}
				case 'ward':
					await exportWard('all');
					break;
				case 'cls':
					await exportCls();
					break;
				case 'one':
					await exportWard(cfg.rKhoa || 'all');
					break;
			}
		} catch (err: unknown) {
			setErrorMsg(
				err instanceof Error ? err.message : 'Xuất thất bại, vui lòng thử lại',
			);
		} finally {
			setLoading(false);
		}
	};

	return { loading, errorMsg, setErrorMsg, handleExportExcel };
}
