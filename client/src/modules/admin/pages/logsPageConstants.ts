import type { LogFilters } from '@/types/logType';
import { isoDay } from '@/utils/logUtils';

// Mặc định: 7 ngày gần nhất, ẩn thao tác xem & làm mới phiên
export const DEFAULT_FILTERS: LogFilters = {
	from: isoDay(-6),
	to: isoDay(0),
	actor: '',
	kind: '',
	module: '',
	status: '',
	ip: '',
	search: '',
	hide_noise: true,
};

// Bộ lọc → query string cho /api/logs, /api/logs/stats, /api/logs/export
export function filtersToQuery(f: LogFilters, extra: Record<string, string | number> = {}) {
	const q = new URLSearchParams();
	for (const [k, v] of Object.entries(f)) {
		if (typeof v === 'boolean') {
			if (v) q.set(k, '1');
		} else if (v) q.set(k, v);
	}
	for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
	return q.toString();
}
