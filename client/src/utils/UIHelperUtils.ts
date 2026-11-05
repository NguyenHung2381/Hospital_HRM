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
	// Đi làm: đỏ khi thiếu so với định mức, còn lại màu nhóm nhân lực
	const short = totalDL < totalKC;
	const diLamColor = short ? 'var(--color-error)' : 'var(--grp-nl-fg)';
	const diLamBg = short ? 'var(--color-error-bg)' : 'var(--grp-nl-bg)';

	return [
		{ label: 'Người bệnh', val: totalNB, color: 'var(--grp-nb-fg)', bg: 'var(--grp-nb-bg)' },
		{ label: 'Nhân lực', val: totalNL, color: 'var(--grp-nl-fg)', bg: 'var(--grp-nl-bg)' },
		{ label: 'Đi làm', val: totalDL, color: diLamColor, bg: diLamBg },
		{
			label: 'KC theo TT03',
			val: totalTT03.toFixed(1),
			color: 'var(--grp-kc-fg)',
			bg: 'var(--grp-kc-bg)',
		},
		{
			label: 'Khuyến nghị',
			val: totalKhuyenNghi > 0 ? totalKhuyenNghi.toFixed(1) : '—',
			color: 'var(--grp-kc-fg)',
			bg: 'var(--grp-kc-bg)',
		},
	];
};
