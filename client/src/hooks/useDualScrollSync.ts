import {
	type PointerEvent as ReactPointerEvent,
	type WheelEvent as ReactWheelEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';

const MIN_THUMB_WIDTH = 32;

/**
 * Thanh cuộn ngang tự vẽ (không dựa vào scrollbar gốc của trình duyệt/OS —
 * loại này có thể tự ẩn khi không tương tác trên một số bản Windows/
 * Chromium) đặt phía trên bảng dữ liệu, luôn hiển thị và kéo được mọi lúc.
 * Đồng bộ 2 chiều với vùng scroll thật của bảng qua `tblOuterRef`, đồng
 * thời hỗ trợ Ctrl + lăn chuột để cuộn ngang và chặn trình duyệt zoom
 * trang khi giữ Ctrl lăn chuột trong vùng bảng.
 */
export function useDualScrollSync<T>(dep: T) {
	const tblOuterRef = useRef<HTMLDivElement>(null);
	const scrollTopRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{ startX: number; startScrollLeft: number } | null>(
		null,
	);

	const [thumb, setThumb] = useState({ left: 0, width: 0, visible: false });

	const syncThumb = useCallback(() => {
		const outer = tblOuterRef.current;
		const track = scrollTopRef.current;
		if (!outer || !track) return;
		const { scrollWidth, clientWidth, scrollLeft } = outer;
		if (scrollWidth <= clientWidth + 1) {
			setThumb({ left: 0, width: 0, visible: false });
			return;
		}
		const trackWidth = track.clientWidth;
		const width = Math.min(
			trackWidth,
			Math.max(MIN_THUMB_WIDTH, (clientWidth / scrollWidth) * trackWidth),
		);
		const maxThumbTravel = trackWidth - width;
		const maxScroll = scrollWidth - clientWidth;
		const left = maxScroll > 0 ? maxThumbTravel * (scrollLeft / maxScroll) : 0;
		setThumb({ left, width, visible: true });
	}, []);

	useEffect(() => {
		const outer = tblOuterRef.current;
		const track = scrollTopRef.current;
		if (!outer || !track) return;
		const raf = requestAnimationFrame(syncThumb);
		const ro = new ResizeObserver(syncThumb);
		ro.observe(outer);
		ro.observe(track);
		outer.addEventListener('scroll', syncThumb, { passive: true });
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			outer.removeEventListener('scroll', syncThumb);
		};
	}, [dep, syncThumb]);

	const onThumbPointerDown = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			const outer = tblOuterRef.current;
			if (!outer) return;
			e.preventDefault();
			e.stopPropagation();
			dragRef.current = { startX: e.clientX, startScrollLeft: outer.scrollLeft };
			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[],
	);

	const onThumbPointerMove = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			const outer = tblOuterRef.current;
			const track = scrollTopRef.current;
			const drag = dragRef.current;
			if (!outer || !track || !drag) return;
			const { scrollWidth, clientWidth } = outer;
			const trackWidth = track.clientWidth;
			const thumbWidth = Math.min(
				trackWidth,
				Math.max(MIN_THUMB_WIDTH, (clientWidth / scrollWidth) * trackWidth),
			);
			const maxThumbTravel = trackWidth - thumbWidth;
			if (maxThumbTravel <= 0) return;
			const maxScroll = scrollWidth - clientWidth;
			const dx = e.clientX - drag.startX;
			const deltaScroll = (dx / maxThumbTravel) * maxScroll;
			outer.scrollLeft = Math.min(
				maxScroll,
				Math.max(0, drag.startScrollLeft + deltaScroll),
			);
		},
		[],
	);

	const onThumbPointerUp = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			dragRef.current = null;
			if (e.currentTarget.hasPointerCapture(e.pointerId)) {
				e.currentTarget.releasePointerCapture(e.pointerId);
			}
		},
		[],
	);

	/** Bấm vào track (ngoài thumb) để nhảy nhanh tới vị trí đó. */
	const onTrackPointerDown = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			const outer = tblOuterRef.current;
			const track = scrollTopRef.current;
			if (!outer || !track || e.target !== track) return;
			const { scrollWidth, clientWidth } = outer;
			const trackWidth = track.clientWidth;
			const thumbWidth = Math.min(
				trackWidth,
				Math.max(MIN_THUMB_WIDTH, (clientWidth / scrollWidth) * trackWidth),
			);
			const maxThumbTravel = trackWidth - thumbWidth;
			if (maxThumbTravel <= 0) return;
			const rect = track.getBoundingClientRect();
			const clickX = e.clientX - rect.left - thumbWidth / 2;
			const ratio = Math.min(1, Math.max(0, clickX / maxThumbTravel));
			outer.scrollLeft = ratio * (scrollWidth - clientWidth);
		},
		[],
	);

	/** Ctrl + lăn chuột: cuộn ngang bảng, đồng thời chặn trình duyệt zoom trang. */
	const onWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
		if (!e.ctrlKey) return;
		const outer = tblOuterRef.current;
		if (!outer) return;
		e.preventDefault();
		outer.scrollLeft += e.deltaY;
	}, []);

	return {
		tblOuterRef,
		scrollTopRef,
		thumb,
		onThumbPointerDown,
		onThumbPointerMove,
		onThumbPointerUp,
		onTrackPointerDown,
		onWheel,
	};
}
