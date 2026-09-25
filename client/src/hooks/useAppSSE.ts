import { useEffect, useRef } from 'react';
import { refreshSession } from '@/lib/httpInterceptor';

type SSEPayload = {
	resource: 'reports' | 'departments' | 'users' | 'roles' | 'coordination';
	action: 'created' | 'updated' | 'deleted';
	id: number;
};

type Handler = (payload: SSEPayload) => void;

// Singleton SSE connection — chỉ mở 1 kết nối dù có nhiều component dùng
let es: EventSource | null = null;
let refCount = 0;
const handlers = new Set<Handler>();

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

// Xác thực bằng cookie phiên HttpOnly — EventSource tự gửi cookie cùng origin,
// nên không cần (và không được) đưa token vào URL.
function connectSSE() {
	if (es && es.readyState !== EventSource.CLOSED) return;
	const source = new EventSource('/api/subscribe');
	es = source;
	source.onopen = () => {
		failures = 0;
	};
	source.onmessage = (e) => {
		const payload: SSEPayload = JSON.parse(e.data);
		handlers.forEach((h) => h(payload));
	};
	// Lỗi mạng tạm thời → trình duyệt tự kết nối lại. Server trả lỗi (vd 401
	// khi access token hết hạn) → EventSource đóng hẳn: làm mới phiên rồi tự
	// kết nối lại, giãn dần thời gian chờ.
	source.onerror = () => {
		if (source.readyState !== EventSource.CLOSED || refCount === 0) return;
		if (reconnectTimer) return;
		const delay = Math.min(30000, 1000 * 2 ** failures++);
		reconnectTimer = setTimeout(async () => {
			reconnectTimer = null;
			if (refCount === 0 || es !== source) return;
			await refreshSession();
			if (refCount > 0 && es === source) connectSSE();
		}, delay);
	};
}

export function useAppSSE(onChanged: Handler) {
	const handlerRef = useRef(onChanged);
	handlerRef.current = onChanged;

	useEffect(() => {
		const handler: Handler = (payload) => handlerRef.current(payload);
		handlers.add(handler);
		refCount++;
		connectSSE(); // đảm bảo kết nối đang mở

		return () => {
			handlers.delete(handler);
			refCount--;
			// Đóng kết nối khi không còn component nào dùng
			if (refCount === 0 && es) {
				es.close();
				es = null;
			}
		};
	}, []);
}
