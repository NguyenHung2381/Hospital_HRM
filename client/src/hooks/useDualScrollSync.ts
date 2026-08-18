import { useCallback, useEffect, useRef } from 'react';

/**
 * Đồng bộ scroll ngang giữa 1 thanh scroll giả (đặt phía trên bảng) và
 * bảng dữ liệu thật bên dưới — giúp người dùng thấy thanh cuộn ngang
 * ngay cả khi bảng rất dài (DataPage).
 */
export function useDualScrollSync<T>(dep: T) {
	const tblOuterRef = useRef<HTMLDivElement>(null);
	const scrollTopRef = useRef<HTMLDivElement>(null);
	const scrollInnerRef = useRef<HTMLDivElement>(null);

	const syncScrollWidth = useCallback(() => {
		const outer = tblOuterRef.current;
		const inner = scrollInnerRef.current;
		if (outer && inner) inner.style.width = outer.scrollWidth + 'px';
	}, []);

	useEffect(() => {
		const outer = tblOuterRef.current;
		const topBar = scrollTopRef.current;
		if (!outer || !topBar) return;
		syncScrollWidth();
		const ro = new ResizeObserver(syncScrollWidth);
		ro.observe(outer);
		let fromOuter = false,
			fromTop = false;
		const onOuter = () => {
			if (fromTop) {
				fromTop = false;
				return;
			}
			fromOuter = true;
			topBar.scrollLeft = outer.scrollLeft;
		};
		const onTop = () => {
			if (fromOuter) {
				fromOuter = false;
				return;
			}
			fromTop = true;
			outer.scrollLeft = topBar.scrollLeft;
		};
		outer.addEventListener('scroll', onOuter, { passive: true });
		topBar.addEventListener('scroll', onTop, { passive: true });
		return () => {
			ro.disconnect();
			outer.removeEventListener('scroll', onOuter);
			topBar.removeEventListener('scroll', onTop);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dep, syncScrollWidth]);

	return { tblOuterRef, scrollTopRef, scrollInnerRef };
}
