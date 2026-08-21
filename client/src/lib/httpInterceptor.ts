// Gắn tự động header "Authorization: Bearer <token>" cho mọi request tới
// /api/* (trừ /api/auth/login) và tự đăng xuất khi token hết hạn/không hợp lệ (401).
// Import 1 lần (side-effect) ở main.tsx, trước khi app render — vì hầu hết
// component trong app gọi fetch() trực tiếp, không đi qua 1 client dùng chung.
const TOKEN_KEY = 'auth_token';
const STORAGE_KEY = 'auth_user';

const nativeFetch = window.fetch.bind(window);

function resolveUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.toString();
	return input.url;
}

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
	const url = resolveUrl(input);

	if (!url.startsWith('/api/') || url.startsWith('/api/auth/login')) {
		return nativeFetch(input, init);
	}

	const token = localStorage.getItem(TOKEN_KEY);
	const headers = new Headers(
		init?.headers ?? (input instanceof Request ? input.headers : undefined),
	);
	if (token) headers.set('Authorization', `Bearer ${token}`);

	return nativeFetch(input, { ...init, headers }).then((res) => {
		if (res.status === 401) {
			localStorage.removeItem(TOKEN_KEY);
			localStorage.removeItem(STORAGE_KEY);
			if (location.pathname !== '/') location.href = '/';
		}
		return res;
	});
};
