// Đọc nhật ký hoạt động trực tiếp từ các file log xoay theo ngày (cách làm
// giống dự án RMS). Việc GHI nằm ở utils/auditLog.js → config/logger.js.
// File này lo phần ĐỌC cho trang Nhật ký hệ thống: danh sách (lọc + phân
// trang), thống kê, xuất Excel và xoá log quá hạn.

const fsp = require('fs/promises');
const path = require('path');
const { LOG_DIR } = require('../config/logger');
const { describe, normalizeIp, MODULE_LABELS, ACTION_LABELS } = require('../utils/logDescribe');

const MAX_FILES_SCANNED = 400;
const MAX_LINES_SCANNED = 500_000;
const DAY_MS = 86_400_000;
// Múi giờ Việt Nam (UTC+7) — gom thống kê theo ngày/giờ địa phương.
const TZ_OFFSET_MS = 7 * 3_600_000;

const RETENTION_DAYS = Math.max(1, parseInt(process.env.LOG_RETENTION_DAYS, 10) || 90);

// audit.2026-09-24.1.log (pino-roll) + audit-2026-09-24.log (định dạng cũ)
const FILE_RE = /^audit[.-](\d{4}-\d{2}-\d{2})(?:\.\d+)?\.log$/;

async function listLogFiles() {
	let names;
	try {
		names = await fsp.readdir(LOG_DIR);
	} catch (err) {
		if (err.code === 'ENOENT') return [];
		throw err;
	}
	const files = await Promise.all(
		names.map(async (name) => {
			const m = FILE_RE.exec(name);
			if (!m) return null;
			const full = path.join(LOG_DIR, name);
			try {
				const st = await fsp.stat(full);
				return st.isFile() ? { name, full, day: m[1], mtime: st.mtimeMs, size: st.size } : null;
			} catch {
				return null;
			}
		}),
	);
	return files
		.filter(Boolean)
		.sort((a, b) => b.mtime - a.mtime)
		.slice(0, MAX_FILES_SCANNED);
}

const toMs = (v) => {
	if (v == null || v === '') return undefined;
	if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return Date.parse(`${v}T00:00:00+07:00`);
	const n = Number(v);
	if (Number.isFinite(n)) return n;
	const t = Date.parse(v);
	return Number.isNaN(t) ? undefined : t;
};

const list = (v) =>
	v
		? String(v)
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

// Chuẩn hoá query string → bộ lọc, dùng chung cho list / stats / export.
// "to" dạng YYYY-MM-DD tính hết ngày đó.
function parseFilters(q = {}) {
	let to = toMs(q.to);
	if (to != null && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) to += DAY_MS - 1;
	return {
		from: toMs(q.from),
		to,
		actor: q.actor ? String(q.actor).trim().toLowerCase() : undefined,
		actor_id: q.actor_id ? String(q.actor_id) : undefined,
		methods: list(q.method).map((m) => m.toUpperCase()),
		kinds: list(q.kind),
		modules: list(q.module),
		status: q.status ? String(q.status) : undefined,
		ip: q.ip ? String(q.ip).trim() : undefined,
		search: q.search ? String(q.search).trim().toLowerCase().slice(0, 200) : undefined,
		hide_noise: q.hide_noise === '1' || q.hide_noise === 'true',
	};
}

// Dòng log thô → object trả về client. Dòng định dạng cũ (audit-*.log trước
// khi dùng pino) có user_id/username thay vì actor_id/actor_username.
function toRow(o, ts) {
	const legacy = o.stream == null;
	const src = legacy
		? {
				...o,
				actor_id: o.user_id,
				actor_username: o.username,
				status_code: o.status ?? 200,
				// action cũ dạng "PUT /api/users/:id" → tách method + route
				...(/^[A-Z]+ \//.test(o.action || '')
					? {
							method: o.action.split(' ')[0],
							route: o.action.split(' ')[1],
							action: undefined,
						}
					: {}),
			}
		: o;
	const d = describe(src);
	return {
		id: `${ts}`,
		time: o.time ?? new Date(ts).toISOString(),
		kind: src.kind ?? 'event',
		request_id: src.request_id ?? null,
		actor_id: src.actor_id ?? null,
		actor_username: src.actor_username ?? null,
		actor_role: src.actor_role ?? null,
		session_id: src.session_id ?? null,
		auth_via: src.auth_via ?? null,
		method: src.method ?? null,
		path: src.path ?? src.route ?? null,
		route: src.route ?? null,
		params: src.params ?? null,
		query: src.query ?? null,
		status_code: src.status_code ?? null,
		duration_ms: typeof src.duration_ms === 'number' ? src.duration_ms : null,
		ip: normalizeIp(src.ip),
		user_agent: src.user_agent ?? null,
		details: src.details ?? (legacy ? pickLegacyDetails(o) : null),
		error: src.error ?? null,
		level: o.level ?? 30,
		...d,
		_ts: ts,
	};
}

function pickLegacyDetails(o) {
	const { time, action, user_id, username, ip, status, params, ...rest } = o;
	return Object.keys(rest).length ? rest : null;
}

function statusMatches(code, status) {
	const c = Number(code) || 0;
	switch (status) {
		case '2xx':
			return c >= 200 && c < 300;
		case '4xx':
			return c >= 400 && c < 500;
		case '5xx':
			return c >= 500;
		case 'error':
			return c >= 400;
		default:
			return /^\d{3}(,\d{3})*$/.test(status) ? status.split(',').map(Number).includes(c) : true;
	}
}

function rowMatches(r, f) {
	if (f.methods.length && !f.methods.includes(String(r.method).toUpperCase())) return false;
	if (f.kinds.length && !f.kinds.includes(r.action_kind)) return false;
	if (f.hide_noise && (r.action_kind === 'view' || r.action_kind === 'refresh')) return false;
	if (f.modules.length && !f.modules.includes(r.module)) return false;
	if (f.status && !statusMatches(r.status_code, f.status)) return false;
	if (f.actor_id && String(r.actor_id ?? '') !== f.actor_id) return false;
	if (
		f.actor &&
		![r.actor_id, r.actor_username, r.details?.attempted_username].some((v) =>
			String(v ?? '')
				.toLowerCase()
				.includes(f.actor),
		)
	)
		return false;
	if (f.ip && !String(r.ip ?? '').includes(f.ip)) return false;
	if (f.search) {
		const hay =
			`${r.path} ${r.summary} ${r.request_id ?? ''} ${r.error?.message ?? ''} ${JSON.stringify(r.details ?? '')}`.toLowerCase();
		if (!hay.includes(f.search)) return false;
	}
	return true;
}

// Duyệt log MỚI → CŨ, gọi onRow(row) cho mỗi dòng khớp bộ lọc.
async function scan(filters, onRow) {
	const files = await listLogFiles();
	let linesScanned = 0;

	for (const { full, day, mtime } of files) {
		// Bỏ qua file chắc chắn nằm ngoài khoảng lọc (ngày trong tên file ± 1
		// ngày để an toàn khi lệch múi giờ).
		const dayStart = Date.parse(`${day}T00:00:00Z`);
		if (filters.from != null && mtime < filters.from) continue;
		if (filters.to != null && dayStart - DAY_MS > filters.to) continue;

		let content;
		try {
			content = await fsp.readFile(full, 'utf8');
		} catch {
			continue;
		}
		const lines = content.split('\n');
		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i];
			if (!line) continue;
			if (++linesScanned > MAX_LINES_SCANNED) return { truncated: true };
			let o;
			try {
				o = JSON.parse(line);
			} catch {
				continue; // dòng hỏng / đang ghi dở
			}
			if (o.stream != null && o.stream !== 'audit') continue;
			const ts = typeof o.ts === 'number' ? o.ts : Date.parse(o.time);
			if (Number.isNaN(ts)) continue;
			if (filters.from != null && ts < filters.from) continue;
			if (filters.to != null && ts > filters.to) continue;
			const row = toRow(o, ts);
			if (rowMatches(row, filters)) onRow(row);
		}
	}
	return { truncated: false };
}

const stripInternal = ({ _ts, ...row }) => row;

// Mặc định 7 ngày gần nhất nếu không chỉ định khoảng thời gian — tránh quét
// toàn bộ log mỗi lần mở trang.
function withDefaultRange(filters) {
	if (filters.from == null && filters.to == null) filters.from = Date.now() - 7 * DAY_MS;
	return filters;
}

async function getAll(query = {}) {
	const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 200);
	const page = Math.max(1, parseInt(query.page, 10) || 1);
	const filters = withDefaultRange(parseFilters(query));
	const rows = [];
	const { truncated } = await scan(filters, (r) => rows.push(r));
	rows.sort((a, b) => b._ts - a._ts);
	const total = rows.length;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const safePage = Math.min(page, totalPages);
	return {
		data: rows.slice((safePage - 1) * limit, safePage * limit).map(stripInternal),
		total,
		page: safePage,
		limit,
		total_pages: totalPages,
		truncated,
	};
}

async function getRowsForExport(query = {}, max = 50_000) {
	const filters = withDefaultRange(parseFilters(query));
	const rows = [];
	const { truncated } = await scan(filters, (r) => rows.push(r));
	rows.sort((a, b) => b._ts - a._ts);
	return { rows: rows.slice(0, max).map(stripInternal), truncated: truncated || rows.length > max };
}

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const percentile = (sorted, p) =>
	sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] : null;
const localDay = (ts) => new Date(ts + TZ_OFFSET_MS).toISOString().slice(0, 10);

async function getStats(query = {}) {
	const filters = withDefaultRange(parseFilters(query));
	const rows = [];
	const { truncated } = await scan(filters, (r) => rows.push(r));

	const durations = [];
	const byDay = new Map();
	const byHour = Array(24).fill(0);
	const byKind = {};
	const byModule = new Map();
	const users = new Map();
	const endpoints = new Map();
	const failedByIp = new Map();
	const ips = new Set();
	const totals = { requests: 0, writes: 0, errors: 0, server_errors: 0, denied: 0, logins: 0, failed_logins: 0 };

	for (const r of rows) {
		const code = r.status_code ?? 0;
		totals.requests++;
		if (['create', 'update', 'delete'].includes(r.action_kind)) totals.writes++;
		if (code >= 400) totals.errors++;
		if (code >= 500) totals.server_errors++;
		if (code === 403) totals.denied++;
		if (r.action_kind === 'login') totals.logins++;
		if (r.action_kind === 'login_failed') {
			totals.failed_logins++;
			if (r.ip) failedByIp.set(r.ip, (failedByIp.get(r.ip) || 0) + 1);
		}
		if (r.duration_ms != null && r.kind === 'request') durations.push(r.duration_ms);
		if (r.ip) ips.add(r.ip);
		byKind[r.action_kind] = (byKind[r.action_kind] || 0) + 1;

		const day = localDay(r._ts);
		const d = byDay.get(day) || { day, requests: 0, writes: 0, errors: 0, failed_logins: 0 };
		d.requests++;
		if (['create', 'update', 'delete'].includes(r.action_kind)) d.writes++;
		if (code >= 400) d.errors++;
		if (r.action_kind === 'login_failed') d.failed_logins++;
		byDay.set(day, d);

		byHour[new Date(r._ts + TZ_OFFSET_MS).getUTCHours()]++;

		const m = byModule.get(r.module) || { module: r.module, label: r.module_label, count: 0 };
		m.count++;
		byModule.set(r.module, m);

		if (r.actor_id) {
			const u = users.get(r.actor_id) || {
				actor_id: r.actor_id,
				actor_username: r.actor_username,
				actor_role: r.actor_role,
				count: 0,
				writes: 0,
				errors: 0,
				last_at: r.time,
			};
			u.count++;
			if (['create', 'update', 'delete'].includes(r.action_kind)) u.writes++;
			if (code >= 400) u.errors++;
			users.set(r.actor_id, u);
		}

		if (r.kind === 'request' && r.method) {
			const key = `${r.method} ${r.route || r.path}`;
			const ep = endpoints.get(key) || { endpoint: key, count: 0, errors: 0, durations: [] };
			ep.count++;
			if (code >= 500) ep.errors++;
			if (r.duration_ms != null) ep.durations.push(r.duration_ms);
			endpoints.set(key, ep);
		}
	}

	// Điền đủ các ngày trong khoảng (ngày không có log = 0) để biểu đồ liền mạch.
	const days = [];
	const endTs = filters.to ?? Date.now();
	for (let t = filters.from ?? endTs - 6 * DAY_MS; t <= endTs && days.length < 400; t += DAY_MS) {
		const day = localDay(t);
		if (!days.length || days[days.length - 1].day !== day)
			days.push(byDay.get(day) || { day, requests: 0, writes: 0, errors: 0, failed_logins: 0 });
	}

	durations.sort((a, b) => a - b);
	const epList = [...endpoints.values()].map(({ durations: d, ...ep }) => {
		d.sort((a, b) => a - b);
		return {
			...ep,
			avg_ms: d.length ? round1(d.reduce((s, x) => s + x, 0) / d.length) : null,
			p95_ms: round1(percentile(d, 95)),
		};
	});

	return {
		range: {
			from: filters.from != null ? new Date(filters.from).toISOString() : null,
			to: filters.to != null ? new Date(filters.to).toISOString() : null,
		},
		truncated,
		totals: {
			...totals,
			users: users.size,
			ips: ips.size,
			avg_ms: durations.length ? round1(durations.reduce((s, x) => s + x, 0) / durations.length) : null,
			p95_ms: round1(percentile(durations, 95)),
		},
		by_day: days,
		by_hour: byHour,
		by_kind: byKind,
		top_modules: [...byModule.values()].sort((a, b) => b.count - a.count).slice(0, 10),
		top_users: [...users.values()].sort((a, b) => b.count - a.count).slice(0, 10),
		slowest_endpoints: epList
			.filter((e) => e.p95_ms != null && e.count >= 3)
			.sort((a, b) => b.p95_ms - a.p95_ms)
			.slice(0, 8),
		error_endpoints: epList
			.filter((e) => e.errors > 0)
			.sort((a, b) => b.errors - a.errors)
			.slice(0, 8),
		failed_login_ips: [...failedByIp.entries()]
			.map(([ip, count]) => ({ ip, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 8),
	};
}

async function getMeta() {
	const files = await listLogFiles();
	return {
		retention_days: RETENTION_DAYS,
		file_count: files.length,
		total_bytes: files.reduce((s, f) => s + f.size, 0),
		oldest_day: files.length ? files.map((f) => f.day).sort()[0] : null,
		modules: MODULE_LABELS,
		actions: ACTION_LABELS,
	};
}

// Xoá file log cũ hơn LOG_RETENTION_DAYS (theo ngày trong tên file). Chạy lúc
// khởi động và định kỳ — pino-roll chỉ tự xoá khi xoay file nên không đủ tin cậy
// khi server khởi động lại thường xuyên.
async function pruneOldLogs() {
	const cutoff = localDay(Date.now() - RETENTION_DAYS * DAY_MS);
	let names;
	try {
		names = await fsp.readdir(LOG_DIR);
	} catch {
		return 0;
	}
	let removed = 0;
	for (const name of names) {
		const m = FILE_RE.exec(name);
		if (!m || m[1] >= cutoff) continue;
		try {
			await fsp.unlink(path.join(LOG_DIR, name));
			removed++;
		} catch {
			// file đang bị khoá / đã bị xoá — lần sau thử lại
		}
	}
	return removed;
}

module.exports = { getAll, getStats, getMeta, getRowsForExport, pruneOldLogs, LOG_DIR, RETENTION_DAYS };
