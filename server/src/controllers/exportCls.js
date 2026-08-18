/**
 * exportCls.js  —  GET /api/reports/cls-export?date=YYYY-MM-DD
 *                   GET /api/reports/cls-export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Xuất báo cáo nhân lực hệ Cận lâm sàng, đúng layout mẫu gốc:
 * "12.8. P.ĐD_Biểu mẫu báo nhân lực hệ CLS.xlsx"
 * — 1 sheet / ngày, tiêu đề 2 tầng (hàng 6-8), 10 khoa CLS luôn liệt kê đủ
 *   (kể cả khoa chưa nhập dữ liệu ngày đó), cột W/X/Z là công thức Excel sống.
 *
 * `date` (1 ngày, dùng bởi bảng theo dõi CLS hàng ngày) và `from`/`to`
 * (khoảng ngày, dùng bởi trang Xuất báo cáo admin) đều được hỗ trợ —
 * mỗi ngày trong khoảng sinh 1 sheet riêng, tối đa 31 ngày/lần xuất.
 *
 * Sheet đầu tiên luôn là "Tổng hợp CLS" — 1 dòng/khoa, gộp cả kỳ (số ngày có
 * dữ liệu, NL/nghỉ trực/nghỉ >2 ngày/đi làm trung bình mỗi ngày, tỷ lệ đi
 * làm/KLCV cả kỳ, khuyến cáo, chênh lệch). Cột Z (sheet ngày) và J (sheet
 * tổng quan) tô xanh khi thặng nhân lực, đỏ khi thiếu; dòng/khoa chưa nhập
 * dữ liệu được tô xám để phân biệt với "thiếu nhân lực".
 */

const ExcelJS = require('exceljs');
const { getPool, sql } = require('../config/db');
const { enumerateDays } = require('../utils/reportDateGrouping');

const MAX_DAYS = 31;

function fnt({ bold = false, color = '000000', size = 10, italic = false } = {}) {
	return { name: 'Times New Roman', bold, color: { argb: 'FF' + color }, size, italic };
}
function al(h = 'center', wrap = true) {
	return { horizontal: h, vertical: 'middle', wrapText: wrap };
}
function sf(argb) {
	return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + argb } };
}
function tb() {
	const s = { style: 'thin', color: { argb: 'FF999999' } };
	return { top: s, left: s, bottom: s, right: s };
}

const HDR_BG = 'D9E1F2';
const SUB_BG = 'EBF3FB';
const GREEN_TXT = '375623';
const RED_TXT = 'C00000';
const ORANGE_BG = 'FCE4D6';
const NODATA_BG = 'F2F2F2';
const NODATA_TXT = '999999';

const WORKLOAD_FIELDS = [
	'sample_or_visit_cnt',
	'xray_us_cnt',
	'ct_endoscopy_cnt',
	'mri_bonedensity_cnt',
	'ecg_intervention_cnt',
	'linen_media_cnt',
	'tool_metal_cnt',
	'tool_plastic_cnt',
	'supervised_dept_cnt',
];

/** true nếu khoa đã nhập số liệu ngày đó (total_staff là input bắt buộc khi nhập). */
function rowHasData(r) {
	return r.total_staff !== null && r.total_staff !== undefined;
}
function sumWorkload(r) {
	return WORKLOAD_FIELDS.reduce((s, f) => s + (r[f] ?? 0), 0);
}
function computeDiLam(r) {
	return (r.total_staff ?? 0) - ((r.staff_long_leave ?? 0) + (r.staff_on_duty ?? 0));
}
function computeKhuyenCao(r) {
	return r.recommended_staff ?? r.rec_fixed_add ?? null;
}
function round1(n) {
	return Math.round(n * 10) / 10;
}

async function fetchClsDayData(pool, date) {
	const reportRes = await pool
		.request()
		.input('date', sql.Date, date)
		.query(`SELECT id_report FROM Daily_Reports WHERE report_date = @date`);
	const id_report = reportRes.recordset[0]?.id_report ?? null;

	// Luôn liệt kê đủ 10 khoa CLS (theo id_department, đúng thứ tự seed), LEFT JOIN
	// bản ghi của báo cáo ngày đó (nếu report tồn tại và khoa đã nhập).
	const request = pool.request().input('id_report', sql.Int, id_report);
	const result = await request.query(`
		SELECT
			d.id_department, d.name_department,
			rcr.sample_or_visit_cnt, rcr.xray_us_cnt, rcr.ct_endoscopy_cnt,
			rcr.mri_bonedensity_cnt, rcr.ecg_intervention_cnt, rcr.linen_media_cnt,
			rcr.tool_metal_cnt, rcr.tool_plastic_cnt, rcr.supervised_dept_cnt,
			rcr.pending_sample_or_visit_cnt, rcr.pending_xray_us_cnt, rcr.pending_ct_endoscopy_cnt,
			rcr.pending_mri_bonedensity_cnt, rcr.pending_ecg_intervention_cnt, rcr.pending_linen_cnt,
			rcr.pending_tool_metal_cnt, rcr.pending_tool_plastic_cnt,
			rcr.total_staff, rcr.staff_on_duty, rcr.staff_long_leave,
			rcr.recommended_staff, rcr.note,
			rc.fixed_add AS rec_fixed_add
		FROM Departments d
		LEFT JOIN Report_CLS_Records rcr
			ON rcr.id_department = d.id_department AND rcr.id_report = @id_report
		LEFT JOIN Dept_Recommended_Config rc ON rc.id_department = d.id_department
		WHERE d.dept_group = 'cls' AND d.status = 'active'
		ORDER BY d.id_department ASC
	`);
	return { id_report, rows: result.recordset };
}

/** Vẽ toàn bộ layout mẫu CLS (tiêu đề + bảng) lên 1 worksheet cho 1 ngày. */
function buildClsSheet(ws, date, rows) {
	// ── Tiêu đề ──
	ws.mergeCells('A1:AA1');
	Object.assign(ws.getCell('A1'), {
		value: 'BẢNG THEO DÕI NHÂN LỰC',
		font: fnt({ bold: true, size: 15 }),
		alignment: al(),
	});
	ws.mergeCells('A2:AA2');
	Object.assign(ws.getCell('A2'), {
		value:
			'ĐIỀU DƯỠNG - KỸ THUẬT VIÊN - HỘ LÝ PHÒNG KHÁM - DINH DƯỠNG VÀ HỆ CẬN LÂM SÀNG hàng ngày',
		font: fnt({ bold: true, size: 12 }),
		alignment: al(),
	});
	ws.mergeCells('A3:AA3');
	Object.assign(ws.getCell('A3'), {
		value: `Ngày: ${date}   |   Xuất lúc: ${new Date().toLocaleString('vi-VN')}`,
		font: fnt({ italic: true, size: 10 }),
		alignment: al(),
	});
	ws.getRow(1).height = 26;
	ws.getRow(2).height = 20;
	ws.getRow(3).height = 18;

	// ── Hàng 6-8: tiêu đề bảng (đúng layout mẫu gốc) ──
	const HR1 = 6,
		HR2 = 7,
		HR3 = 8;

	const mergeDown = [
		['A', 'STT'],
		['B', 'Khoa/trung tâm'],
		['T', 'Tổng số nhân lực'],
		['U', 'Tổng nhân lực nghỉ từ 2 ngày trở lên'],
		['V', 'Nhân lực nghỉ trực'],
		['W', 'Nhân lực đi làm'],
		['X', 'Tỷ lệ NL đi làm/Khối lượng CV'],
		['Y', 'Nhân lực khuyến cáo (theo đề án VTLV của BV)'],
		['Z', 'Chênh lệch'],
		['AA', 'Ghi chú'],
	];
	mergeDown.forEach(([col, label]) => {
		ws.mergeCells(`${col}${HR1}:${col}${HR3}`);
		const c = ws.getCell(`${col}${HR1}`);
		c.value = label;
		c.font = fnt({ bold: true, size: 9 });
		c.fill = sf(HDR_BG);
		c.alignment = al();
		c.border = tb();
	});

	ws.mergeCells(`C${HR1}:K${HR1}`);
	Object.assign(ws.getCell(`C${HR1}`), {
		value: 'Khối lượng công việc đã thực hiện (báo cáo số liệu ngày trước)',
		font: fnt({ bold: true, size: 9 }),
		fill: sf(HDR_BG),
		alignment: al(),
		border: tb(),
	});
	ws.mergeCells(`L${HR1}:S${HR1}`);
	Object.assign(ws.getCell(`L${HR1}`), {
		value: 'Số lượng tồn/ chờ',
		font: fnt({ bold: true, size: 9 }),
		fill: sf(HDR_BG),
		alignment: al(),
		border: tb(),
	});

	// C,D,E,F,G,H merge xuống hàng 8 (đơn cột); I là "Xử lý dụng cụ" gộp I7:J7
	['C', 'D', 'E', 'F', 'G', 'H', 'K'].forEach((col, i) => {
		const labels = [
			'Mẫu bệnh phẩm hoặc Tiêu bản hoặc Người bệnh khám hoặc Người bệnh tư vấn',
			'X.Quang hoặc siêu âm (lượt)',
			'City/Nội soi (lượt)',
			'MRI/ loãng xương (lượt)',
			'Điện tim hoặc can thiệp (lượt)',
			'Đồ vải (Kg)/ Truyền thông (số lượng khoa)',
			'Khoa giám sát (số khoa)',
		];
		ws.mergeCells(`${col}${HR2}:${col}${HR3}`);
		const c = ws.getCell(`${col}${HR2}`);
		c.value = labels[i];
		c.font = fnt({ bold: true, size: 8 });
		c.fill = sf(SUB_BG);
		c.alignment = al();
		c.border = tb();
	});
	['L', 'M', 'N', 'O', 'P', 'Q'].forEach((col, i) => {
		const labels = [
			'Mẫu bệnh phẩm hoặc Tiêu bản hoặc Người bệnh khám hoặc Người bệnh tư vấn',
			'X.Quang hoặc Siêu âm (lượt)',
			'City/Nội soi (lượt)',
			'MRI/ loãng xương (lượt)',
			'Điện tim hoặc Can thiệp (lượt)',
			'Đồ vải (Kg)',
		];
		ws.mergeCells(`${col}${HR2}:${col}${HR3}`);
		const c = ws.getCell(`${col}${HR2}`);
		c.value = labels[i];
		c.font = fnt({ bold: true, size: 8 });
		c.fill = sf(SUB_BG);
		c.alignment = al();
		c.border = tb();
	});

	ws.mergeCells(`I${HR2}:J${HR2}`);
	Object.assign(ws.getCell(`I${HR2}`), {
		value: 'Xử lý dụng cụ',
		font: fnt({ bold: true, size: 8 }),
		fill: sf(SUB_BG),
		alignment: al(),
		border: tb(),
	});
	ws.mergeCells(`R${HR2}:S${HR2}`);
	Object.assign(ws.getCell(`R${HR2}`), {
		value: 'Xử lý dụng cụ',
		font: fnt({ bold: true, size: 8 }),
		fill: sf(SUB_BG),
		alignment: al(),
		border: tb(),
	});

	[
		['I', 'Xử lý dụng cụ sắt (Bộ)'],
		['J', 'Xử lý dụng nhựa (Cái)'],
		['R', 'Xử lý dụng cụ sắt (Bộ)'],
		['S', 'Xử lý dụng nhựa (Cái)'],
	].forEach(([col, label]) => {
		const c = ws.getCell(`${col}${HR3}`);
		c.value = label;
		c.font = fnt({ bold: true, size: 8 });
		c.fill = sf(SUB_BG);
		c.alignment = al();
		c.border = tb();
	});

	[HR1, HR2, HR3].forEach((r) => (ws.getRow(r).height = 26));

	// ── Dữ liệu: 10 khoa CLS ──
	const DR = 9;
	rows.forEach((r, i) => {
		const row = DR + i;
		const hasData = rowHasData(r);
		const bg = !hasData ? NODATA_BG : i % 2 === 0 ? 'FFFFFF' : 'F7FBFF';
		const baseColor = !hasData ? NODATA_TXT : '000000';
		const set = (col, val, fmt) => {
			const c = ws.getCell(`${col}${row}`);
			c.value = val ?? null;
			c.fill = sf(bg);
			c.font = fnt({ size: 9, color: baseColor, italic: !hasData });
			c.alignment = al('center', false);
			c.border = tb();
			if (fmt) c.numFmt = fmt;
		};

		set('A', i + 1);
		ws.getCell(`B${row}`).value = r.name_department;
		ws.getCell(`B${row}`).font = fnt({ bold: true, size: 9, color: baseColor, italic: !hasData });
		ws.getCell(`B${row}`).fill = sf(bg);
		ws.getCell(`B${row}`).alignment = al('left', false);
		ws.getCell(`B${row}`).border = tb();

		set('C', r.sample_or_visit_cnt);
		set('D', r.xray_us_cnt);
		set('E', r.ct_endoscopy_cnt);
		set('F', r.mri_bonedensity_cnt);
		set('G', r.ecg_intervention_cnt);
		set('H', r.linen_media_cnt);
		set('I', r.tool_metal_cnt);
		set('J', r.tool_plastic_cnt);
		set('K', r.supervised_dept_cnt);

		set('L', r.pending_sample_or_visit_cnt);
		set('M', r.pending_xray_us_cnt);
		set('N', r.pending_ct_endoscopy_cnt);
		set('O', r.pending_mri_bonedensity_cnt);
		set('P', r.pending_ecg_intervention_cnt);
		set('Q', r.pending_linen_cnt);
		set('R', r.pending_tool_metal_cnt);
		set('S', r.pending_tool_plastic_cnt);

		set('T', r.total_staff);
		set('U', r.staff_long_leave);
		set('V', r.staff_on_duty);

		const khuyenCao = computeKhuyenCao(r);
		set('Y', khuyenCao);

		if (hasData) {
			// W = Đi làm = T-(U+V)
			set('W', { formula: `T${row}-(U${row}+V${row})` });
			// X = Tỷ lệ đi làm / Σ khối lượng CV (C:K)
			set('X', { formula: `IF(SUM(C${row}:K${row})=0,0,W${row}/SUM(C${row}:K${row}))` }, '0.0%');
			// Z = Chênh lệch = Đi làm - Khuyến cáo — tô xanh (thặng) / đỏ (thiếu)
			if (khuyenCao !== null) {
				set('Z', { formula: `W${row}-Y${row}` });
				const chenhLech = computeDiLam(r) - khuyenCao;
				const zCell = ws.getCell(`Z${row}`);
				if (chenhLech > 0) {
					zCell.font = fnt({ bold: true, size: 9, color: GREEN_TXT });
				} else if (chenhLech < 0) {
					zCell.font = fnt({ bold: true, size: 9, color: RED_TXT });
					zCell.fill = sf(ORANGE_BG);
				}
			} else {
				set('Z', null);
			}
		} else {
			// Chưa nhập dữ liệu ngày này — để trống W/X/Z, tránh hiểu nhầm "thiếu NL"
			set('W', null);
			set('X', null);
			set('Z', null);
		}

		ws.getCell(`AA${row}`).value = hasData ? (r.note ?? '') : '— Chưa nhập dữ liệu —';
		ws.getCell(`AA${row}`).font = fnt({ size: 9, color: baseColor, italic: !hasData });
		ws.getCell(`AA${row}`).fill = sf(bg);
		ws.getCell(`AA${row}`).alignment = al('left', true);
		ws.getCell(`AA${row}`).border = tb();

		ws.getRow(row).height = 20;
	});

	// ── Độ rộng cột ──
	const widths = {
		A: 5,
		B: 20,
		C: 12,
		D: 9,
		E: 9,
		F: 9,
		G: 9,
		H: 9,
		I: 9,
		J: 9,
		K: 9,
		L: 12,
		M: 9,
		N: 9,
		O: 9,
		P: 9,
		Q: 9,
		R: 9,
		S: 9,
		T: 8,
		U: 8,
		V: 8,
		W: 8,
		X: 10,
		Y: 10,
		Z: 8,
		AA: 16,
	};
	Object.entries(widths).forEach(([col, w]) => {
		ws.getColumn(col).width = w;
	});
}

/**
 * Sheet tổng quan: 1 dòng / khoa CLS, gộp toàn bộ `dateList` — số ngày có dữ liệu,
 * các chỉ số nhân lực trung bình/ngày, tỷ lệ đi làm/KLCV cả kỳ, khuyến cáo, chênh lệch.
 * Luôn được thêm làm sheet đầu tiên (kể cả khi chỉ xuất 1 ngày).
 */
function buildClsSummarySheet(ws, dateList, rowsByDate) {
	ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 5 }];

	const lastCol = 'K';
	ws.mergeCells(`A1:${lastCol}1`);
	Object.assign(ws.getCell('A1'), {
		value: 'TỔNG HỢP NHÂN LỰC HỆ CẬN LÂM SÀNG',
		font: fnt({ bold: true, size: 15 }),
		alignment: al(),
	});
	ws.mergeCells(`A2:${lastCol}2`);
	Object.assign(ws.getCell('A2'), {
		value: 'ĐIỀU DƯỠNG - KỸ THUẬT VIÊN - HỘ LÝ HỆ CẬN LÂM SÀNG',
		font: fnt({ bold: true, size: 12 }),
		alignment: al(),
	});
	ws.mergeCells(`A3:${lastCol}3`);
	Object.assign(ws.getCell('A3'), {
		value: `Kỳ: ${dateList[0]} → ${dateList[dateList.length - 1]}  (${dateList.length} ngày)   |   Xuất lúc: ${new Date().toLocaleString('vi-VN')}`,
		font: fnt({ italic: true, size: 10 }),
		alignment: al(),
	});
	ws.getRow(1).height = 26;
	ws.getRow(2).height = 20;
	ws.getRow(3).height = 18;

	// ── Hàng 5: tiêu đề cột ──
	const HR = 5;
	const headers = [
		['A', 'STT'],
		['B', 'Khoa/trung tâm'],
		['C', 'Số ngày có dữ liệu'],
		['D', 'NL trung bình/ngày'],
		['E', 'Nghỉ trực TB'],
		['F', 'Nghỉ ≥2 ngày TB'],
		['G', 'NL đi làm TB'],
		['H', 'Tỷ lệ đi làm/KLCV (cả kỳ)'],
		['I', 'NL khuyến cáo'],
		['J', 'Chênh lệch TB'],
		['K', 'Ghi chú'],
	];
	headers.forEach(([col, label]) => {
		const c = ws.getCell(`${col}${HR}`);
		c.value = label;
		c.font = fnt({ bold: true, size: 9 });
		c.fill = sf(HDR_BG);
		c.alignment = al();
		c.border = tb();
	});
	ws.getRow(HR).height = 30;

	// ── Gộp dữ liệu theo khoa trên toàn bộ dateList ──
	const byDept = new Map(); // id_department -> agg
	dateList.forEach((d) => {
		const rows = rowsByDate.get(d) ?? [];
		rows.forEach((r) => {
			let agg = byDept.get(r.id_department);
			if (!agg) {
				agg = {
					name: r.name_department,
					daysWithData: 0,
					sumStaff: 0,
					sumTruc: 0,
					sumNghi: 0,
					sumDiLam: 0,
					sumWorkload: 0,
					khuyenCao: null,
				};
				byDept.set(r.id_department, agg);
			}
			const khuyenCao = computeKhuyenCao(r);
			if (khuyenCao !== null) agg.khuyenCao = khuyenCao;
			if (rowHasData(r)) {
				agg.daysWithData += 1;
				agg.sumStaff += r.total_staff ?? 0;
				agg.sumTruc += r.staff_on_duty ?? 0;
				agg.sumNghi += r.staff_long_leave ?? 0;
				agg.sumDiLam += computeDiLam(r);
				agg.sumWorkload += sumWorkload(r);
			}
		});
	});

	const DR = HR + 1;
	let i = 0;
	let totStaff = 0,
		totTruc = 0,
		totNghi = 0,
		totDiLam = 0,
		totKhuyenCao = 0,
		hasKhuyenCao = false,
		totChenhLech = 0,
		hasChenhLech = false;

	for (const agg of byDept.values()) {
		const row = DR + i;
		const hasAnyData = agg.daysWithData > 0;
		const bg = !hasAnyData ? NODATA_BG : i % 2 === 0 ? 'FFFFFF' : 'F7FBFF';
		const baseColor = !hasAnyData ? NODATA_TXT : '000000';
		const set = (col, val, fmt) => {
			const c = ws.getCell(`${col}${row}`);
			c.value = val ?? null;
			c.fill = sf(bg);
			c.font = fnt({ size: 9, color: baseColor, italic: !hasAnyData });
			c.alignment = al('center', false);
			c.border = tb();
			if (fmt) c.numFmt = fmt;
		};

		set('A', i + 1);
		ws.getCell(`B${row}`).value = agg.name;
		ws.getCell(`B${row}`).font = fnt({ bold: true, size: 9, color: baseColor, italic: !hasAnyData });
		ws.getCell(`B${row}`).fill = sf(bg);
		ws.getCell(`B${row}`).alignment = al('left', false);
		ws.getCell(`B${row}`).border = tb();

		set('C', `${agg.daysWithData}/${dateList.length}`);

		const avgStaff = hasAnyData ? agg.sumStaff / agg.daysWithData : null;
		const avgTruc = hasAnyData ? agg.sumTruc / agg.daysWithData : null;
		const avgNghi = hasAnyData ? agg.sumNghi / agg.daysWithData : null;
		const avgDiLam = hasAnyData ? agg.sumDiLam / agg.daysWithData : null;
		const ratio = !hasAnyData ? null : agg.sumWorkload > 0 ? agg.sumDiLam / agg.sumWorkload : 0;

		set('D', avgStaff !== null ? round1(avgStaff) : null);
		set('E', avgTruc !== null ? round1(avgTruc) : null);
		set('F', avgNghi !== null ? round1(avgNghi) : null);
		set('G', avgDiLam !== null ? round1(avgDiLam) : null);
		set('H', ratio, '0.0%');
		set('I', agg.khuyenCao);

		const chenhLech =
			avgDiLam !== null && agg.khuyenCao !== null ? avgDiLam - agg.khuyenCao : null;
		set('J', chenhLech !== null ? round1(chenhLech) : null);
		if (chenhLech !== null) {
			const jCell = ws.getCell(`J${row}`);
			if (chenhLech > 0) jCell.font = fnt({ bold: true, size: 9, color: GREEN_TXT });
			else if (chenhLech < 0) {
				jCell.font = fnt({ bold: true, size: 9, color: RED_TXT });
				jCell.fill = sf(ORANGE_BG);
			}
		}

		const note = !hasAnyData
			? '— Chưa nhập dữ liệu —'
			: agg.daysWithData < dateList.length
				? `Thiếu dữ liệu ${dateList.length - agg.daysWithData}/${dateList.length} ngày`
				: '';
		ws.getCell(`K${row}`).value = note;
		ws.getCell(`K${row}`).font = fnt({ size: 9, color: baseColor, italic: true });
		ws.getCell(`K${row}`).fill = sf(bg);
		ws.getCell(`K${row}`).alignment = al('left', true);
		ws.getCell(`K${row}`).border = tb();

		ws.getRow(row).height = 20;

		if (avgStaff !== null) totStaff += avgStaff;
		if (avgTruc !== null) totTruc += avgTruc;
		if (avgNghi !== null) totNghi += avgNghi;
		if (avgDiLam !== null) totDiLam += avgDiLam;
		if (agg.khuyenCao !== null) {
			totKhuyenCao += agg.khuyenCao;
			hasKhuyenCao = true;
		}
		if (chenhLech !== null) {
			totChenhLech += chenhLech;
			hasChenhLech = true;
		}

		i++;
	}

	// ── Dòng TỔNG TOÀN HỆ ──
	const totRow = DR + byDept.size;
	ws.mergeCells(`A${totRow}:B${totRow}`);
	Object.assign(ws.getCell(`A${totRow}`), {
		value: 'TỔNG TOÀN HỆ CLS',
		font: fnt({ bold: true, size: 10 }),
		fill: sf(HDR_BG),
		alignment: al(),
		border: tb(),
	});
	const setTot = (col, val, fmt) => {
		const c = ws.getCell(`${col}${totRow}`);
		c.value = val ?? null;
		c.fill = sf(HDR_BG);
		c.font = fnt({ bold: true, size: 9 });
		c.alignment = al('center', false);
		c.border = tb();
		if (fmt) c.numFmt = fmt;
	};
	setTot('C', '');
	setTot('D', round1(totStaff));
	setTot('E', round1(totTruc));
	setTot('F', round1(totNghi));
	setTot('G', round1(totDiLam));
	setTot('H', '—');
	setTot('I', hasKhuyenCao ? round1(totKhuyenCao) : '—');
	setTot('J', hasChenhLech ? round1(totChenhLech) : '—');
	if (hasChenhLech) {
		const jTot = ws.getCell(`J${totRow}`);
		if (totChenhLech > 0) jTot.font = fnt({ bold: true, size: 9, color: GREEN_TXT });
		else if (totChenhLech < 0) {
			jTot.font = fnt({ bold: true, size: 9, color: RED_TXT });
			jTot.fill = sf(ORANGE_BG);
		}
	}
	setTot('K', '');
	ws.getRow(totRow).height = 22;

	// ── Ghi chú cuối sheet ──
	const noteRow = totRow + 2;
	ws.mergeCells(`A${noteRow}:${lastCol}${noteRow}`);
	Object.assign(ws.getCell(`A${noteRow}`), {
		value:
			'Ghi chú: các cột "TB" (trung bình) tính trên số ngày khoa đã nhập dữ liệu trong kỳ  ·  Tỷ lệ đi làm/KLCV = Tổng NL đi làm / Tổng khối lượng CV cả kỳ  ·  Chênh lệch = NL đi làm TB − NL khuyến cáo',
		font: fnt({ italic: true, size: 8, color: '7F6000' }),
	});

	// ── Độ rộng cột ──
	const widths = { A: 5, B: 20, C: 14, D: 13, E: 11, F: 12, G: 12, H: 16, I: 12, J: 12, K: 24 };
	Object.entries(widths).forEach(([col, w]) => {
		ws.getColumn(col).width = w;
	});
}

async function exportClsToExcel(req, res, next) {
	try {
		const { date, from, to } = req.query;

		let dateList;
		if (from && to) {
			if (from > to) {
				return res
					.status(400)
					.json({ success: false, message: '"from" phải trước hoặc bằng "to"' });
			}
			dateList = enumerateDays(from, to);
			if (dateList.length > MAX_DAYS) {
				return res.status(400).json({
					success: false,
					message: `Khoảng thời gian quá dài để xuất báo cáo CLS (tối đa ${MAX_DAYS} ngày/lần xuất)`,
				});
			}
		} else if (date) {
			dateList = [date];
		} else {
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu tham số date hoặc from/to (YYYY-MM-DD)' });
		}

		const pool = await getPool();
		const isRange = dateList.length > 1;

		// Lấy dữ liệu tất cả các ngày trước (dùng chung cho sheet tổng quan + từng sheet ngày)
		const rowsByDate = new Map();
		let deptFound = false;
		for (const d of dateList) {
			const { rows } = await fetchClsDayData(pool, d);
			rowsByDate.set(d, rows);
			if (rows.length) deptFound = true;
		}

		if (!deptFound) {
			return res
				.status(404)
				.json({ success: false, message: 'Không có khoa hệ CLS nào đang hoạt động' });
		}

		const wb = new ExcelJS.Workbook();
		wb.creator = 'Hospital HRM';
		wb.created = new Date();

		// Sheet tổng quan luôn đứng đầu — kể cả khi chỉ xuất 1 ngày
		const wsSum = wb.addWorksheet('Tổng hợp CLS', {
			pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1 },
		});
		buildClsSummarySheet(wsSum, dateList, rowsByDate);

		for (const d of dateList) {
			const rows = rowsByDate.get(d) ?? [];
			if (!rows.length) continue;

			const ws = wb.addWorksheet(isRange ? d : 'CLS', {
				pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1 },
			});
			ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 8 }];
			buildClsSheet(ws, d, rows);
		}

		const filename = isRange
			? `BaoCaoNhanLuc_CLS_${dateList[0]}_${dateList[dateList.length - 1]}.xlsx`
			: `BaoCaoNhanLuc_CLS_${dateList[0]}.xlsx`;

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

module.exports = { exportClsToExcel };
