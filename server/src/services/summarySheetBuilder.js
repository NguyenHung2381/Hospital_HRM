const { C, fnt, al, sf, tb } = require('../utils/excelReportStyle');
const { aggregateRecords } = require('./reportAggregation');

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

module.exports = { buildSummarySheet };
