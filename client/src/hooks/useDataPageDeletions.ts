import { useState } from 'react';
import type { ApiReport, ReportMeta } from '@/types/apiType';

export interface UseDataPageDeletionsArgs {
	report: ApiReport | null;
	setReport: React.Dispatch<React.SetStateAction<ApiReport | null>>;
	setReportMetas: React.Dispatch<React.SetStateAction<ReportMeta[]>>;
	setApiError: React.Dispatch<React.SetStateAction<string>>;
	selDate: string;
}

/** Xoá báo cáo ngày / xoá 1 record khoa / xoá 1 record khoa CLS (DataPage). */
export function useDataPageDeletions({
	report,
	setReport,
	setReportMetas,
	setApiError,
	selDate,
}: UseDataPageDeletionsArgs) {
	const [saving, setSaving] = useState(false);
	const [showDelConfirm, setShowDelConfirm] = useState(false);
	const [delRecord, setDelRecord] = useState<{ id: number; name: string } | null>(
		null,
	);
	const [delClsRecord, setDelClsRecord] = useState<{
		id: number;
		name: string;
	} | null>(null);

	// ── Xóa toàn bộ báo cáo ngày ────────────────────────────────────────
	const delReport = async () => {
		if (!report) return;
		setSaving(true);
		setApiError('');
		try {
			const res = await fetch(`/api/reports/${report.id_report}`, {
				method: 'DELETE',
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setApiError(data.message ?? 'Lỗi khi xóa');
				return;
			}
			setReportMetas((prev) =>
				prev.filter((m) => m.id_report !== report.id_report),
			);
			setReport(null);
			setShowDelConfirm(false);
		} catch {
			setApiError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	// ── Xóa 1 record khoa ────────────────────────────────────────────────
	const confirmDelRecord = async () => {
		if (!delRecord || !report) return;
		setSaving(true);
		setApiError('');
		try {
			const res = await fetch(
				`/api/reports/${report.id_report}/records/${delRecord.id}`,
				{ method: 'DELETE' },
			);
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setApiError(data.message ?? 'Lỗi khi xóa');
				return;
			}
			const rRes = await fetch(`/api/reports/date/${selDate}`);
			const rData = (await rRes.json()) as {
				success: boolean;
				data: ApiReport;
			};
			if (rData.success) setReport(rData.data);
			setDelRecord(null);
		} catch {
			setApiError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	// ── Xóa 1 record khoa CLS ────────────────────────────────────────────
	const confirmDelClsRecord = async () => {
		if (!delClsRecord || !report) return;
		setSaving(true);
		setApiError('');
		try {
			const res = await fetch(
				`/api/reports/${report.id_report}/cls-records/${delClsRecord.id}`,
				{ method: 'DELETE' },
			);
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setApiError(data.message ?? 'Lỗi khi xóa');
				return;
			}
			const rRes = await fetch(`/api/reports/date/${selDate}`);
			const rData = (await rRes.json()) as {
				success: boolean;
				data: ApiReport;
			};
			if (rData.success) setReport(rData.data);
			setDelClsRecord(null);
		} catch {
			setApiError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	return {
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
	};
}
