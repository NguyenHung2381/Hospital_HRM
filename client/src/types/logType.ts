// Kiểu dữ liệu trang Nhật ký hệ thống + phiên đăng nhập (khớp server:
// services/logReader.js, controllers/logs.js, controllers/auth.js)

export type ActionKind =
	| 'view'
	| 'create'
	| 'update'
	| 'delete'
	| 'export'
	| 'denied'
	| 'login'
	| 'login_failed'
	| 'refresh'
	| 'auth'
	| 'error'
	| 'other';

export interface LogRow {
	id: string;
	time: string;
	kind: 'request' | 'event' | 'system';
	request_id: string | null;
	actor_id: number | null;
	actor_username: string | null;
	actor_role: string | null;
	session_id: string | null;
	auth_via: 'cookie' | 'bearer' | null;
	method: string | null;
	path: string | null;
	route: string | null;
	params: Record<string, string> | null;
	query: string | null;
	status_code: number | null;
	duration_ms: number | null;
	ip: string | null;
	user_agent: string | null;
	details: Record<string, unknown> | null;
	error: { message: string; code?: string | number; stack?: string } | null;
	module: string;
	module_label: string;
	action: string | null;
	action_kind: ActionKind;
	action_label: string;
	summary: string;
}

export interface LogListResponse {
	success: boolean;
	data: LogRow[];
	total: number;
	page: number;
	limit: number;
	total_pages: number;
	truncated: boolean;
}

export interface LogFilters {
	from: string;
	to: string;
	actor: string;
	kind: string;
	module: string;
	status: string;
	ip: string;
	search: string;
	hide_noise: boolean;
}

export interface DayStat {
	day: string;
	requests: number;
	writes: number;
	errors: number;
	failed_logins: number;
}

export interface EndpointStat {
	endpoint: string;
	count: number;
	errors: number;
	avg_ms: number | null;
	p95_ms: number | null;
}

export interface LogStats {
	range: { from: string | null; to: string | null };
	truncated: boolean;
	totals: {
		requests: number;
		writes: number;
		errors: number;
		server_errors: number;
		denied: number;
		logins: number;
		failed_logins: number;
		users: number;
		ips: number;
		avg_ms: number | null;
		p95_ms: number | null;
	};
	by_day: DayStat[];
	by_hour: number[];
	by_kind: Record<string, number>;
	top_modules: { module: string; label: string; count: number }[];
	top_users: {
		actor_id: number;
		actor_username: string | null;
		actor_role: string | null;
		count: number;
		writes: number;
		errors: number;
	}[];
	slowest_endpoints: EndpointStat[];
	error_endpoints: EndpointStat[];
	failed_login_ips: { ip: string; count: number }[];
}

export interface LogMeta {
	retention_days: number;
	file_count: number;
	total_bytes: number;
	oldest_day: string | null;
	modules: Record<string, string>;
	actions: Record<string, string>;
}

export interface AuthSession {
	id: string;
	id_user: number;
	username?: string;
	full_name?: string;
	name_role?: string | null;
	ip_address: string | null;
	user_agent: string | null;
	created_at: string;
	last_used_at: string;
	expires_at: string;
	current: boolean;
}
