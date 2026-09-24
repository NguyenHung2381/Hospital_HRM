// Phiên đăng nhập nằm trong cookie HttpOnly do server đặt (JavaScript không
// đọc được token) — trình duyệt tự gửi cookie kèm mọi request cùng origin.
// Interceptor này chỉ:
//  - gắn header chống CSRF "X-Requested-With" cho mọi request tới /api/*;
//  - tự đăng xuất khi phiên hết hạn/không hợp lệ (401).
// Import 1 lần (side-effect) ở main.tsx, trước khi app render — vì hầu hết
// component trong app gọi fetch() trực tiếp, không đi qua 1 client dùng chung.
const STORAGE_KEY = 'auth_user';

const nativeFetch = window.fetch.bind(window);

function resolveUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.toString();
	return input.url;
}

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
	const url = resolveUrl(input);

	if (!url.startsWith('/api/')) {
		return nativeFetch(input, init);
	}

	const headers = new Headers(
		init?.headers ?? (input instanceof Request ? input.headers : undefined),
	);
	headers.set('X-Requested-With', 'XMLHttpRequest');

	return nativeFetch(input, {
		...init,
		headers,
		credentials: 'same-origin',
	}).then((res) => {
		// Sai mật khẩu / pre-auth 2FA hết hạn khi đăng nhập cũng trả 401 →
		// không coi là hết phiên
		if (
			res.status === 401 &&
			!url.startsWith('/api/auth/login') &&
			!url.startsWith('/api/auth/2fa/verify')
		) {
			localStorage.removeItem(STORAGE_KEY);
			if (location.pathname !== '/') location.href = '/';
		}
		return res;
	});
};

// Dọn token cũ còn sót trong localStorage từ phiên bản trước (đã chuyển sang cookie)
localStorage.removeItem('auth_token');
