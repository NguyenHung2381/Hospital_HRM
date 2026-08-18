// ── Tính toán TT03 & Khuyến nghị trên 1 dòng SQL đã join phẳng (dùng riêng
// cho exportReports.js — khác cấu trúc input với services/tt03Formulas.js
// vốn nhận record + cfg tách rời, nên KHÔNG dùng chung để tránh lệch logic). ──

function calcTT03(r) {
	const l1 = r.patient_level_1 ?? 0;
	const l2 = r.patient_level_2 ?? 0;
	const l3 = r.patient_level_3 ?? 0;
	// Tính tổng NB từ CSC1+CSC2+CSC3, fallback về total_patients nếu cả 3 đều 0
	const tongNB = (l1 + l2 + l3) || (r.total_patients ?? 0);
	const formulaType = r.formula_type ?? 'custom_coef';
	const ratio = parseFloat(r.patient_ratio ?? 0.6);
	const divisor = r.shift_divisor ?? 3;
	const multiplier = r.shift_multiplier ?? 2;
	const fixedAdd = parseFloat(r.fixed_add ?? 0);
	const bedCount = r.bed_count ?? 0;

	switch (formulaType) {
		case 'icu':
			return ((tongNB * ratio) / divisor) * multiplier;
		case 'surgery':
			return ((bedCount * ratio) / divisor) * multiplier;
		case 'standard':
			return ((tongNB * ratio) / divisor) * multiplier + fixedAdd;
		case 'custom_coef':
		default: {
			const c1 = parseFloat(r.coef_level_1 ?? 0.5);
			const c2 = parseFloat(r.coef_level_2 ?? 0.104);
			const c3 = parseFloat(r.coef_level_3 ?? 0.104);
			const ct = parseFloat(r.coef_total ?? 0.12);
			return l1 * c1 + l2 * c2 + l3 * c3 + tongNB * ct;
		}
	}
}

function calcKN(r) {
	if (!r.rec_formula_type) return null;
	const l1 = r.patient_level_1 ?? 0;
	const l2 = r.patient_level_2 ?? 0;
	const l3 = r.patient_level_3 ?? 0;
	const tongNB = (l1 + l2 + l3) || (r.total_patients ?? 0);
	const outpatient = r.outpatient_cnt ?? 0;
	const fixedAdd = parseFloat(r.rec_fixed_add ?? 0);
	const coefL1 = parseFloat(r.rec_coef_level_1 ?? 0);
	const coefL2 = parseFloat(r.rec_coef_level_2 ?? 0);
	const coefL3 = parseFloat(r.rec_coef_level_3 ?? 0);
	const outRatio = parseFloat(r.rec_outpatient_ratio ?? 0);

	switch (r.rec_formula_type) {
		case 'coef':
			return l1 * coefL1 + l2 * coefL2 + l3 * coefL3 + fixedAdd;
		case 'coef_with_total':
			return (
				l1 * coefL1 + l2 * coefL2 + l3 * coefL3 + tongNB * outRatio + fixedAdd
			);
		case 'coef_with_outpatient':
			return (
				l1 * coefL1 +
				l2 * coefL2 +
				l3 * coefL3 +
				outpatient * outRatio +
				fixedAdd
			);
		case 'total_ratio':
			return tongNB * outRatio + fixedAdd;
		case 'outpatient_count':
			return outpatient * outRatio + fixedAdd;
		default:
			return null;
	}
}

module.exports = { calcTT03, calcKN };
