/**
 * exportCls.js  —  GET /api/reports/cls-export?date=YYYY-MM-DD
 *
 * Xuất báo cáo nhân lực hệ Cận lâm sàng cho 1 ngày, đúng layout mẫu gốc:
 * "12.8. P.ĐD_Biểu mẫu báo nhân lực hệ CLS.xlsx"
 * — 1 sheet, tiêu đề 2 tầng (hàng 6-8), 10 khoa CLS luôn liệt kê đủ (kể cả
 *   khoa chưa nhập dữ liệu ngày đó), cột W/X/Z là công thức Excel sống.
 */

const ExcelJS = require('exceljs');
const { getPool, sql } = require('../config/db');

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

async function exportClsToExcel(req, res, next) {
	try {
		const { date } = req.query;
		if (!date) {
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu tham số date (YYYY-MM-DD)' });
		}

		const pool = await getPool();
		const { rows } = await fetchClsDayData(pool, date);

		if (!rows.length) {
			return res
				.status(404)
				.json({ success: false, message: 'Không có khoa hệ CLS nào đang hoạt động' });
		}

		const wb = new ExcelJS.Workbook();
		wb.creator = 'Hospital HRM';
		wb.created = new Date();
		const ws = wb.addWorksheet('CLS', {
			pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1 },
		});
		ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 8 }];

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

		const sub7 = [
			['C', 'D', 'Mẫu bệnh phẩm hoặc Tiêu bản hoặc Người bệnh khám hoặc Người bệnh tư vấn'],
			['D', null, 'X.Quang hoặc siêu âm (lượt)'],
			['E', null, 'City/Nội soi (lượt)'],
			['F', null, 'MRI/ loãng xương (lượt)'],
			['G', null, 'Điện tim hoặc can thiệp (lượt)'],
			['H', null, 'Đồ vải (Kg)/ Truyền thông (số lượng khoa)'],
			['K', null, 'Khoa giám sát (số khoa)'],
			['L', null, 'Mẫu bệnh phẩm hoặc Tiêu bản hoặc Người bệnh khám hoặc Người bệnh tư vấn'],
			['M', null, 'X.Quang hoặc Siêu âm (lượt)'],
			['N', null, 'City/Nội soi (lượt)'],
			['O', null, 'MRI/ loãng xương (lượt)'],
			['P', null, 'Điện tim hoặc Can thiệp (lượt)'],
			['Q', null, 'Đồ vải (Kg)'],
		];
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
			const bg = i % 2 === 0 ? 'FFFFFF' : 'F7FBFF';
			const set = (col, val, fmt) => {
				const c = ws.getCell(`${col}${row}`);
				c.value = val ?? null;
				c.fill = sf(bg);
				c.font = fnt({ size: 9 });
				c.alignment = al('center', false);
				c.border = tb();
				if (fmt) c.numFmt = fmt;
			};

			set('A', i + 1);
			ws.getCell(`B${row}`).value = r.name_department;
			ws.getCell(`B${row}`).font = fnt({ bold: true, size: 9 });
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

			// W = Đi làm = T-(U+V)
			set('W', { formula: `T${row}-(U${row}+V${row})` });
			// X = Tỷ lệ đi làm / Σ khối lượng CV (C:K)
			set('X', { formula: `IF(SUM(C${row}:K${row})=0,0,W${row}/SUM(C${row}:K${row}))` }, '0.0%');

			const khuyenCao = r.recommended_staff ?? r.rec_fixed_add ?? null;
			set('Y', khuyenCao);
			// Z = Chênh lệch = Đi làm - Khuyến cáo
			if (khuyenCao !== null) {
				set('Z', { formula: `W${row}-Y${row}` });
			} else {
				set('Z', null);
			}

			ws.getCell(`AA${row}`).value = r.note ?? '';
			ws.getCell(`AA${row}`).font = fnt({ size: 9 });
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

		const filename = `BaoCaoNhanLuc_CLS_${date}.xlsx`;
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
