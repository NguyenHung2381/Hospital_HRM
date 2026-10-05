import { useState } from 'react';
import { useDeptMonthRecords } from '@/hooks/useDeptMonthRecords';
import type { ApiClsRecord } from '@/types/apiType';
import type { DailyClsRecord } from '@/types/clsType';
import { blankDailyClsRecord } from '@/types/clsType';
import { apiToDailyClsRecord, dailyClsToApiBody } from '@/utils/clsCalc';
import { getNextAvailableDate, getTodayDateString } from '@/utils/dateUtils';
import { apiErrorMessage, upsertDeptRecord } from '@/utils/recordHelperUtils';

/** CRUD + fetch cho bản ghi chấm công hệ CLS (CLSStaffingBoard). */
export function useClsStaffingRecords(
	activeKhoaId: number,
	onRecommendedStaffFromRecord: (staff: number) => void,
) {
	const [activeDate, setActiveDate] = useState(getTodayDateString());
	const {
		records,
		setRecords,
		recordIds,
		setRecordIds,
		loadingRecords,
		loadMonth,
		reloadMonthOf,
	} =
		useDeptMonthRecords<ApiClsRecord & { report_date: string }, DailyClsRecord>(
			activeKhoaId,
			'cls',
			apiToDailyClsRecord,
			(_recs, rows) => {
				for (const row of rows)
					if (row.recommended_staff !== null)
						onRecommendedStaffFromRecord(row.recommended_staff);
			},
		);
	const [saving, setSaving] = useState(false);
	const [apiError, setApiError] = useState('');

	type MMode = 'add' | 'edit' | null;
	const [mMode, setMMode] = useState<MMode>(null);
	const [formInitial, setFormInitial] = useState<DailyClsRecord>(
		blankDailyClsRecord(getTodayDateString()),
	);
	const [delDate, setDelDate] = useState<string | null>(null);

	const openAdd = (date?: string) => {
		setFormInitial(
			blankDailyClsRecord(
				date ?? getNextAvailableDate(records.map((r) => r.date)),
			),
		);
		setApiError('');
		setMMode('add');
	};

	const openEdit = (active: DailyClsRecord | null) => {
		if (active) {
			setFormInitial(JSON.parse(JSON.stringify(active)));
			setApiError('');
			setMMode('edit');
		}
	};

	const saveRecord = async (draft: DailyClsRecord) => {
		setSaving(true);
		setApiError('');
		try {
			const ids = await upsertDeptRecord('cls-records', draft.date, recordIds[draft.date], {
				id_department: activeKhoaId,
				...dailyClsToApiBody(draft),
			});
			if (typeof ids === 'string') {
				setApiError(ids);
				return;
			}
			setRecordIds((prev) => ({ ...prev, [draft.date]: ids }));
			setRecords((prev) =>
				[...prev.filter((r) => r.date !== draft.date), draft].sort((a, b) =>
					a.date.localeCompare(b.date),
				),
			);
			setActiveDate(draft.date);
			setMMode(null);
			reloadMonthOf(draft.date);
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
			if (ids?.record_id) {
				const res = await fetch(
					`/api/reports/${ids.id_report}/cls-records/${ids.record_id}`,
					{ method: 'DELETE' },
				);
				if (!res.ok) {
					setApiError(await apiErrorMessage(res, 'Lỗi khi xoá bản ghi'));
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
