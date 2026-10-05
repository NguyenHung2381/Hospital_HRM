import { useState } from 'react';
import { useDeptMonthRecords } from '@/hooks/useDeptMonthRecords';
import type { ApiDeptRecord } from '@/types/apiType';
import type { DailyRecord } from '@/types/staffingType';
import { getNextAvailableDate, getTodayDateString } from '@/utils/dateUtils';
import {
	apiErrorMessage,
	apiToDailyRecord,
	dailyToApiBody,
	upsertDeptRecord,
} from '@/utils/recordHelperUtils';
import { createEmptyRecord } from '@/modules/home/utils/recordHelpers';

/** CRUD + fetch cho bản ghi chấm công ngày (DailyStaffingBoard). */
export function useDailyStaffingRecords(activeKhoaId: number) {
	const [activeDate, setActiveDate] = useState(getTodayDateString());
	const { records, setRecords, recordIds, setRecordIds, loadingRecords, loadMonth } =
		useDeptMonthRecords<ApiDeptRecord & { report_date: string }, DailyRecord>(
			activeKhoaId,
			'ward',
			apiToDailyRecord,
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
			const ids = await upsertDeptRecord('records', draft.date, recordIds[draft.date], {
				id_department: activeKhoaId,
				...dailyToApiBody(draft),
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
				// Chỉ xoá bản ghi của khoa này — KHÔNG xoá cả báo cáo ngày (chứa mọi khoa)
				const res = await fetch(
					`/api/reports/${ids.id_report}/records/${ids.record_id}`,
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
