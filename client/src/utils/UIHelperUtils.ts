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
): StripItem[] => {
	const diLamColor =
		totalDL < totalKC
			? 'var(--color-error)' // đỏ — thiếu
			: totalDL === totalKC
				? 'var(--blue)' // xanh — đúng chuẩn
				: 'var(--p)'; // xanh lá — dư

	const diLamBg =
		totalDL < totalKC ? 'var(--color-error-bg)' : totalDL === totalKC ? 'var(--color-info-bg)' : 'var(--color-primary-pale)';

	return [
		{ label: 'Người bệnh', val: totalNB, color: 'var(--blue)', bg: 'var(--color-info-bg)' },
		{ label: 'Nhân lực', val: totalNL, color: 'var(--teal)', bg: 'var(--teal-l)' },
		{ label: 'Đi làm', val: totalDL, color: diLamColor, bg: diLamBg },
		{
			label: 'KC theo TT03',
			val: totalTT03.toFixed(1),
			color: 'var(--purple)',
			bg: 'var(--purple-l)',
		},
		{
			label: 'Khuyến nghị',
			val: totalKhuyenNghi > 0 ? totalKhuyenNghi.toFixed(1) : '—',
			color: '#0369a1',
			bg: '#f0f9ff',
		},
	];
};
