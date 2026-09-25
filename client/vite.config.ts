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
		// Chạy trong Docker (docker-compose.dev.yml): API ở container `api`, và
		// bind mount không phát fs-events nên phải polling mới thấy file đổi.
		proxy: {
			'/api': process.env.VITE_API_PROXY || 'http://localhost:3000',
		},
		watch:
			process.env.VITE_USE_POLLING === 'true'
				? { usePolling: true, interval: 300 }
				: undefined,
	},
});
