import type { ApiRecord } from '@/types/apiType';
import type { DateRecord, KhoaRecord } from '@/types/reportType';
import type {
	ComputedStats,
	DailyRecord,
	DeptConfig,
} from '@/types/staffingType';

// ── Hằng giờ chốt sổ ─────────────────────────────────────────
export const LOCK_HOUR = 23;
export const LOCK_MINUTE = 59;

export const isReportLocked = (
	targetDate: string,
	accessType: string | undefined,
): boolean => {
	if (accessType === 'all') return false;
	const now = new Date();
	const todayStr = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, '0'),
		String(now.getDate()).padStart(2, '0'),
	].join('-');
	if (targetDate > todayStr) return false;
	const lockAt = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		LOCK_HOUR,
		LOCK_MINUTE,
		0,
		0,
	);
	if (now >= lockAt) return true;
	return targetDate < todayStr;
};

export { isReportLocked as isDateEditable };

// ─────────────────────────────────────────────────────────────
// compute — tính từ DeptConfig local
// Dùng trong DailyStaffingBoard (hiển thị chi tiết 1 ngày của 1 khoa)
// ─────────────────────────────────────────────────────────────
export const compute = (r: DailyRecord, cfg: DeptConfig): ComputedStats => {
	const cap1 = r.nb.cap1 ?? 0;
	const cap2 = r.nb.cap2 ?? 0;
	const cap3 = r.nb.cap3 ?? 0;
	const tongNB = cap1 + cap2 + cap3;

	const tong = r.nl.tong ?? 0;
	const nghiTruc = r.nl.nghiTruc ?? 0;
	const nghiTren2 = r.nl.nghiTren2Ngay ?? 0;
	const diLam = tong - nghiTruc - nghiTren2;

	// ── Cột M: TT03 ──────────────────────────────────────────
	let tt03: number;
	switch (cfg.formulaType) {
		case 'icu':
			tt03 =
				((tongNB * cfg.heSo.patientRatio) / (cfg.heSo.shiftDivisor ?? 3)) *
				(cfg.heSo.shiftMultiplier ?? 2);
			break;
		case 'surgery':
			tt03 =
				(((cfg.giuongMay ?? 0) * cfg.heSo.patientRatio) /
					(cfg.heSo.shiftDivisor ?? 3)) *
				(cfg.heSo.shiftMultiplier ?? 2);
			break;
		case 'standard':
			tt03 =
				((tongNB * cfg.heSo.patientRatio) / (cfg.heSo.shiftDivisor ?? 3)) *
					(cfg.heSo.shiftMultiplier ?? 2) +
				(cfg.heSo.fixedAdd ?? 0);
			break;
		case 'custom_coef':
		default:
			tt03 =
				cap1 * cfg.heSo.cap1 +
				cap2 * cfg.heSo.cap2 +
				cap3 * cfg.heSo.cap3 +
				tongNB * cfg.heSo.tong;
			break;
	}

	// ── Cột N: Khuyến nghị (tính từ heSoRec nếu có) ─────────
	let khuyenNghi: number = 0;
	if (cfg.heSoRec && cfg.recFormulaType) {
		const rec = cfg.heSoRec;
		switch (cfg.recFormulaType) {
			case 'coef':
				khuyenNghi =
					cap1 * rec.coefL1 +
					cap2 * rec.coefL2 +
					cap3 * rec.coefL3 +
					(rec.fixedAdd ?? 0);

				break;
			case 'coef_with_total':
				khuyenNghi =
					cap1 * rec.coefL1 +
					cap2 * rec.coefL2 +
					cap3 * rec.coefL3 +
					tongNB * (rec.outpatientRatio ?? 0) +
					(rec.fixedAdd ?? 0);
				break;
			case 'coef_with_outpatient':
				khuyenNghi =
					cap1 * rec.coefL1 +
					cap2 * rec.coefL2 +
					cap3 * rec.coefL3 +
					(r.nbKhamPT ?? 0) * (rec.outpatientRatio ?? 0) +
					(rec.fixedAdd ?? 0);
				break;
			case 'total_ratio':
				khuyenNghi = tongNB * (rec.outpatientRatio ?? 0) + (rec.fixedAdd ?? 0);
				break;
			case 'outpatient_count':
				khuyenNghi =
					(r.nbKhamPT ?? 0) * (rec.outpatientRatio ?? 0) + (rec.fixedAdd ?? 0);
				break;
			case 'fixed':
				khuyenNghi = rec.fixedAdd ?? 0;
				break;
		}
	}

	// Điều phối dùng khuyenNghi nếu có config, fallback về tt03
	const hasRecConfig = !!(cfg.heSoRec && cfg.recFormulaType);
	const khuyenCao = hasRecConfig ? khuyenNghi : 0;
	const dieuPhoi = Math.ceil(diLam - khuyenNghi);

	return {
		tongNB,
		tt03,
		khuyenNghi: hasRecConfig ? khuyenNghi : null,
		khuyenCao,
		diLam,
		dieuPhoi,
	};
};

// ─────────────────────────────────────────────────────────────
// toKhoaRecord — map ApiRecord → KhoaRecord
// Dùng trong DailyStaffingBoardAll (bảng tổng hợp toàn bệnh viện)
// ─────────────────────────────────────────────────────────────
export const toKhoaRecord = (r: ApiRecord, tt: number): KhoaRecord => {
	const csc1 = r.patient_level_1 ?? 0;
	const csc2 = r.patient_level_2 ?? 0;
	const csc3 = r.patient_level_3 ?? 0;
	const tongNB = r.total_patients ?? csc1 + csc2 + csc3;

	const nghiTruc = r.staff_on_duty ?? 0;
	const nghiTren2 = r.staff_long_leave ?? 0;
	const nlTong = r.total_staff ?? 0;
	const diLam = r.staff_working ?? nlTong - nghiTruc - nghiTren2;

	// ── Cột M: TT03 ──────────────────────────────────────────
	// Ưu tiên: tt03_staff_calc (view tính lại) → recommended_staff (đã lưu) → tính lại tại chỗ
	let tt03: number;

	// Fallback: tính lại từ công thức TT03
	const formulaType = r.formula_type ?? 'custom_coef';
	const ratio = r.patient_ratio ?? 0.6;

	const divisor = r.shift_divisor ?? 3;
	const multiplier = r.shift_multiplier ?? 2;
	const fixedAdd = r.fixed_add ?? 0;
	const bedCount = r.bed_count ?? 0;
	switch (formulaType) {
		case 'icu':
			tt03 = ((tongNB * ratio) / divisor) * multiplier;
			break;
		case 'surgery':
			tt03 = ((bedCount * ratio) / divisor) * multiplier;
			console.log(bedCount);
			break;
		case 'standard':
			tt03 = ((tongNB * ratio) / divisor) * multiplier + fixedAdd;
			break;
		case 'custom_coef':
		default: {
			const c1 = r.coef_level_1 ?? 0.5;
			const c2 = r.coef_level_2 ?? 0.104;
			const c3 = r.coef_level_3 ?? 0.104;
			const ct = r.coef_total ?? 0.12;
			tt03 = csc1 * c1 + csc2 * c2 + csc3 * c3 + tongNB * ct;
			break;
		}
	}

	// ── Cột N: Khuyến nghị ───────────────────────────────────
	let khuyenNghi: number | null = null;
	if (r.rec_formula_type) {
		// Fallback: tính lại từ công thức khuyến nghị (đồng bộ với compute())
		const recFixedAdd = r.rec_fixed_add ?? 0;

		switch (r.rec_formula_type) {
			case 'coef':
				khuyenNghi =
					csc1 * (r.rec_coef_level_1 ?? 0) +
					csc2 * (r.rec_coef_level_2 ?? 0) +
					csc3 * (r.rec_coef_level_3 ?? 0) +
					recFixedAdd;
				break;
			case 'coef_with_total':
				khuyenNghi =
					csc1 * (r.rec_coef_level_1 ?? 0) +
					csc2 * (r.rec_coef_level_2 ?? 0) +
					csc3 * (r.rec_coef_level_3 ?? 0) +
					tongNB * (r.rec_outpatient_ratio ?? 0) +
					recFixedAdd;
				break;
			case 'coef_with_outpatient':
				khuyenNghi =
					csc1 * (r.rec_coef_level_1 ?? 0) +
					csc2 * (r.rec_coef_level_2 ?? 0) +
					csc3 * (r.rec_coef_level_3 ?? 0) +
					(r.outpatient_cnt ?? 0) * (r.rec_outpatient_ratio ?? 0) +
					recFixedAdd;
				break;
			case 'total_ratio':
				khuyenNghi = tongNB * (r.rec_outpatient_ratio ?? 0) + recFixedAdd;
				break;
			case 'outpatient_count':
				khuyenNghi =
					(r.outpatient_cnt ?? 0) * (r.rec_outpatient_ratio ?? 0) + recFixedAdd;
				break;
			case 'fixed':
				khuyenNghi = recFixedAdd;
				break;
		}
	}

	// Điều phối dùng khuyenNghi nếu có, fallback về tt03
	const khuyenCao = khuyenNghi ?? tt03;
	const dieuPhoi = Math.ceil(diLam - khuyenCao);

	return {
		tt,
		id_department: r.id_department,
		ten: r.department_name,
		giuong: r.bed_count ?? null,
		csc1,
		csc2,
		csc3,
		tongNB,
		nbKhamPT: r.outpatient_cnt ?? 0,
		nlTong,
		nghiTruc,
		nghiTren2,
		diLam,
		tt03,
		khuyenNghi,
		khuyenCao,
		dieuPhoi,
		recFormulaType: r.rec_formula_type ?? null,
		ghiChu: r.note ?? null,
	};
};

// ─────────────────────────────────────────────────────────────
// aggregateDashboardStats
// ─────────────────────────────────────────────────────────────
export const aggregateDashboardStats = (rows: KhoaRecord[]) => {
	const sum = (key: keyof KhoaRecord) =>
		rows.reduce((s, r) => s + ((r[key] as number) ?? 0), 0);

	const totalNL = sum('nlTong');
	const totalDiLam = sum('diLam');

	// Tổng TT03 (cột M) và Khuyến nghị (cột N) tách riêng
	const totalTT03 = sum('tt03');
	const totalKhuyenNghi = rows.reduce((s, r) => s + (r.khuyenNghi ?? 0), 0);
	// Tổng khuyenCao (dùng cho điều phối)
	const totalKC = sum('khuyenCao');

	const khoaThieu = rows.filter((r) => (r.dieuPhoi ?? 0) < 0);
	const khoaDu = rows.filter(
		(r) => (r.dieuPhoi ?? 0) >= 0 && r.khuyenCao !== null,
	);

	return {
		totalNB: sum('tongNB'),
		totalCSC1: sum('csc1'),
		totalCSC2: sum('csc2'),
		totalCSC3: sum('csc3'),
		totalNBKham: sum('nbKhamPT'),
		totalNL,
		totalDiLam,
		totalNghiTruc: sum('nghiTruc'),
		totalNghiDai: sum('nghiTren2'),
		/** Tổng cột M — TT03 */
		totalTT03,
		/** Tổng cột N — Khuyến nghị (0 cho khoa chưa có config) */
		totalKhuyenNghi,
		/** Tổng khuyenCao dùng để so sánh với diLam */
		totalKC,
		rateDiLam: totalNL > 0 ? Math.round((totalDiLam / totalNL) * 100) : 0,
		khoaThieu,
		khoaDu,
		tongThieu: khoaThieu.reduce((s, r) => s + Math.abs(r.dieuPhoi ?? 0), 0),
		top5Thieu: [...khoaThieu]
			.sort((a, b) => (a.dieuPhoi ?? 0) - (b.dieuPhoi ?? 0))
			.slice(0, 6),
	};
};

// ─────────────────────────────────────────────────────────────
// getTrendStats
// ─────────────────────────────────────────────────────────────
export const getTrendStats = (multiDayData: DateRecord[], days = 7) => {
	const trend = multiDayData.slice(-days).map((d) => ({
		date: d.date,
		nb: d.data.reduce((s, r) => s + (r.tongNB ?? 0), 0),
		nl: d.data.reduce((s, r) => s + (r.diLam ?? 0), 0),
	}));
	return {
		trend7: trend,
		maxTrendNB: Math.max(...trend.map((t) => t.nb), 1),
		maxTrendNL: Math.max(...trend.map((t) => t.nl), 1),
	};
};
