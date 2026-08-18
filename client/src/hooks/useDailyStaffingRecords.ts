import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { useAppSSE } from '@/hooks/useAppSSE';
import type { ApiDeptRecord } from '@/types/apiType';
import type { DailyRecord } from '@/types/staffingType';
import { getNextAvailableDate, getTodayDateString } from '@/utils/dateUtils';
import { apiToDailyRecord, dailyToApiBody } from '@/utils/recordHelperUtils';
import { createEmptyRecord } from '@/modules/home/utils/recordHelpers';

/** CRUD + fetch cho bản ghi chấm công ngày (DailyStaffingBoard). */
export function useDailyStaffingRecords(activeKhoaId: number) {
	const { user } = useAuth();

	const [records, setRecords] = useState<DailyRecord[]>([]);
	const [recordIds, setRecordIds] = useState<
		Record<string, { id_report: number; record_id: number }>
	>({});
	const [activeDate, setActiveDate] = useState(getTodayDateString());
	const [loadingRecords, setLoadingRecords] = useState(false);
	const [saving, setSaving] = useState(false);
	const [apiError, setApiError] = useState('');

	type MMode = 'add' | 'edit' | null;
	const [mMode, setMMode] = useState<MMode>(null);
	const [formInitial, setFormInitial] = useState<DailyRecord>(
		createEmptyRecord(getTodayDateString()),
	);
	const [delDate, setDelDate] = useState<string | null>(null);

	// ── Fetch records từ API khi đổi khoa ────────────────────
	const fetchKhoaRecords = useCallback(async () => {
		if (!activeKhoaId) return;
		setLoadingRecords(true);
		try {
			const from = new Date();
			from.setDate(from.getDate() - 30);
			const fromStr = from.toISOString().slice(0, 10);
			const listRes = await fetch(`/api/reports?from=${fromStr}`);
			const listData = (await listRes.json()) as {
				success: boolean;
				data: { id_report: number; report_date: string }[];
			};
			if (!listData.success) return;

			const detailPromises = listData.data.map((rep) =>
				fetch(`/api/reports/${rep.id_report}`).then(
					(r) =>
						r.json() as Promise<{
							success: boolean;
							data: {
								id_report: number;
								report_date: string;
								records: ApiDeptRecord[];
							};
						}>,
				),
			);
			const details = await Promise.all(detailPromises);

			const newRecords: DailyRecord[] = [];
			const newIds: Record<string, { id_report: number; record_id: number }> =
				{};

			for (const detail of details) {
				if (!detail.success) continue;
				const { id_report, report_date, records: recs } = detail.data;
				const deptRec = recs.find((r) => r.id_department === activeKhoaId);
				if (!deptRec) continue;
				const dateKey = report_date.slice(0, 10);
				newRecords.push(apiToDailyRecord(dateKey, deptRec));
				newIds[dateKey] = { id_report, record_id: deptRec.id };
			}

			newRecords.sort((a, b) => a.date.localeCompare(b.date));
			setRecords(newRecords);
			setRecordIds(newIds);
			const today = getTodayDateString();
			const hasToday = newRecords.some((r) => r.date === today);
			if (!hasToday && newRecords.length)
				setActiveDate(newRecords[newRecords.length - 1].date);
		} finally {
			setLoadingRecords(false);
		}
	}, [activeKhoaId]);

	useEffect(() => {
		fetchKhoaRecords();
	}, [fetchKhoaRecords]);

	// ── Realtime: tự cập nhật khi có thay đổi từ server ──────
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'reports') {
					fetchKhoaRecords();
				}
			},
			[fetchKhoaRecords],
		),
	);

	const openAdd = (date?: string) => {
		setFormInitial(
			createEmptyRecord(
				date ?? getNextAvailableDate(records.map((r) => r.date)),
			),
		);
		setApiError('');
		setMMode('add');
	};

	const openEdit = (active: DailyRecord | null) => {
		if (active) {
			setFormInitial(JSON.parse(JSON.stringify(active)));
			setApiError('');
			setMMode('edit');
		}
	};

	const saveRecord = async (draft: DailyRecord) => {
		setSaving(true);
		setApiError('');
		try {
			const ids = recordIds[draft.date];
			if (ids) {
				const res = await fetch(
					`/api/reports/${ids.id_report}/records/${ids.record_id}`,
					{
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(dailyToApiBody(draft)),
					},
				);
				if (!res.ok) {
					const err = (await res.json().catch(() => ({}))) as {
						message?: string;
					};
					setApiError(err.message ?? 'Lỗi khi cập nhật dữ liệu');
					return;
				}
			} else {
				const checkRes = await fetch(
					`/api/reports?from=${draft.date}&to=${draft.date}`,
				);
				const checkData = (await checkRes.json().catch(() => ({}))) as {
					success?: boolean;
					data?: { id_report: number; report_date: string }[];
				};
				const existingReport = checkData.data?.[0];
				let targetIdReport: number | undefined;

				if (existingReport) {
					const addRes = await fetch(
						`/api/reports/${existingReport.id_report}/records`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id_department: activeKhoaId,
								sort_order: 1,
								...dailyToApiBody(draft),
							}),
						},
					);
					if (!addRes.ok) {
						setApiError('Lỗi khi thêm bản ghi vào báo cáo');
						return;
					}
					targetIdReport = existingReport.id_report;
				} else {
					const createRes = await fetch(`/api/reports`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							report_date: draft.date,
							created_by: user?.id ?? null,
							records: [
								{
									id_department: activeKhoaId,
									sort_order: 1,
									...dailyToApiBody(draft),
								},
							],
						}),
					});
					if (!createRes.ok) {
						setApiError('Lỗi khi tạo báo cáo mới');
						return;
					}
					const createData = (await createRes.json()) as {
						success: boolean;
						data: { id_report: number };
					};
					targetIdReport = createData.data?.id_report;
				}

				if (targetIdReport) {
					setRecordIds((prev) => ({
						...prev,
						[draft.date]: {
							id_report: targetIdReport!,
							record_id: 0,
						},
					}));
				}
			}

			setRecords((prev) =>
				[...prev.filter((r) => r.date !== draft.date), draft].sort((a, b) =>
					a.date.localeCompare(b.date),
				),
			);
			setActiveDate(draft.date);
			setMMode(null);
		} finally {
			setSaving(false);
		}
	};

	const confirmDel = async () => {
		if (!delDate) return;
		const ids = recordIds[delDate];
		setSaving(true);
		setApiError('');
		try {
			if (ids) {
				const res = await fetch(`/api/reports/${ids.id_report}`, {
					method: 'DELETE',
				});
				if (!res.ok) {
					setApiError('Lỗi khi xoá bản ghi');
					setDelDate(null);
					return;
				}
				setRecordIds((prev) => {
					const next = { ...prev };
					delete next[delDate];
					return next;
				});
			}
			const remaining = records.filter((r) => r.date !== delDate);
			setRecords(remaining);
			setActiveDate(
				remaining.length
					? remaining[remaining.length - 1].date
					: getTodayDateString(),
			);
			setDelDate(null);
		} finally {
			setSaving(false);
		}
	};

	return {
		records,
		recordIds,
		activeDate,
		setActiveDate,
		loadingRecords,
		saving,
		apiError,
		setApiError,
		mMode,
		setMMode,
		formInitial,
		delDate,
		setDelDate,
		openAdd,
		openEdit,
		saveRecord,
		confirmDel,
	};
}
