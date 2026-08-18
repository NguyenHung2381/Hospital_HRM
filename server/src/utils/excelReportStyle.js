// ── Palette + style helpers dùng cho export báo cáo nhân lực (exportReports.js) ──
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

function fnt({ bold = false, color = '1B2A4A', size = 10, italic = false } = {}) {
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

module.exports = { C, fnt, al, sf, tb };
