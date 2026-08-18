const { C, fnt, al, sf, tb } = require('../utils/excelReportStyle');
const { aggregateRecords } = require('./reportAggregation');

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

module.exports = { buildDeptSheet };
