// clsFieldConfig.ts
// Quy định trường nào áp dụng cho từng khoa hệ CLS, theo mẫu
// "12.8. P.ĐD_Biểu mẫu báo nhân lực hệ CLS.xlsx": cột "Mẫu bệnh phẩm / Tiêu bản /
// Người bệnh khám / Người bệnh tư vấn" đổi nhãn theo khoa (XN, Giải phẫu bệnh,
// Phòng khám, Dinh dưỡng); cột X-quang/CT-Nội soi/MRI/Điện tim chỉ dùng cho
// X.Quang + Thăm dò chức năng; cột Đồ vải/Xử lý dụng cụ/Khoa giám sát chỉ dùng
// cho Kiểm soát nhiễm khuẩn. Các khoa khác (không nhận diện được mã) hiển thị
// đủ mọi trường như trước.
import type { ClsPending, ClsWorkload } from '@/types/clsType';

export type ClsFieldId =
	| 'sampleOrVisit'
	| 'xrayUs'
	| 'ctEndoscopy'
	| 'mriBoneDensity'
	| 'ecgIntervention'
	| 'linen'
	| 'toolMetal'
	| 'toolPlastic'
	| 'supervisedDept';

export interface ClsFieldDescriptor {
	id: ClsFieldId;
	label: string;
	daLamKey: keyof ClsWorkload;
	/** null nếu trường này không có ở phần "tồn/chờ" (vd. khoa giám sát) */
	tonChoKey: keyof ClsPending | null;
	/** Tên cột API (snake_case) — dùng ở EditClsRecordModal (admin, thao tác trực tiếp trên ApiClsRecord) */
	apiDaLamKey: string;
	apiTonChoKey: string | null;
}

const BASE_DESCRIPTORS: Record<ClsFieldId, ClsFieldDescriptor> = {
	sampleOrVisit: {
		id: 'sampleOrVisit',
		label: 'Mẫu BP / Tiêu bản / NB khám / tư vấn',
		daLamKey: 'sampleOrVisit',
		tonChoKey: 'sampleOrVisit',
		apiDaLamKey: 'sample_or_visit_cnt',
		apiTonChoKey: 'pending_sample_or_visit_cnt',
	},
	xrayUs: {
		id: 'xrayUs',
		label: 'X-quang hoặc siêu âm',
		daLamKey: 'xrayUs',
		tonChoKey: 'xrayUs',
		apiDaLamKey: 'xray_us_cnt',
		apiTonChoKey: 'pending_xray_us_cnt',
	},
	ctEndoscopy: {
		id: 'ctEndoscopy',
		label: 'CT / Nội soi',
		daLamKey: 'ctEndoscopy',
		tonChoKey: 'ctEndoscopy',
		apiDaLamKey: 'ct_endoscopy_cnt',
		apiTonChoKey: 'pending_ct_endoscopy_cnt',
	},
	mriBoneDensity: {
		id: 'mriBoneDensity',
		label: 'MRI / Loãng xương',
		daLamKey: 'mriBoneDensity',
		tonChoKey: 'mriBoneDensity',
		apiDaLamKey: 'mri_bonedensity_cnt',
		apiTonChoKey: 'pending_mri_bonedensity_cnt',
	},
	ecgIntervention: {
		id: 'ecgIntervention',
		label: 'Điện tim hoặc can thiệp',
		daLamKey: 'ecgIntervention',
		tonChoKey: 'ecgIntervention',
		apiDaLamKey: 'ecg_intervention_cnt',
		apiTonChoKey: 'pending_ecg_intervention_cnt',
	},
	linen: {
		id: 'linen',
		label: 'Đồ vải (Kg) / Truyền thông',
		daLamKey: 'linenMedia',
		tonChoKey: 'linen',
		apiDaLamKey: 'linen_media_cnt',
		apiTonChoKey: 'pending_linen_cnt',
	},
	toolMetal: {
		id: 'toolMetal',
		label: 'Xử lý dụng cụ sắt (Bộ)',
		daLamKey: 'toolMetal',
		tonChoKey: 'toolMetal',
		apiDaLamKey: 'tool_metal_cnt',
		apiTonChoKey: 'pending_tool_metal_cnt',
	},
	toolPlastic: {
		id: 'toolPlastic',
		label: 'Xử lý dụng cụ nhựa (Cái)',
		daLamKey: 'toolPlastic',
		tonChoKey: 'toolPlastic',
		apiDaLamKey: 'tool_plastic_cnt',
		apiTonChoKey: 'pending_tool_plastic_cnt',
	},
	supervisedDept: {
		id: 'supervisedDept',
		label: 'Khoa giám sát (số khoa)',
		daLamKey: 'supervisedDept',
		tonChoKey: null,
		apiDaLamKey: 'supervised_dept_cnt',
		apiTonChoKey: null,
	},
};

const FIELD_GROUPS: Record<'sample' | 'imaging' | 'infection', ClsFieldId[]> = {
	sample: ['sampleOrVisit'],
	imaging: ['xrayUs', 'ctEndoscopy', 'mriBoneDensity', 'ecgIntervention'],
	infection: ['linen', 'toolMetal', 'toolPlastic', 'supervisedDept'],
};

interface ClsDeptFieldConfig {
	fieldIds: ClsFieldId[];
	/** Nhãn riêng cho trường "sampleOrVisit" (mẫu bệnh phẩm/tiêu bản/NB khám/tư vấn) theo khoa */
	sampleLabel?: string;
}

/** Mã khoa (code_department, seed CLS01..CLS10) → cấu hình trường áp dụng */
const CONFIG_BY_CODE: Record<string, ClsDeptFieldConfig> = {
	CLS01: { fieldIds: FIELD_GROUPS.sample, sampleLabel: 'Mẫu bệnh phẩm' }, // Huyết học
	CLS02: { fieldIds: FIELD_GROUPS.sample, sampleLabel: 'Mẫu bệnh phẩm' }, // Hóa sinh
	CLS03: { fieldIds: FIELD_GROUPS.sample, sampleLabel: 'Mẫu bệnh phẩm' }, // Vi sinh
	CLS04: { fieldIds: FIELD_GROUPS.sample, sampleLabel: 'Mẫu bệnh phẩm' }, // Sinh học phân tử
	CLS05: { fieldIds: FIELD_GROUPS.sample, sampleLabel: 'Tiêu bản' }, // Giải phẫu bệnh
	CLS06: { fieldIds: FIELD_GROUPS.imaging }, // Thăm dò chức năng
	CLS07: { fieldIds: FIELD_GROUPS.imaging }, // X.Quang
	CLS08: { fieldIds: FIELD_GROUPS.infection }, // Kiểm soát nhiễm khuẩn
	CLS09: { fieldIds: FIELD_GROUPS.sample, sampleLabel: 'Người bệnh tư vấn' }, // Dinh dưỡng
	CLS10: { fieldIds: FIELD_GROUPS.sample, sampleLabel: 'Người bệnh đến khám' }, // Khám bệnh
};

const ALL_FIELD_IDS = Object.keys(BASE_DESCRIPTORS) as ClsFieldId[];

/** Danh sách trường áp dụng cho khoa `code` — mã không nhận diện được thì trả về đủ mọi trường. */
export function getClsFields(code?: string | null): ClsFieldDescriptor[] {
	const cfg = code ? CONFIG_BY_CODE[code] : undefined;
	const fieldIds = cfg?.fieldIds ?? ALL_FIELD_IDS;
	return fieldIds.map((id) => {
		const base = BASE_DESCRIPTORS[id];
		if (id === 'sampleOrVisit' && cfg?.sampleLabel) {
			return { ...base, label: cfg.sampleLabel };
		}
		return base;
	});
}
