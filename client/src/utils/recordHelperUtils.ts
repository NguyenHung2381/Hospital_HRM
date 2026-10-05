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

// ── Lưu bản ghi 1 khoa / 1 ngày (dùng chung DailyStaffingBoard + CLSStaffingBoard) ──
type RecordIds = { id_report: number; record_id: number };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const apiErrorMessage = async (res: Response, fallback: string) =>
	((await res.json().catch(() => ({}))) as { message?: string }).message ?? fallback;

async function findOrCreateReport(date: string): Promise<number | string> {
	const find = async () => {
		const res = await fetch(`/api/reports?from=${date}&to=${date}`);
		const data = (await res.json().catch(() => ({}))) as {
			data?: { id_report: number }[];
		};
		return data.data?.[0]?.id_report;
	};
	const existing = await find();
	if (existing) return existing;
	const res = await fetch('/api/reports', {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify({ report_date: date }),
	});
	if (res.ok)
		return ((await res.json()) as { data: { id_report: number } }).data.id_report;
	// Khoa khác vừa tạo báo cáo cùng ngày (409) → dùng luôn báo cáo đó
	if (res.status === 409) return (await find()) ?? 'Lỗi khi tạo báo cáo mới';
	return apiErrorMessage(res, 'Lỗi khi tạo báo cáo mới');
}

/** Sửa (đã có ids) hoặc thêm bản ghi; trả về ids thật từ server, hoặc chuỗi lỗi. */
export async function upsertDeptRecord(
	path: 'records' | 'cls-records',
	date: string,
	ids: RecordIds | undefined,
	body: object,
): Promise<RecordIds | string> {
	if (ids) {
		const res = await fetch(`/api/reports/${ids.id_report}/${path}/${ids.record_id}`, {
			method: 'PUT',
			headers: JSON_HEADERS,
			body: JSON.stringify(body),
		});
		return res.ok ? ids : apiErrorMessage(res, 'Lỗi khi cập nhật dữ liệu');
	}
	const id_report = await findOrCreateReport(date);
	if (typeof id_report === 'string') return id_report;
	const res = await fetch(`/api/reports/${id_report}/${path}`, {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify(body),
	});
	if (!res.ok) return apiErrorMessage(res, 'Lỗi khi thêm bản ghi vào báo cáo');
	const data = (await res.json()) as { data: { id: number } };
	return { id_report, record_id: data.data.id };
}
