const {
	calcTT03,
	calcRecommended,
	fetchTT03Config,
	fetchRecommendedConfig,
} = require('./tt03Formulas');

// ── Helper: lấy cấu hình TT03 cho 1 khoa ────────────────────────────────
// (giữ nguyên để không break logic cũ)
async function fetchTT03ConfigLocal(pool, id_department) {
	return fetchTT03Config(pool, id_department);
}

// ── Helper: tính cả recommended_staff (TT03) và recommended_staff_calc ──
// Trả về { recommended, recommendedCalc }
async function resolveBothRecommended(pool, record) {
	// TT03: override nếu frontend gửi lên
	let recommended =
		record.recommended_staff !== undefined && record.recommended_staff !== null
			? record.recommended_staff
			: null;

	let recommendedCalc =
		record.recommended_staff_calc !== undefined &&
		record.recommended_staff_calc !== null
			? record.recommended_staff_calc
			: null;

	if (!record.id_department) return { recommended, recommendedCalc };

	const [cfgTT03, cfgRec] = await Promise.all([
		recommended === null
			? fetchTT03Config(pool, record.id_department)
			: Promise.resolve(null),
		recommendedCalc === null
			? fetchRecommendedConfig(pool, record.id_department)
			: Promise.resolve(null),
	]);

	if (recommended === null && cfgTT03) {
		const raw = calcTT03(record, cfgTT03, cfgTT03);
		recommended = raw !== null ? Math.ceil(raw) : null;
	}

	if (recommendedCalc === null && cfgRec) {
		const raw = calcRecommended(record, cfgRec);
		recommendedCalc = raw !== null ? Math.ceil(raw) : null;
	}

	return { recommended, recommendedCalc };
}

module.exports = {
	fetchTT03ConfigLocal,
	resolveBothRecommended,
};
