// Phiên đăng nhập nằm trong cookie HttpOnly do server đặt (JavaScript không
// đọc được token) — trình duyệt tự gửi cookie kèm mọi request cùng origin.
//  - hrm_session: access token ngắn hạn (mặc định 15 phút)
//  - hrm_refresh: refresh token, chỉ gửi tới /api/auth/*
// Interceptor này:
//  - gắn header chống CSRF "X-Requested-With" cho mọi request tới /api/*;
//  - access token hết hạn (401) → tự gọi /api/auth/refresh (1 lần cho mọi
//    request đang chờ) rồi gửi lại request; làm mới thất bại → đăng xuất.
// Import 1 lần (side-effect) ở main.tsx, trước khi app render — vì hầu hết
// component trong app gọi fetch() trực tiếp, không đi qua 1 client dùng chung.
const STORAGE_KEY = 'auth_user';

// Các endpoint xác thực tự xử lý 401 của chúng — không làm mới/đăng xuất tự động
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/token'];

const nativeFetch = window.fetch.bind(window);

function resolveUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.toString();
	return input.url;
}

function toApiPath(url: string): string {
	try {
		const u = new URL(url, location.origin);
		return u.origin === location.origin ? u.pathname : url;
	} catch {
		return url;
	}
}

function forceLogout() {
	localStorage.removeItem(STORAGE_KEY);
	if (location.pathname !== '/') location.href = '/';
}

// Single-flight: nhiều request cùng gặp 401 chỉ gọi refresh 1 lần
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
	if (!refreshing) {
		refreshing = nativeFetch('/api/auth/refresh', {
			method: 'POST',
			headers: { 'X-Requested-With': 'XMLHttpRequest' },
			credentials: 'same-origin',
		})
			.then((res) => res.ok)
			.catch(() => false)
			.finally(() => {
				// Giữ kết quả thêm chút để các request về trễ dùng lại
				setTimeout(() => {
					refreshing = null;
				}, 1000);
			});
	}
	return refreshing;
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	const path = toApiPath(resolveUrl(input));

	if (!path.startsWith('/api/')) {
		return nativeFetch(input, init);
	}

	const headers = new Headers(
		init?.headers ?? (input instanceof Request ? input.headers : undefined),
	);
	headers.set('X-Requested-With', 'XMLHttpRequest');

	// Request object có body chỉ đọc được 1 lần → giữ bản sao để gửi lại
	const retryInput = input instanceof Request ? input.clone() : input;
	const send = (req: RequestInfo | URL) =>
		nativeFetch(req, { ...init, headers, credentials: 'same-origin' });

	const res = await send(input);
	if (res.status !== 401 || AUTH_ENDPOINTS.some((p) => path.startsWith(p))) return res;

	// Chưa từng đăng nhập trên trình duyệt này → không cần thử làm mới
	if (!localStorage.getItem(STORAGE_KEY)) return res;

	if (await refreshSession()) {
		const retried = await send(retryInput);
		if (retried.status !== 401) return retried;
	}
	forceLogout();
	return res;
};

// Dọn token cũ còn sót trong localStorage từ phiên bản trước (đã chuyển sang cookie)
localStorage.removeItem('auth_token');
