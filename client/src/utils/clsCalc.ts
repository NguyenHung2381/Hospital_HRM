import type { ApiClsRecord } from '@/types/apiType';
import type {
	ComputedClsStats,
	DailyClsRecord,
	KhoaClsRecord,
} from '@/types/clsType';

// ─────────────────────────────────────────────────────────────
// apiToDailyClsRecord / dailyClsToApiBody — mirror recordHelperUtils.ts
// (dùng trong CLSStaffingBoard, form nhập theo ngày cho 1 khoa)
// ─────────────────────────────────────────────────────────────
export function apiToDailyClsRecord(
	date: string,
	r: ApiClsRecord,
): DailyClsRecord {
	return {
		date,
		daLam: {
			sampleOrVisit: r.sample_or_visit_cnt,
			xrayUs: r.xray_us_cnt,
			ctEndoscopy: r.ct_endoscopy_cnt,
			mriBoneDensity: r.mri_bonedensity_cnt,
			ecgIntervention: r.ecg_intervention_cnt,
			linenMedia: r.linen_media_cnt,
			toolMetal: r.tool_metal_cnt,
			toolPlastic: r.tool_plastic_cnt,
			supervisedDept: r.supervised_dept_cnt,
		},
		tonCho: {
			sampleOrVisit: r.pending_sample_or_visit_cnt,
			xrayUs: r.pending_xray_us_cnt,
			ctEndoscopy: r.pending_ct_endoscopy_cnt,
			mriBoneDensity: r.pending_mri_bonedensity_cnt,
			ecgIntervention: r.pending_ecg_intervention_cnt,
			linen: r.pending_linen_cnt,
			toolMetal: r.pending_tool_metal_cnt,
			toolPlastic: r.pending_tool_plastic_cnt,
		},
		nl: {
			tong: r.total_staff,
			nghiTruc: r.staff_on_duty,
			nghiTren2Ngay: r.staff_long_leave,
		},
		ghiChu: r.note ?? '',
	};
}

export function dailyClsToApiBody(r: DailyClsRecord) {
	return {
		sample_or_visit_cnt: r.daLam.sampleOrVisit,
		xray_us_cnt: r.daLam.xrayUs,
		ct_endoscopy_cnt: r.daLam.ctEndoscopy,
		mri_bonedensity_cnt: r.daLam.mriBoneDensity,
		ecg_intervention_cnt: r.daLam.ecgIntervention,
		linen_media_cnt: r.daLam.linenMedia,
		tool_metal_cnt: r.daLam.toolMetal,
		tool_plastic_cnt: r.daLam.toolPlastic,
		supervised_dept_cnt: r.daLam.supervisedDept,
		pending_sample_or_visit_cnt: r.tonCho.sampleOrVisit,
		pending_xray_us_cnt: r.tonCho.xrayUs,
		pending_ct_endoscopy_cnt: r.tonCho.ctEndoscopy,
		pending_mri_bonedensity_cnt: r.tonCho.mriBoneDensity,
		pending_ecg_intervention_cnt: r.tonCho.ecgIntervention,
		pending_linen_cnt: r.tonCho.linen,
		pending_tool_metal_cnt: r.tonCho.toolMetal,
		pending_tool_plastic_cnt: r.tonCho.toolPlastic,
		total_staff: r.nl.tong,
		staff_on_duty: r.nl.nghiTruc,
		staff_long_leave: r.nl.nghiTren2Ngay,
		note: r.ghiChu,
	};
}

const sumWorkload = (w: DailyClsRecord['daLam']): number =>
	(w.sampleOrVisit ?? 0) +
	(w.xrayUs ?? 0) +
	(w.ctEndoscopy ?? 0) +
	(w.mriBoneDensity ?? 0) +
	(w.ecgIntervention ?? 0) +
	(w.linenMedia ?? 0) +
	(w.toolMetal ?? 0) +
	(w.toolPlastic ?? 0) +
	(w.supervisedDept ?? 0);

// ─────────────────────────────────────────────────────────────
// computeCls — tính từ draft đang nhập (dùng trong CLSStaffingForm)
// khuyenCao: giá trị khuyến cáo cố định của khoa (Dept_Recommended_Config,
// formula_type='fixed') — không phụ thuộc dữ liệu bản ghi nên truyền sẵn vào.
// ─────────────────────────────────────────────────────────────
export const computeCls = (
	r: DailyClsRecord,
	khuyenCao: number | null,
): ComputedClsStats => {
	const tongKhoiLuong = sumWorkload(r.daLam);
	const tong = r.nl.tong ?? 0;
	const nghiTruc = r.nl.nghiTruc ?? 0;
	const nghiTren2 = r.nl.nghiTren2Ngay ?? 0;
	const diLam = tong - nghiTruc - nghiTren2;
	const tyLe = tongKhoiLuong > 0 ? diLam / tongKhoiLuong : null;
	const chenhLech = khuyenCao !== null ? diLam - khuyenCao : null;

	return { tongKhoiLuong, diLam, tyLe, khuyenCao, chenhLech };
};

// ─────────────────────────────────────────────────────────────
// toKhoaClsRecord — map ApiClsRecord → KhoaClsRecord
// Dùng trong bảng tổng hợp 10 khoa CLS cho 1 ngày báo cáo.
// ─────────────────────────────────────────────────────────────
export const toKhoaClsRecord = (
	r: ApiClsRecord,
	tt: number,
): KhoaClsRecord => {
	const daLam = {
		sampleOrVisit: r.sample_or_visit_cnt,
		xrayUs: r.xray_us_cnt,
		ctEndoscopy: r.ct_endoscopy_cnt,
		mriBoneDensity: r.mri_bonedensity_cnt,
		ecgIntervention: r.ecg_intervention_cnt,
		linenMedia: r.linen_media_cnt,
		toolMetal: r.tool_metal_cnt,
		toolPlastic: r.tool_plastic_cnt,
		supervisedDept: r.supervised_dept_cnt,
	};
	const tonCho = {
		sampleOrVisit: r.pending_sample_or_visit_cnt,
		xrayUs: r.pending_xray_us_cnt,
		ctEndoscopy: r.pending_ct_endoscopy_cnt,
		mriBoneDensity: r.pending_mri_bonedensity_cnt,
		ecgIntervention: r.pending_ecg_intervention_cnt,
		linen: r.pending_linen_cnt,
		toolMetal: r.pending_tool_metal_cnt,
		toolPlastic: r.pending_tool_plastic_cnt,
	};

	const tongKhoiLuong =
		(r.sample_or_visit_cnt ?? 0) +
		(r.xray_us_cnt ?? 0) +
		(r.ct_endoscopy_cnt ?? 0) +
		(r.mri_bonedensity_cnt ?? 0) +
		(r.ecg_intervention_cnt ?? 0) +
		(r.linen_media_cnt ?? 0) +
		(r.tool_metal_cnt ?? 0) +
		(r.tool_plastic_cnt ?? 0) +
		(r.supervised_dept_cnt ?? 0);

	const nlTong = r.total_staff;
	const nghiTruc = r.staff_on_duty;
	const nghiTren2 = r.staff_long_leave;
	const diLam =
		r.staff_working ??
		(nlTong !== null ? nlTong - (nghiTruc ?? 0) - (nghiTren2 ?? 0) : null);

	// Khuyến cáo: ưu tiên giá trị đã lưu ở record, fallback tính lại từ cấu hình 'fixed'
	const khuyenCao =
		r.recommended_staff ??
		(r.rec_formula_type === 'fixed' ? (r.rec_fixed_add ?? null) : null);

	const tyLe =
		diLam !== null && tongKhoiLuong > 0 ? diLam / tongKhoiLuong : null;

	const chenhLech =
		r.coordination ??
		(diLam !== null && khuyenCao !== null ? diLam - khuyenCao : null);

	return {
		tt,
		id_department: r.id_department,
		code: r.code_department ?? null,
		ten: r.department_name,
		daLam,
		tonCho,
		nlTong,
		nghiTruc,
		nghiTren2,
		diLam,
		tongKhoiLuong,
		tyLe,
		khuyenCao,
		chenhLech,
		ghiChu: r.note,
	};
};

// ─────────────────────────────────────────────────────────────
// aggregateClsDashboardStats — tổng hợp dòng ∑ cho bảng
// ─────────────────────────────────────────────────────────────
export const aggregateClsDashboardStats = (rows: KhoaClsRecord[]) => {
	const sumField = (key: 'nlTong' | 'nghiTruc' | 'nghiTren2' | 'diLam' | 'tongKhoiLuong') =>
		rows.reduce((s, r) => s + (r[key] ?? 0), 0);

	const totalNL = sumField('nlTong');
	const totalDiLam = sumField('diLam');
	const totalKhoiLuong = sumField('tongKhoiLuong');
	const totalKhuyenCao = rows.reduce((s, r) => s + (r.khuyenCao ?? 0), 0);

	const khoaThieu = rows.filter((r) => (r.chenhLech ?? 0) < 0);
	const khoaDu = rows.filter(
		(r) => (r.chenhLech ?? 0) >= 0 && r.khuyenCao !== null,
	);

	return {
		totalNL,
		totalNghiTruc: sumField('nghiTruc'),
		totalNghiDai: sumField('nghiTren2'),
		totalDiLam,
		totalKhoiLuong,
		totalKhuyenCao,
		rateDiLam:
			totalKhoiLuong > 0 ? Math.round((totalDiLam / totalKhoiLuong) * 100) : 0,
		khoaThieu,
		khoaDu,
		tongThieu: khoaThieu.reduce((s, r) => s + Math.abs(r.chenhLech ?? 0), 0),
	};
};
