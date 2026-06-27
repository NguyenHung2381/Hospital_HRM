import type { ApiDeptRecord, ApiRecord } from '@/types/apiType';
import type { DailyRecord, RecordDraft } from '@/types/staffingType';

export function apiToDailyRecord(date: string, r: ApiDeptRecord): DailyRecord {
	return {
		date,
		nb: {
			cap1: r.patient_level_1 ?? null,
			cap2: r.patient_level_2 ?? null,
			cap3: r.patient_level_3 ?? null,
		},
		nbKhamPT: r.outpatient_cnt ?? null,
		nl: {
			tong: r.total_staff ?? null,
			nghiTruc: r.staff_on_duty ?? null,
			nghiTren2Ngay: r.staff_long_leave ?? null,
		},
		ghiChu: r.note ?? '',
	};
}

export function dailyToApiBody(r: DailyRecord) {
	return {
		patient_level_1: r.nb.cap1,
		patient_level_2: r.nb.cap2,
		patient_level_3: r.nb.cap3,
		outpatient_cnt: r.nbKhamPT,
		total_staff: r.nl.tong,
		staff_on_duty: r.nl.nghiTruc,
		staff_long_leave: r.nl.nghiTren2Ngay,
		note: r.ghiChu,
	};
}

export function blankDraft(r: ApiRecord): RecordDraft {
	return {
		id_department: r.id_department,
		department_name: r.department_name,
		patient_level_1: r.patient_level_1,
		patient_level_2: r.patient_level_2,
		patient_level_3: r.patient_level_3,
		outpatient_cnt: r.outpatient_cnt,
		total_staff: r.total_staff,
		staff_on_duty: r.staff_on_duty,
		staff_long_leave: r.staff_long_leave,
		note: r.note ?? '',
	};
}
