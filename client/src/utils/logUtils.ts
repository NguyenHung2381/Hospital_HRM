// Helper hiển thị cho trang Nhật ký hệ thống & danh sách phiên đăng nhập

export function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleString('vi-VN', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});
}

// "5 phút trước", "2 giờ trước"...
export function timeAgo(iso: string | null | undefined): string {
	if (!iso) return '—';
	const diff = Date.now() - new Date(iso).getTime();
	if (diff < 60_000) return 'vừa xong';
	const min = Math.floor(diff / 60_000);
	if (min < 60) return `${min} phút trước`;
	const h = Math.floor(min / 60);
	if (h < 24) return `${h} giờ trước`;
	return `${Math.floor(h / 24)} ngày trước`;
}

// User-Agent → "Chrome · Windows" (đủ để người dùng nhận ra thiết bị)
export function describeUserAgent(ua: string | null | undefined): string {
	if (!ua) return 'Không rõ thiết bị';
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /OPR\//.test(ua)
			? 'Opera'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: /PostmanRuntime/.test(ua)
							? 'Postman'
							: /curl\//.test(ua)
								? 'curl'
								: null;
	const os = /Windows/.test(ua)
		? 'Windows'
		: /Android/.test(ua)
			? 'Android'
			: /iPhone|iPad/.test(ua)
				? 'iOS'
				: /Mac OS X/.test(ua)
					? 'macOS'
					: /Linux/.test(ua)
						? 'Linux'
						: null;
	if (!browser && !os) return ua.slice(0, 40);
	return [browser, os].filter(Boolean).join(' · ');
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
	if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
	return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function statusTone(code: number | null): 'ok' | 'warn' | 'err' | 'muted' {
	if (code == null) return 'muted';
	if (code >= 500) return 'err';
	if (code >= 400) return 'warn';
	return 'ok';
}

// Ngày hôm nay / N ngày trước dạng YYYY-MM-DD theo giờ máy
export function isoDay(offsetDays = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
