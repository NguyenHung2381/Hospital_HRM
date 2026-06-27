/**
 * exportReports.js  —  GET /api/reports/export
 *
 * Query params:
 *   from        YYYY-MM-DD  (bắt buộc)
 *   to          YYYY-MM-DD  (bắt buộc)
 *   department  number | 'all'  (mặc định: all)
 *   groupBy     'day' | 'week' | 'month' | 'year'  (mặc định: 'day')
 *
 * Cấu trúc file Excel (xuất theo TỪNG KHOA):
 *   Sheet duy nhất — mỗi dòng = 1 ngày/tuần/tháng/năm
 *   Giống file mẫu: TT | Tên khoa | Giường/máy | NB(CSC1,CSC2,CSC3) | Tổng NB | NB ngoại trú | NV(Tổng,Nghỉ trực,Nghỉ>2ng) | Đi làm | TT03 | KN | Điều phối
 *
 * Cấu trúc file Excel (xuất TOÀN BỘ BỆNH VIỆN):
 *   Sheet 1 — "Tổng hợp"   : tổng hợp theo ngày toàn BV
 *     Cột: STT | Kỳ báo cáo | CSC1 | CSC2 | CSC3 | Tổng NB | NB ngoại trú/PT | Tổng NV | Nghỉ trực | Nghỉ>2ng | NV đi làm | Số khoa thiếu NL | TT03 toàn BV | Điều phối NL
 *   Sheet 2..N — mỗi sheet = 1 khoa, format giống file mẫu
 *
 * npm install exceljs
 */

const ExcelJS = require('exceljs');
const { getPool, sql } = require('../config/db');

// ── Palette ──────────────────────────────────────────────
const C = {
	hdrDark: 'FF1B2A4A',
	hdrBlue: 'FF1F4E79',
	subBlue: 'FF2E75B6',
	accent: 'FF4472C4',
	rowA: 'FFEBF3FB',
	rowB: 'FFF7FBFF',
	greenBg: 'FFE2EFDA',
	greenTxt: 'FF375623',
	redTxt: 'FFC00000',
	orangeBg: 'FFFCE4D6',
	gold: 'FF7F6000',
	white: 'FFFFFFFF',
	totalBg: 'FFD9E1F2',
	totalTxt: 'FF1F3864',
	noData: 'FFF2F2F2',
};

function fnt({
	bold = false,
	color = '1B2A4A',
	size = 10,
	italic = false,
} = {}) {
	return { name: 'Arial', bold, color: { argb: 'FF' + color }, size, italic };
}
function al(h = 'center', wrap = false) {
	return { horizontal: h, vertical: 'middle', wrapText: wrap };
}
function sf(argb) {
	return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function tb(color = 'BBBBBB') {
	const s = { style: 'thin', color: { argb: 'FF' + color } };
	return { top: s, left: s, bottom: s, right: s };
}

// ════════════════════════════════════════════════════════════
// TÍNH TOÁN TT03 & KHUYẾN NGHỊ
// ════════════════════════════════════════════════════════════
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

// ── Lấy raw records ──────────────────────────────────────
async function fetchRawRecords(pool, { from, to, department }) {
	const req = pool.request();
	req.input('from', sql.Date, from);
	req.input('to', sql.Date, to);

	const deptFilter =
		department && department !== 'all' ? 'AND rdr.id_department = @dept' : '';
	if (department && department !== 'all') {
		req.input('dept', sql.Int, Number(department));
	}

	const result = await req.query(`
		SELECT
			dr.report_date,
			dr.report_code,
			d.id_department,
			d.name_department,
			ISNULL(rdr.patient_level_1,  0) AS patient_level_1,
			ISNULL(rdr.patient_level_2,  0) AS patient_level_2,
			ISNULL(rdr.patient_level_3,  0) AS patient_level_3,
			ISNULL(rdr.outpatient_cnt,   0) AS outpatient_cnt,
			ISNULL(rdr.total_patients,   0) AS total_patients,
			ISNULL(rdr.total_staff,      0) AS total_staff,
			ISNULL(rdr.staff_on_duty,    0) AS staff_on_duty,
			ISNULL(rdr.staff_long_leave, 0) AS staff_long_leave,
			ISNULL(rdr.staff_working,
				ISNULL(rdr.total_staff,0) - ISNULL(rdr.staff_on_duty,0) - ISNULL(rdr.staff_long_leave,0)
			) AS staff_working,
			d.bed_count,
			d.coef_level_1, d.coef_level_2, d.coef_level_3, d.coef_total,
			tt03cfg.formula_type,
			tt03cfg.patient_ratio,
			tt03cfg.shift_divisor,
			tt03cfg.shift_multiplier,
			tt03cfg.fixed_add,
			rec.formula_type     AS rec_formula_type,
			rec.coef_l1          AS rec_coef_level_1,
			rec.coef_l2          AS rec_coef_level_2,
			rec.coef_l3          AS rec_coef_level_3,
			rec.outpatient_ratio AS rec_outpatient_ratio,
			rec.fixed_add        AS rec_fixed_add
		FROM Daily_Reports dr
		INNER JOIN [Report_Department_Records ] rdr ON rdr.id_report = dr.id_report
		LEFT JOIN  Departments d             ON d.id_department       = rdr.id_department
		LEFT JOIN  Dept_TT03_Config tt03cfg  ON tt03cfg.id_department = rdr.id_department
		LEFT JOIN  Dept_Recommended_Config rec ON rec.id_department   = rdr.id_department
		WHERE dr.report_date BETWEEN @from AND @to
		  ${deptFilter}
		ORDER BY dr.report_date ASC, d.name_department ASC
	`);
	return result.recordset;
}

// ── Tiện ích ngày ─────────────────────────────────────────
function toDateStr(d) {
	if (d instanceof Date) {
		// Dung local time thay vi UTC (toISOString tra UTC → lech -1 ngay voi UTC+7)
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	return String(d).slice(0, 10);
}

// Lấy tất cả các ngày trong khoảng [from, to]
function enumerateDays(from, to) {
	const days = [];
	const cur = new Date(from + 'T00:00:00');
	const end = new Date(to + 'T00:00:00');
	while (cur <= end) {
		// Dung local time thay vi toISOString (UTC) de tranh lech ngay cuoi
		days.push(toDateStr(cur));
		cur.setDate(cur.getDate() + 1);
	}
	return days;
}

// Nhóm ngày theo groupBy
function getGroupKey(dateStr, groupBy) {
	const d = new Date(dateStr + 'T00:00:00');
	switch (groupBy) {
		case 'week': {
			// ISO week: lấy thứ Hai đầu tuần
			const day = d.getDay() || 7;
			const monday = new Date(d);
			monday.setDate(d.getDate() - day + 1);
			return `Tuần ${toDateStr(monday)}`;
		}
		case 'month':
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		case 'year':
			return String(d.getFullYear());
		default:
			return dateStr;
	}
}

function formatGroupLabel(key, groupBy) {
	switch (groupBy) {
		case 'week':
			return key; // "Tuần 2024-01-01"
		case 'month': {
			const [y, m] = key.split('-');
			return `Tháng ${parseInt(m)}/${y}`;
		}
		case 'year':
			return `Năm ${key}`;
		default:
			return key;
	}
}

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

// ════════════════════════════════════════════════════════════
// BUILD SHEET THEO MẪU (1 khoa, nhiều dòng theo kỳ)
// ════════════════════════════════════════════════════════════
function buildDeptSheet(ws, khoaInfo, groups, { from, to, groupBy }) {
	const { name_department, bed_count } = khoaInfo;
	const totalCols = 15; // A..O

	ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
	ws.properties.defaultRowHeight = 18;

	// ── Hàng 1: Tiêu đề ──
	ws.mergeCells(`A1:O1`);
	Object.assign(ws.getCell('A1'), {
		value: 'BẢNG THEO DÕI NHÂN LỰC ĐD – HỘ SINH – KTV',
		font: fnt({ bold: true, color: 'FFFFFF', size: 14 }),
		fill: sf(C.hdrDark),
		alignment: al('center'),
	});
	ws.getRow(1).height = 30;

	// ── Hàng 2: Thông tin kỳ ──
	ws.mergeCells(`A2:O2`);
	Object.assign(ws.getCell('A2'), {
		value: `Khoa: ${name_department}   |   Kỳ: ${from} → ${to}   |   Xuất lúc: ${new Date().toLocaleString('vi-VN')}`,
		font: fnt({ italic: true, color: 'FFFFFF', size: 10 }),
		fill: sf(C.hdrBlue),
		alignment: al('center'),
	});
	ws.getRow(2).height = 20;

	// ── Hàng 3: Nhóm cột ──
	const merges3 = [
		['A3', 'A4', 'STT', true],
		['B3', 'B4', 'Kỳ báo cáo', true],
		['C3', 'C4', 'Giường/máy', true],
		['D3', 'F3', 'Số người bệnh', false],
		['G3', 'G4', 'Tổng NB', true],
		['H3', 'H4', 'NB ngoại trú / PT kế hoạch', true],
		['I3', 'L3', 'Nhân lực (ĐD – HS – KTV)', false],
		['M3', 'M4', 'NL TT03', true],
		['N3', 'N4', 'NL Khuyến nghị', true],
		['O3', 'O4', 'Điều phối NL (so KN)', true],
	];

	merges3.forEach(([s, e, label, mergeDown]) => {
		if (mergeDown) {
			ws.mergeCells(`${s}:${e}`);
		} else if (s !== e) {
			ws.mergeCells(`${s}:${e}`);
		}
		const c = ws.getCell(s);
		c.value = label;
		c.font = fnt({ bold: true, color: 'FFFFFF', size: 9 });
		c.fill = sf(
			label === 'STT' || label === 'Kỳ báo cáo' ? C.hdrDark : C.accent,
		);
		c.alignment = al('center', true);
		c.border = tb();
	});
	ws.getRow(3).height = 26;

	// ── Hàng 4: Sub-headers ──
	const sub4 = [
		[4, 'CSC1'],
		[5, 'CSC2'],
		[6, 'CSC3'],
		[9, 'Tổng'],
		[10, 'Nghỉ trực'],
		[11, 'Nghỉ >2 ngày'],
		[12, 'Đi làm'],
	];
	sub4.forEach(([col, label]) => {
		const c = ws.getCell(4, col);
		c.value = label;
		c.font = fnt({ bold: true, color: 'FFFFFF', size: 8 });
		c.fill = sf(C.subBlue);
		c.alignment = al('center', true);
		c.border = tb();
	});
	ws.getRow(4).height = 28;

	// ── Dữ liệu ──
	const DR = 5;
	let stt = 1;
	let sumL1 = 0,
		sumL2 = 0,
		sumL3 = 0,
		sumNgoai = 0,
		sumNb = 0;
	let sumNv = 0,
		sumTruc = 0,
		sumNghi = 0,
		sumLv = 0;
	let sumTT03 = 0,
		sumKn = 0,
		knHasData = false;
	let sumDP = 0;

	groups.forEach((g, gi) => {
		const row = DR + gi;
		const bg = gi % 2 === 0 ? C.rowA : C.rowB;

		const agg = aggregateRecords(g.records);

		if (!agg) {
			// Không có dữ liệu ngày này
			const noDataCell = ws.getCell(row, 1);
			noDataCell.value = stt++;
			noDataCell.fill = sf(C.noData);
			noDataCell.font = fnt({ size: 9, color: '888888' });
			noDataCell.alignment = al('center');
			noDataCell.border = tb();

			const labelCell = ws.getCell(row, 2);
			labelCell.value = g.label;
			labelCell.fill = sf(C.noData);
			labelCell.font = fnt({ size: 9, color: '888888', italic: true });
			labelCell.alignment = al('left');
			labelCell.border = tb();

			ws.mergeCells(row, 3, row, totalCols);
			const ndCell = ws.getCell(row, 3);
			ndCell.value = '— Không có dữ liệu —';
			ndCell.fill = sf(C.noData);
			ndCell.font = fnt({ size: 9, color: 'AAAAAA', italic: true });
			ndCell.alignment = al('center');
			ndCell.border = tb();

			ws.getRow(row).height = 18;
			return;
		}

		// Cột A: STT
		const cA = ws.getCell(row, 1);
		cA.value = stt++;
		cA.fill = sf(bg);
		cA.font = fnt({ size: 9 });
		cA.alignment = al('center');
		cA.border = tb();

		// Cột B: Kỳ báo cáo
		const cB = ws.getCell(row, 2);
		cB.value = g.label;
		cB.fill = sf(bg);
		cB.font = fnt({ bold: true, size: 9, color: '1F4E79' });
		cB.alignment = al('left');
		cB.border = tb();

		// Cột C: Giường/máy
		const cC = ws.getCell(row, 3);
		cC.value = gi === 0 ? (bed_count ?? '') : '';
		cC.fill = sf(bg);
		cC.font = fnt({ size: 9 });
		cC.alignment = al('center');
		cC.border = tb();

		// D E F: CSC1 CSC2 CSC3
		const isDay = groupBy === 'day';
		const csc1 = isDay ? agg.l1 : agg.l1;
		const csc2 = isDay ? agg.l2 : 0;
		const csc3 = isDay ? agg.l3 : 0;

		[
			[4, csc1],
			[5, csc2],
			[6, csc3],
		].forEach(([col, val]) => {
			const c = ws.getCell(row, col);
			c.value = val;
			c.fill = sf(bg);
			c.font = fnt({ size: 9 });
			c.alignment = al('center');
			c.border = tb();
		});

		// G: Tổng NB
		const cG = ws.getCell(row, 7);
		cG.value = agg.nb;
		cG.fill = sf(bg);
		cG.font = fnt({ size: 9 });
		cG.alignment = al('center');
		cG.border = tb();

		// H: NB ngoại trú / PT KH
		const cH = ws.getCell(row, 8);
		cH.value = agg.ngoai;
		cH.fill = sf(bg);
		cH.font = fnt({ size: 9 });
		cH.alignment = al('center');
		cH.border = tb();

		// I J K L: Tổng NV, Nghỉ trực, Nghỉ >2 ngày, Đi làm
		[
			[9, agg.nv],
			[10, agg.truc],
			[11, agg.nghi],
			[12, agg.lv],
		].forEach(([col, val]) => {
			const c = ws.getCell(row, col);
			c.value = val;
			c.fill = sf(bg);
			c.font = fnt({ size: 9 });
			c.alignment = al('center');
			c.border = tb();
		});

		// M: TT03
		const cM = ws.getCell(row, 13);
		cM.value = parseFloat(agg.tt03.toFixed(1));
		cM.fill = sf(bg);
		cM.font = fnt({ size: 9 });
		cM.alignment = al('center');
		cM.border = tb();

		// N: KN
		const cN = ws.getCell(row, 14);
		cN.value = agg.kn !== null ? parseFloat(agg.kn.toFixed(1)) : '—';
		cN.fill = sf(bg);
		cN.font = fnt({ size: 9 });
		cN.alignment = al('center');
		cN.border = tb();

		// O: Điều phối so KN (ưu tiên KN, fallback TT03) — Math.ceil giống TS
		const cO = ws.getCell(row, 15);
		const dp = agg.dieu_phoi;
		cO.value = dp;
		cO.fill = sf(bg);
		cO.alignment = al('center');
		cO.border = tb();
		if (dp > 0) cO.font = fnt({ bold: true, size: 9, color: '375623' });
		else if (dp < 0) {
			cO.font = fnt({ bold: true, size: 9, color: 'C00000' });
			cO.fill = sf(C.orangeBg);
		} else cO.font = fnt({ size: 9 });

		ws.getRow(row).height = 20;

		// Tích lũy
		sumL1 += agg.l1;
		sumL2 += agg.l2;
		sumL3 += agg.l3;
		sumNgoai += agg.ngoai;
		sumNb += agg.nb;
		sumNv += agg.nv;
		sumTruc += agg.truc;
		sumNghi += agg.nghi;
		sumLv += agg.lv;
		sumTT03 += agg.tt03;
		if (agg.kn !== null) {
			sumKn += agg.kn;
			knHasData = true;
		}
		sumDP += agg.dieu_phoi;
	});

	// ── Dòng TỔNG ──
	const totRow = DR + groups.length;
	ws.getRow(totRow).height = 24;

	const setTot = (col, val, extraFn) => {
		const c = ws.getCell(totRow, col);
		c.value = val;
		c.fill = sf(C.totalBg);
		c.border = tb();
		c.font = fnt({ bold: true, color: '1F3864', size: 9 });
		c.alignment = al('center');
		if (extraFn) extraFn(c);
	};

	ws.mergeCells(totRow, 1, totRow, 2);
	Object.assign(ws.getCell(totRow, 1), {
		value: 'TỔNG KỲ',
		font: fnt({ bold: true, color: '1F3864', size: 10 }),
		fill: sf(C.totalBg),
		alignment: al('center'),
		border: tb(),
	});

	setTot(3, '');
	setTot(4, sumL1);
	setTot(5, sumL2);
	setTot(6, sumL3);
	setTot(7, sumNb);
	setTot(8, sumNgoai);
	setTot(9, sumNv);
	setTot(10, sumTruc);
	setTot(11, sumNghi);
	setTot(12, sumLv);
	setTot(13, parseFloat(sumTT03.toFixed(1)));
	setTot(14, knHasData ? parseFloat(sumKn.toFixed(1)) : '—');
	const totDP = sumDP;
	setTot(15, totDP, (c) => {
		if (totDP > 0) c.font = fnt({ bold: true, size: 9, color: '375623' });
		else if (totDP < 0) {
			c.font = fnt({ bold: true, size: 9, color: 'C00000' });
			c.fill = sf(C.orangeBg);
		}
	});

	// ── Column widths (A..O) ──
	const widths = [5, 18, 10, 7, 7, 7, 9, 14, 8, 9, 11, 9, 9, 12, 11];
	widths.forEach((w, i) => {
		ws.getColumn(i + 1).width = w;
	});

	ws.pageSetup = {
		orientation: 'landscape',
		paperSize: 9,
		fitToPage: true,
		fitToWidth: 1,
		printTitlesRow: '1:4',
	};
}

// ════════════════════════════════════════════════════════════
// SHEET TỔNG HỢP TOÀN BỆNH VIỆN
// Cột: STT | Kỳ báo cáo | CSC1 | CSC2 | CSC3 | Tổng NB | NB ngoại trú/PT
//      | Tổng NV | Nghỉ trực | Nghỉ>2ng | NV đi làm
//      | Số khoa thiếu NL | TT03 toàn BV | Điều phối NL
// ════════════════════════════════════════════════════════════
function buildSummarySheet(ws, allGroups, { from, to, groupBy }) {
	ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
	ws.properties.defaultRowHeight = 18;

	// 14 cột: A..N
	const totalCols = 14;
	const lastCol = 'N';

	// ── Hàng 1: Tiêu đề ──
	ws.mergeCells(`A1:${lastCol}1`);
	Object.assign(ws.getCell('A1'), {
		value: 'TỔNG HỢP NHÂN LỰC TOÀN BỆNH VIỆN — ĐD – HỘ SINH – KTV',
		font: fnt({ bold: true, color: 'FFFFFF', size: 14 }),
		fill: sf(C.hdrDark),
		alignment: al('center'),
	});
	ws.getRow(1).height = 30;

	// ── Hàng 2: Thông tin kỳ ──
	ws.mergeCells(`A2:${lastCol}2`);
	Object.assign(ws.getCell('A2'), {
		value: `Kỳ báo cáo: ${from} → ${to}   |   Xuất lúc: ${new Date().toLocaleString('vi-VN')}`,
		font: fnt({ italic: true, color: 'FFFFFF', size: 10 }),
		fill: sf(C.hdrBlue),
		alignment: al('center'),
	});
	ws.getRow(2).height = 20;

	// ── Hàng 3: Nhóm cột ──
	// Col 1:  STT            (merge xuống hàng 4)
	// Col 2:  Kỳ báo cáo     (merge xuống hàng 4)
	// Col 3-5: Số người bệnh  (CSC1, CSC2, CSC3 — sub ở hàng 4)
	// Col 6:  Tổng NB         (merge xuống hàng 4)
	// Col 7:  NB ngoại trú/PT (merge xuống hàng 4)
	// Col 8-11: Nhân viên     (Tổng NV, Nghỉ trực, Nghỉ>2ng, Đi làm — sub ở hàng 4)
	// Col 12: Số khoa thiếu NL (merge xuống hàng 4)
	// Col 13: TT03 toàn BV    (merge xuống hàng 4)
	// Col 14: NL Khuyến nghị  (merge xuống hàng 4)

	// Merge header hàng 3
	const hdrMerges = [
		{ s: [3, 1], e: [4, 1], label: 'STT' },
		{ s: [3, 2], e: [4, 2], label: 'Kỳ báo cáo' },
		{ s: [3, 3], e: [3, 5], label: 'Số người bệnh' },
		{ s: [3, 6], e: [4, 6], label: 'Tổng NB' },
		{ s: [3, 7], e: [4, 7], label: 'NB ngoại trú / PT kế hoạch' },
		{ s: [3, 8], e: [3, 11], label: 'Nhân viên (ĐD – HS – KTV)' },
		{ s: [3, 12], e: [4, 12], label: 'Số khoa\nkhông đủ NL' },
		{ s: [3, 13], e: [4, 13], label: 'TT03 toàn BV' },
		{ s: [3, 14], e: [4, 14], label: 'NL Khuyến nghị' },
	];

	hdrMerges.forEach(({ s, e, label }) => {
		ws.mergeCells(s[0], s[1], e[0], e[1]);
		const c = ws.getCell(s[0], s[1]);
		c.value = label;
		c.font = fnt({ bold: true, color: 'FFFFFF', size: 9 });
		c.fill = sf(['STT', 'Kỳ báo cáo'].includes(label) ? C.hdrDark : C.accent);
		c.alignment = al('center', true);
		c.border = tb();
	});
	ws.getRow(3).height = 28;

	// ── Hàng 4: Sub-headers ──
	// Cột 3,4,5: CSC1, CSC2, CSC3  (dưới "Số người bệnh")
	// Cột 8,9,10,11: Tổng NV, Nghỉ trực, Nghỉ>2ng, Đi làm  (dưới "Nhân viên")
	const sub4 = [
		[3, 'CSC1'],
		[4, 'CSC2'],
		[5, 'CSC3'],
		[8, 'Tổng NV'],
		[9, 'Nghỉ trực'],
		[10, 'Nghỉ >2 ngày'],
		[11, 'NV đi làm'],
	];
	sub4.forEach(([col, label]) => {
		const c = ws.getCell(4, col);
		c.value = label;
		c.font = fnt({ bold: true, color: 'FFFFFF', size: 8 });
		c.fill = sf(C.subBlue);
		c.alignment = al('center', true);
		c.border = tb();
	});
	ws.getRow(4).height = 28;

	// ── Dữ liệu ──
	const DR = 5;
	let stt = 1;
	// Tổng cộng cả kỳ
	let tL1 = 0,
		tL2 = 0,
		tL3 = 0,
		tNgoai = 0,
		tNb = 0;
	let tNv = 0,
		tTruc = 0,
		tNghi = 0,
		tLv = 0;
	let tTT03 = 0,
		tKN = 0,
		tKhoa = 0;

	allGroups.forEach((g, gi) => {
		const row = DR + gi;
		const bg = gi % 2 === 0 ? C.rowA : C.rowB;
		const agg = aggregateRecords(g.records);
		const khoaThieu = g.khoaThieu ?? 0;

		const setC = (col, val, extra) => {
			const c = ws.getCell(row, col);
			c.value = val;
			c.fill = sf(agg ? bg : C.noData);
			c.font = fnt({ size: 9, color: agg ? '1B2A4A' : 'AAAAAA', italic: !agg });
			c.alignment = al('center');
			c.border = tb();
			if (extra) extra(c);
		};

		// Col 1: STT
		setC(1, stt++);

		// Col 2: Kỳ báo cáo
		const cB = ws.getCell(row, 2);
		cB.value = g.label;
		cB.fill = sf(agg ? bg : C.noData);
		cB.font = fnt({ bold: !!agg, size: 9, color: agg ? '1F4E79' : 'AAAAAA' });
		cB.alignment = al('left');
		cB.border = tb();

		if (!agg) {
			// Merge cột 3 → 14, ghi "Không có dữ liệu"
			ws.mergeCells(row, 3, row, totalCols);
			const nd = ws.getCell(row, 3);
			nd.value = '— Không có dữ liệu —';
			nd.fill = sf(C.noData);
			nd.font = fnt({ size: 9, color: 'AAAAAA', italic: true });
			nd.alignment = al('center');
			nd.border = tb();
			ws.getRow(row).height = 18;
			return;
		}

		// Col 3,4,5: CSC1, CSC2, CSC3
		setC(3, agg.l1);
		setC(4, agg.l2);
		setC(5, agg.l3);

		// Col 6: Tổng NB (bold)
		const cNb = ws.getCell(row, 6);
		cNb.value = agg.nb;
		cNb.fill = sf(bg);
		cNb.font = fnt({ bold: true, size: 9, color: '1F4E79' });
		cNb.alignment = al('center');
		cNb.border = tb();

		// Col 7: NB ngoại trú / PT kế hoạch
		setC(7, agg.ngoai);

		// Col 8,9,10,11: Tổng NV, Nghỉ trực, Nghỉ>2ng, Đi làm
		setC(8, agg.nv);
		setC(9, agg.truc);
		setC(10, agg.nghi);
		setC(11, agg.lv);

		// Col 12: Số khoa không đủ NL
		setC(12, khoaThieu, (c) => {
			if (khoaThieu > 0) {
				c.font = fnt({ bold: true, size: 9, color: 'C00000' });
				c.fill = sf(C.orangeBg);
			}
		});

		// Col 13: TT03 toàn BV
		setC(13, parseFloat(agg.tt03.toFixed(1)));

		// Col 14: NL Khuyến nghị
		const knVal = agg.kn !== null ? parseFloat(agg.kn.toFixed(1)) : null;
		setC(14, knVal !== null ? knVal : '—', (c) => {
			if (knVal === null) {
				c.font = fnt({ size: 9, color: 'AAAAAA', italic: true });
			}
		});

		// Tích lũy tổng cộng
		tL1 += agg.l1;
		tL2 += agg.l2;
		tL3 += agg.l3;
		tNgoai += agg.ngoai;
		tNb += agg.nb;
		tNv += agg.nv;
		tTruc += agg.truc;
		tNghi += agg.nghi;
		tLv += agg.lv;
		tTT03 += agg.tt03;
		if (knVal !== null) tKN += knVal;
		tKhoa += khoaThieu;

		ws.getRow(row).height = 20;
	});

	// ── Dòng TỔNG KỲ ──
	const totRow = DR + allGroups.length;
	ws.getRow(totRow).height = 24;

	ws.mergeCells(totRow, 1, totRow, 2);
	Object.assign(ws.getCell(totRow, 1), {
		value: 'TỔNG KỲ',
		font: fnt({ bold: true, color: '1F3864', size: 10 }),
		fill: sf(C.totalBg),
		alignment: al('center'),
		border: tb(),
	});

	const totVals = [
		[3, tL1],
		[4, tL2],
		[5, tL3],
		[6, tNb],
		[7, tNgoai],
		[8, tNv],
		[9, tTruc],
		[10, tNghi],
		[11, tLv],
		[12, tKhoa],
		[13, parseFloat(tTT03.toFixed(1))],
		[14, tKN > 0 ? parseFloat(tKN.toFixed(1)) : '—'],
	];

	totVals.forEach(([col, val]) => {
		const c = ws.getCell(totRow, col);
		c.value = val;
		c.fill = sf(C.totalBg);
		c.border = tb();
		c.alignment = al('center');
		c.font = fnt({ bold: true, color: '1F3864', size: 9 });

		if (col === 14 && val === '—') {
			c.font = fnt({ size: 9, color: 'AAAAAA', italic: true });
		}
		if (col === 12 && val > 0) {
			c.font = fnt({ bold: true, size: 9, color: 'C00000' });
		}
	});

	// ── Ghi chú cuối sheet ──
	const noteRow = totRow + 2;
	ws.mergeCells(`A${noteRow}:${lastCol}${noteRow}`);
	Object.assign(ws.getCell(`A${noteRow}`), {
		value:
			'Ghi chú:  CSC1/2/3 = Cấp sức khoẻ 1/2/3  |  NB ngoại trú/PT = Người bệnh khám ngoại trú / phẫu thuật kế hoạch  |  TT03 = TT08/2007/TT-BYT  |  NL Khuyến nghị = Nhân lực theo công thức khuyến nghị của khoa',
		font: fnt({ italic: true, color: '7F6000', size: 8 }),
	});

	// ── Column widths (A..N = 14 cột) ──
	const ws0Widths = [5, 18, 8, 8, 8, 11, 16, 9, 9, 11, 10, 14, 12, 12];
	ws0Widths.forEach((w, i) => {
		ws.getColumn(i + 1).width = w;
	});

	ws.pageSetup = {
		orientation: 'landscape',
		paperSize: 9,
		fitToPage: true,
		fitToWidth: 1,
		printTitlesRow: '1:4',
	};
}

// ════════════════════════════════════════════════════════════
// HANDLER CHÍNH
// ════════════════════════════════════════════════════════════
async function exportToExcel(req, res, next) {
	try {
		const { from, to, department = 'all', groupBy = 'day' } = req.query;

		if (!from || !to) {
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu from hoặc to' });
		}
		if (!['day', 'week', 'month', 'year'].includes(groupBy)) {
			return res.status(400).json({
				success: false,
				message: 'groupBy không hợp lệ (day/week/month/year)',
			});
		}

		const pool = await getPool();
		const raw = await fetchRawRecords(pool, { from, to, department });

		if (!raw.length) {
			return res.status(404).json({
				success: false,
				message: 'Không có dữ liệu trong khoảng thời gian này',
			});
		}

		const allDays = enumerateDays(from, to);
		const wb = new ExcelJS.Workbook();
		wb.creator = 'NurseStaff System';
		wb.created = new Date();

		const isAll = !department || department === 'all';

		if (isAll) {
			// ── Xuất toàn bệnh viện ──
			const deptList = groupByDepartment(raw);

			// Build nhóm kỳ cho sheet tổng hợp
			const allGroupsForSummary = (() => {
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
			})();

			buildSummarySheet(
				wb.addWorksheet('Tổng hợp toàn BV'),
				allGroupsForSummary,
				{ from, to, groupBy },
			);

			// Sheet từng khoa
			for (const dept of deptList) {
				const safeSheetName = dept.name_department
					.replace(/[\\/*?[\]:]/g, '')
					.slice(0, 31);
				const ws = wb.addWorksheet(safeSheetName);
				const groups = groupKhoaByPeriod(dept.records, allDays, groupBy);
				buildDeptSheet(ws, dept, groups, { from, to, groupBy });
			}
		} else {
			// ── Xuất 1 khoa ──
			const dept = groupByDepartment(raw)[0];
			if (!dept) {
				return res
					.status(404)
					.json({ success: false, message: 'Không tìm thấy dữ liệu khoa này' });
			}
			const ws = wb.addWorksheet(
				dept.name_department.replace(/[\\/*?[\]:]/g, '').slice(0, 31),
			);
			const groups = groupKhoaByPeriod(dept.records, allDays, groupBy);
			buildDeptSheet(ws, dept, groups, { from, to, groupBy });
		}

		const groupLabel =
			{ day: 'Ngay', week: 'Tuan', month: 'Thang', year: 'Nam' }[groupBy] ||
			'Ngay';
		const deptLabel = isAll ? 'ToanBV' : `Khoa${department}`;
		const filename = `BaoCaoNhanLuc_${deptLabel}_${groupLabel}_${from}_${to}.xlsx`;

		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
		);
		await wb.xlsx.write(res);
		res.end();
	} catch (err) {
		next(err);
	}
}

module.exports = { exportToExcel };