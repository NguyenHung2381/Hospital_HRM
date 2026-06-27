/** * Format số hiển thị trên UI:
 * - null/undefined → '—'
 * - Có decimal → rút gọn trailing zeros
 */
export const formatNumber = (v: number | null | undefined, dec = 0): string => {
	if (v === null || v === undefined) return '—';
	return dec ? v.toFixed(dec).replace(/\.?0+$/, '') : String(v);
};

// Thêm vào utils/formatUtils.ts
export const parseNumberOrNull = (
	val: string | number | undefined | null,
): number | null => {
	if (val === null || val === undefined) return null;
	const str = String(val).trim();
	return str === '' ? null : Number(str);
};
