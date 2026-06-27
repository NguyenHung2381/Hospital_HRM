export interface StripItem {
	label: string;
	val: string | number;
	color: string;
	bg: string;
}

export const buildStripItems = (
	totalNB: number,
	totalNL: number,
	totalDL: number,
	totalTT03: number,
	totalKhuyenNghi: number,
	totalKC: number,
	filteredLen: number,
	totalLen: number,
	missingCount = 0,
): StripItem[] => {
	const diLamColor =
		totalDL < totalKC
			? '#dc2626' // đỏ — thiếu
			: totalDL === totalKC
				? '#2563eb' // xanh — đúng chuẩn
				: '#079341'; // xanh lá — dư

	const diLamBg =
		totalDL < totalKC ? '#fef2f2' : totalDL === totalKC ? '#eff6ff' : '#f0faf4';

	return [
		{ label: 'Người bệnh', val: totalNB, color: '#2563eb', bg: '#eff6ff' },
		{ label: 'Nhân lực', val: totalNL, color: '#0f766e', bg: '#f0fdfa' },
		{ label: 'Đi làm', val: totalDL, color: diLamColor, bg: diLamBg },
		{
			label: 'KC theo TT03',
			val: totalTT03.toFixed(1),
			color: '#7c3aed',
			bg: '#f5f3ff',
		},
		{
			label: 'Khuyến nghị',
			val: totalKhuyenNghi > 0 ? totalKhuyenNghi.toFixed(1) : '—',
			color: '#0369a1',
			bg: '#f0f9ff',
		},
		{
			label: 'Khoa lọc',
			val: `${filteredLen}/${totalLen}`,
			color: '#475569',
			bg: '#f8fafc',
		},
		...(missingCount > 0
			? [
					{
						label: '⚠ Chưa nhập',
						val: `${missingCount} khoa`,
						color: '#b45309',
						bg: '#fffbeb',
					},
				]
			: []),
	];
};
