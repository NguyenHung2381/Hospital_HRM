const { calcTT03, calcKN } = require('./reportRowFormulas');
const {
	toDateStr,
	getGroupKey,
	formatGroupLabel,
} = require('../utils/reportDateGrouping');

// ── Group raw records theo khoa ────────────────────────────
function groupByDepartment(rawRecords) {
	const map = new Map();
	for (const r of rawRecords) {
		const key = String(r.id_department);
		if (!map.has(key)) {
			map.set(key, {
				id_department: r.id_department,
				name_department: r.name_department,
				bed_count: r.bed_count,
				records: [],
			});
		}
		map.get(key).records.push(r);
	}
	return Array.from(map.values());
}

// ── Aggregate một mảng records → 1 dòng tổng hợp ────────
function aggregateRecords(records) {
	if (!records || records.length === 0) return null;
	let l1 = 0,
		l2 = 0,
		l3 = 0,
		ngoai = 0,
		nb = 0;
	let nv = 0,
		truc = 0,
		nghi = 0,
		lv = 0;
	let tt03 = 0,
		kn = 0,
		knCount = 0;

	for (const r of records) {
		l1 += r.patient_level_1 ?? 0;
		l2 += r.patient_level_2 ?? 0;
		l3 += r.patient_level_3 ?? 0;
		ngoai += r.outpatient_cnt ?? 0;
		// Tính lại tổng NB từ CSC1+CSC2+CSC3 thay vì dùng total_patients
		// vì total_patients trong DB thường NULL hoặc không đồng bộ
		nb +=
			(r.patient_level_1 ?? 0) +
			(r.patient_level_2 ?? 0) +
			(r.patient_level_3 ?? 0);
		nv += r.total_staff ?? 0;
		truc += r.staff_on_duty ?? 0;
		nghi += r.staff_long_leave ?? 0;
		lv += r.staff_working ?? 0;
		// Không ceil từng record — tích lũy float rồi ceil ở cuối (giống TS)
		tt03 += calcTT03(r);
		const knRaw = calcKN(r);
		if (knRaw !== null) {
			kn += knRaw;
			knCount++;
		}
	}

	const knVal = knCount > 0 ? kn : null;
	// Điều phối: Math.ceil(diLam - khuyenCao), fallback KN → TT03 (giống toKhoaRecord trong TS)
	const khuyenCao = knVal !== null ? knVal : tt03;
	return {
		l1,
		l2,
		l3,
		ngoai,
		nb,
		nv,
		truc,
		nghi,
		lv,
		tt03,
		kn: knVal,
		dieu_phoi_tt03: Math.ceil(lv - tt03),
		dieu_phoi_kn: knVal !== null ? Math.ceil(lv - knVal) : null,
		// dieuPhoi chuẩn: luôn dùng khuyenCao (KN nếu có, fallback TT03)
		dieu_phoi: Math.ceil(lv - khuyenCao),
	};
}

// ── Gom records theo groupBy cho 1 khoa ──────────────────
function groupKhoaByPeriod(khoaRecords, allDays, groupBy) {
	// Build map: dateStr → record
	const byDate = new Map();
	for (const r of khoaRecords) {
		byDate.set(toDateStr(r.report_date), r);
	}

	// Build groups: groupKey → list of records (or null per day)
	const groupMap = new Map(); // groupKey → { label, records[] }
	for (const day of allDays) {
		const gkey = getGroupKey(day, groupBy);
		if (!groupMap.has(gkey)) {
			groupMap.set(gkey, {
				label: formatGroupLabel(gkey, groupBy),
				records: [],
			});
		}
		const rec = byDate.get(day);
		if (rec) groupMap.get(gkey).records.push(rec);
	}

	return Array.from(groupMap.values());
}

// ── Gom nhóm kỳ cho sheet tổng hợp toàn viện + đếm số khoa thiếu NL/ngày ──
function buildSummaryGroups(raw, allDays, groupBy) {
	const groupMap = new Map();
	for (const day of allDays) {
		const gkey = getGroupKey(day, groupBy);
		if (!groupMap.has(gkey)) {
			groupMap.set(gkey, {
				label: formatGroupLabel(gkey, groupBy),
				records: [],
				khoaThieu: 0,
			});
		}
	}
	// Gom tất cả record của ngày vào nhóm
	for (const r of raw) {
		const dateStr = toDateStr(r.report_date);
		const gkey = getGroupKey(dateStr, groupBy);
		if (groupMap.has(gkey)) {
			groupMap.get(gkey).records.push(r);
		}
	}
	// Đếm số khoa thiếu NL theo ngày rồi tổng hợp theo nhóm
	const byDayKhoaThieu = new Map();
	const byDayRecords = new Map();
	for (const r of raw) {
		const dateStr = toDateStr(r.report_date);
		if (!byDayRecords.has(dateStr)) byDayRecords.set(dateStr, []);
		byDayRecords.get(dateStr).push(r);
	}
	for (const [dateStr, recs] of byDayRecords) {
		let thieu = 0;
		for (const r of recs) {
			const knRaw = calcKN(r);
			// Giống TS: fallback về TT03 nếu không có KN config
			const khuyenCao = knRaw !== null ? knRaw : calcTT03(r);
			const diLam = r.staff_working ?? 0;
			// Dung dung cong thuc TS: Math.ceil(diLam - khuyenCao) < 0
			if (Math.ceil(diLam - khuyenCao) < 0) thieu++;
		}
		byDayKhoaThieu.set(dateStr, thieu);
	}
	for (const day of allDays) {
		const gkey = getGroupKey(day, groupBy);
		const g = groupMap.get(gkey);
		if (g && byDayKhoaThieu.has(day)) {
			g.khoaThieu += byDayKhoaThieu.get(day);
		}
	}
	return Array.from(groupMap.values());
}




module.exports = {
	groupByDepartment,
	aggregateRecords,
	groupKhoaByPeriod,
	buildSummaryGroups,
};
