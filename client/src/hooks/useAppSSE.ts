import { useEffect, useRef } from 'react';

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

// Xác thực bằng cookie phiên HttpOnly — EventSource tự gửi cookie cùng origin,
// nên không cần (và không được) đưa token vào URL.
function connectSSE() {
	if (es && es.readyState !== EventSource.CLOSED) return;
	es = new EventSource('/api/subscribe');
	es.onmessage = (e) => {
		const payload: SSEPayload = JSON.parse(e.data);
		handlers.forEach((h) => h(payload));
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
