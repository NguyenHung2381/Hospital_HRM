import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	base: '/',
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	server: {
		host: true,
		// KHÔNG đặt true — allowedHosts:true tắt hẳn cơ chế chống DNS-rebinding
		// của Vite, nguy hiểm nếu chạy `npm run dev` trên máy đã thông Internet.
		// Mặc định (không set) Vite chỉ cho phép localhost + hostname cấu hình —
		// đủ dùng để mở dev server từ máy khác trong LAN qua http://<ip-may>:5173.
		// Chạy trong Docker (docker-compose.yml): API ở container `api`, và
		// bind mount không phát fs-events nên phải polling mới thấy file đổi.
		// xfwd: GHI THÊM IP thật của client vào cuối X-Forwarded-For. Backend tin
		// đúng 1 hop (TRUST_PROXY=1) nên lấy giá trị cuối — nếu proxy chỉ chuyển
		// nguyên header client gửi, client tự đặt X-Forwarded-For giả là đổi
		// được IP và lách giới hạn đăng nhập/2FA theo IP.
		proxy: {
			'/api': {
				target: process.env.VITE_API_PROXY || 'http://localhost:3000',
				xfwd: true,
			},
		},
		// Polling tốn CPU theo (số file × tần suất): quét mỗi 1s (thay vì 300ms)
		// và bỏ qua thư mục build/tooling không cần theo dõi.
		watch:
			process.env.VITE_USE_POLLING === 'true'
				? {
						usePolling: true,
						interval: 1000,
						binaryInterval: 3000,
						ignored: ['**/dist/**', '**/docker/**', '**/.vite/**'],
					}
				: undefined,
	},
});
