import { useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { useDeptMonthRecords } from '@/hooks/useDeptMonthRecords';
import type { ApiDeptRecord } from '@/types/apiType';
import type { DailyRecord } from '@/types/staffingType';
import { getNextAvailableDate, getTodayDateString } from '@/utils/dateUtils';
import { apiToDailyRecord, dailyToApiBody } from '@/utils/recordHelperUtils';
import { createEmptyRecord } from '@/modules/home/utils/recordHelpers';

/** CRUD + fetch cho bản ghi chấm công ngày (DailyStaffingBoard). */
export function useDailyStaffingRecords(activeKhoaId: number) {
	const { user } = useAuth();

	const [activeDate, setActiveDate] = useState(getTodayDateString());
	const { records, setRecords, recordIds, setRecordIds, loadingRecords, loadMonth } =
		useDeptMonthRecords<ApiDeptRecord & { report_date: string }, DailyRecord>(
			activeKhoaId,
			'ward',
			apiToDailyRecord,
			(recs) => {
				// Chưa có bản ghi hôm nay → nhảy tới ngày gần nhất có dữ liệu
				const today = getTodayDateString();
				if (!recs.some((r) => r.date === today) && recs.length)
					setActiveDate(recs[recs.length - 1].date);
			},
		);
	const [saving, setSaving] = useState(false);
	const [apiError, setApiError] = useState('');

	type MMode = 'add' | 'edit' | null;
	const [mMode, setMMode] = useState<MMode>(null);
	const [formInitial, setFormInitial] = useState<DailyRecord>(
		createEmptyRecord(getTodayDateString()),
	);
	const [delDate, setDelDate] = useState<string | null>(null);

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
		loadMonth,
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
