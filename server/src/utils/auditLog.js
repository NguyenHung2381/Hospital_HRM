const crypto = require('crypto');
const { logger } = require('../config/logger');
const { moduleOf, methodVerb, normalizeIp } = require('./logDescribe');

// Nhật ký hoạt động: ghi lại AI làm GÌ, LÚC NÀO, TỪ ĐÂU, KẾT QUẢ ra sao — mỗi
// request tới /api là đúng 1 dòng JSON (config/logger.js, pino + pino-roll).
//  - requestLogger: middleware đặt đầu /api, ghi khi response kết thúc.
//  - audit(req, action, details): controller gắn tên hành động nghiệp vụ
//    (vd 'auth.login', 'user.reset_password') vào dòng log của request đó.
//  - logError(err, req): lỗi 5xx — gắn message + stack vào dòng log.
// Chỉ ghi method + đường dẫn + tham số, KHÔNG ghi body (có thể chứa mật khẩu
// / dữ liệu nhân sự) và KHÔNG ghi token/cookie.

const MAX_UA_LEN = 300;
const MAX_QUERY_LEN = 500;

// Mặc định ghi mọi method. Thu hẹp bằng LOG_REQUEST_METHODS=POST,PUT,DELETE
const ONLY_METHODS = new Set(
	(process.env.LOG_REQUEST_METHODS || '')
		.split(',')
		.map((m) => m.trim().toUpperCase())
		.filter(Boolean),
);

// Luồng realtime (SSE) mở hàng giờ — không phải thao tác người dùng.
const SKIP_PATHS = new Set(['/api/subscribe']);

function actorFields(req) {
	return {
		actor_id: req?.user?.id_user ?? null,
		actor_username: req?.user?.username ?? null,
		actor_role: req?.user?.name_role ?? null,
	};
}

function queryString(req) {
	if (!req.query || !Object.keys(req.query).length) return undefined;
	const s = JSON.stringify(req.query);
	return s.length > MAX_QUERY_LEN ? `${s.slice(0, MAX_QUERY_LEN)}…` : s;
}

/**
 * Gắn hành động nghiệp vụ vào dòng log của request hiện tại. Không có req
 * (tác vụ nền) → ghi ngay thành 1 dòng riêng.
 * @param {import('express').Request | null} req
 * @param {string} action  vd 'auth.login', 'user.reset_password'
 * @param {object} [details] thông tin thêm (id đối tượng...) — không chứa bí mật
 */
function audit(req, action, details = {}) {
	if (req && req.logCtx) {
		req.logCtx.action = action;
		Object.assign(req.logCtx.details, details);
		return;
	}
	try {
		logger.info(
			{ kind: 'event', action, ...actorFields(req), ip: normalizeIp(req?.ip), details },
			action,
		);
	} catch {
		// ghi log hỏng không được làm hỏng nghiệp vụ
	}
}

function logError(err, req) {
	const error = {
		message: String(err?.message || err).slice(0, 1000),
		code: err?.code ?? err?.number ?? undefined,
		stack: err?.stack ? String(err.stack).split('\n').slice(0, 15).join('\n') : undefined,
	};
	if (req && req.logCtx) {
		req.logCtx.error = error;
		return;
	}
	try {
		logger.error({ kind: 'system', action: 'system.error', error }, 'system error');
	} catch {
		// bỏ qua
	}
}

// Gắn request id (trả về header X-Request-Id — người dùng báo lỗi kèm mã này
// là tra được đúng dòng log) và ghi 1 dòng log khi request kết thúc.
function requestLogger(req, res, next) {
	req.id = crypto.randomUUID();
	res.set('X-Request-Id', req.id);
	req.logCtx = { action: null, details: {}, error: null };

	if (SKIP_PATHS.has(req.originalUrl.split('?')[0])) return next();
	if (ONLY_METHODS.size && !ONLY_METHODS.has(req.method)) return next();

	const startedAt = process.hrtime.bigint();

	// 'close' luôn bắn, kể cả khi client huỷ giữa chừng.
	res.on('close', () => {
		try {
			const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
			const aborted = !res.writableFinished;
			const status = aborted ? 499 : res.statusCode;
			const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : undefined;
			const ctx = req.logCtx;
			const action =
				ctx.action ||
				(status === 403 ? 'denied' : methodVerb(req.method, route || req.path));
			const entry = {
				kind: 'request',
				request_id: req.id,
				action,
				module: moduleOf(route || req.originalUrl),
				...actorFields(req),
				session_id: req.auth?.sid ?? undefined,
				auth_via: req.auth?.via ?? undefined,
				method: req.method,
				path: req.originalUrl.split('?')[0].slice(0, 300),
				route,
				params: req.params && Object.keys(req.params).length ? req.params : undefined,
				query: queryString(req),
				status_code: status,
				duration_ms: Math.round(durationMs * 10) / 10,
				ip: normalizeIp(req.ip),
				user_agent: (req.headers['user-agent'] || '').slice(0, MAX_UA_LEN) || undefined,
				details: Object.keys(ctx.details).length ? ctx.details : undefined,
				error: ctx.error || undefined,
			};
			if (status >= 500) logger.error(entry, action);
			else if (status >= 400) logger.warn(entry, action);
			else logger.info(entry, action);
		} catch {
			// ghi log hỏng không được làm sập tiến trình
		}
	});

	next();
}

module.exports = { audit, logError, requestLogger };
