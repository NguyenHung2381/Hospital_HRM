import type { KhoaRecord } from '@/types/reportType';
import { useMemo, useState } from 'react';

interface UseDeptFilterReturn {
	selKhoa: Set<number>;
	setSelKhoa: (next: Set<number>) => void;
	sidebarSearch: string;
	setSidebarSearch: React.Dispatch<React.SetStateAction<string>>;
	toggleKhoa: (tt: number) => void;
	selectAll: () => void;
	clearAll: () => void;
}

/**
 * Quản lý bộ lọc khoa trong sidebar.
 *
 * Pattern: thay vì lưu toàn bộ Set đang chọn (gây useEffect → setState),
 * chỉ lưu `excluded` — tập hợp các tt bị BỎ chọn thủ công.
 * selKhoa được derive bằng useMemo: allRows - excluded.
 *
 * Khi allRows thay đổi (load báo cáo mới):
 *  - excluded tự động reset về rỗng nhờ signature check
 *  - selKhoa = tất cả khoa mới (không cần useEffect → setState)
 */
export function useDeptFilter(allRows: KhoaRecord[]): UseDeptFilterReturn {
	// Signature để detect khi nào báo cáo mới load
	const reportSignature =
		allRows.length > 0 ? `${allRows.length}-${allRows[0].tt}` : '';

	const [excluded, setExcluded] = useState<{ sig: string; set: Set<number> }>({
		sig: '',
		set: new Set(),
	});
	const [sidebarSearch, setSidebarSearch] = useState('');

	// Nếu signature thay đổi (báo cáo mới) → dùng excluded rỗng
	const effectiveExcluded =
		excluded.sig === reportSignature ? excluded.set : new Set<number>();

	// selKhoa là derived value — không cần useState riêng
	const selKhoa = useMemo(
		() =>
			new Set(
				allRows.map((r) => r.tt).filter((tt) => !effectiveExcluded.has(tt)),
			),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[allRows, excluded],
	);

	const updateExcluded = (next: Set<number>) =>
		setExcluded({ sig: reportSignature, set: next });

	const toggleKhoa = (tt: number) => {
		const nx = new Set(effectiveExcluded);
		if (nx.has(tt))
			nx.delete(tt); // đang ẩn → hiện lại
		else nx.add(tt); // đang hiện → ẩn đi
		updateExcluded(nx);
	};

	const selectAll = () => updateExcluded(new Set());
	const clearAll = () => updateExcluded(new Set(allRows.map((r) => r.tt)));

	// setSelKhoa để DataPage override trực tiếp (e.g. nút "Bỏ lọc")
	const setSelKhoa = (next: Set<number>) => {
		const nextExcluded = new Set(
			allRows.map((r) => r.tt).filter((tt) => !next.has(tt)),
		);
		updateExcluded(nextExcluded);
	};

	return {
		selKhoa,
		setSelKhoa,
		sidebarSearch,
		setSidebarSearch,
		toggleKhoa,
		selectAll,
		clearAll,
	};
}
