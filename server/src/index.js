require('dotenv').config();

// ── Kiểm tra cấu hình bắt buộc (fail-closed, giống RMS) ─────────
// Thiếu biến nhạy cảm thì KHÔNG khởi động, thay vì chạy với giá trị mặc định
// đoán được hoặc secret ngẫu nhiên tạm thời.
const REQUIRED_ENV = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
	console.error(
		`❌ Thiếu biến môi trường bắt buộc: ${missingEnv.join(', ')}. Xem server/.env.example.`,
	);
	process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
	console.error(
		`❌ JWT_SECRET quá ngắn (< 32 ký tự). Tạo bằng: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
	);
	process.exit(1);
}
// Cảnh báo (không chặn khởi động) 2 rủi ro cấu hình DB phổ biến ở production
if (process.env.NODE_ENV === 'production') {
	// DB cùng máy (hoặc máy host của container) thì không cần TLS
	const localDbHosts = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'];
	if (process.env.DB_SSL !== 'true' && !localDbHosts.includes(String(process.env.DB_HOST).toLowerCase()))
		console.warn('⚠️  DB_SSL khác "true" — kết nối tới PostgreSQL ở máy khác không được mã hoá.');
	if (process.env.COOKIE_SECURE !== 'true')
		console.warn(
			'⚠️  COOKIE_SECURE khác "true" — cookie phiên có thể bị gửi qua HTTP không mã hoá. ' +
				'Bật HTTPS (xem client/public/.htaccess hoặc proxy HTTPS) rồi đặt COOKIE_SECURE=true.',
		);
	if (!process.env.TOTP_ENCRYPTION_KEY)
		console.warn(
			'⚠️  Chưa đặt TOTP_ENCRYPTION_KEY — secret 2FA được mã hoá bằng khoá suy ra từ JWT_SECRET ' +
				'(đổi JWT_SECRET sẽ làm 2FA đang bật không dùng được).',
		);
	if (['postgres', 'hrm_owner'].includes((process.env.DB_USER || '').toLowerCase()))
		console.warn(
			`⚠️  DB_USER=${process.env.DB_USER} — nên dùng role ứng dụng hrm_app (chỉ đọc/ghi dữ liệu, không có quyền DDL).`,
		);
}

process.on('unhandledRejection', (reason) => {
	console.error('❌ Unhandled Promise Rejection:', reason);
});

const express = require('express');
const helmet = require('helmet');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { getPool } = require('./config/db');
const { checkSchemaAndCleanup } = require('./config/schemaCheck');
const { authenticate, requirePasswordChanged, requireDashboardRole } = require('./middleware/auth');
const { requestLogger, logError } = require('./utils/auditLog');
const { pruneOldLogs, RETENTION_DAYS } = require('./services/logReader');
const { pruneRateLimits } = require('./middleware/loginRateLimit');

const app = express();
const PORT = process.env.PORT || 3000;
// Apache/IIS đứng trước Node reverse-proxy cho /api trên CÙNG máy (xem
// client/public/.htaccess) → Node không cần và không nên nghe trên mọi
// interface. Chỉ đổi HOST nếu Node thực sự cần nhận traffic trực tiếp từ
// máy khác (không khuyến khích khi server đã thông ra Internet).
const HOST = process.env.HOST || '127.0.0.1';

// Số hop reverse-proxy đứng trước Node (mặc định 1 = Apache) → lấy đúng IP
// client thật cho req.ip (rate-limit, khoá tài khoản, audit, danh sách phiên).
// Set sai thì IP có thể bị giả mạo qua X-Forwarded-For. Đặt TRUST_PROXY=0 nếu
// Node nhận traffic trực tiếp, không qua proxy.
const TRUST_PROXY = process.env.TRUST_PROXY ?? '1';
app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);
app.use(helmet());

const cors = require('cors');
// Trình duyệt luôn gọi /api cùng origin với trang web (qua Apache rewrite),
// nên về bản chất không cần CORS cho traffic hợp lệ. Đặt CORS_ORIGIN trong
// .env (domain thật, vd "https://hrm.benhvien.vn") nếu có nhu cầu gọi từ
// origin khác; không set thì mặc định KHÔNG cho phép cross-origin nào.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
	.split(',')
	.map((o) => o.trim())
	.filter(Boolean);
app.use(
	cors({
		origin: allowedOrigins.length ? allowedOrigins : false,
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
		exposedHeaders: ['X-Request-Id'],
	}),
);

// Nhật ký hoạt động: mỗi request /api = 1 dòng log (xem utils/auditLog.js).
// Đặt trước express.json để cả request có body lỗi cũng được ghi lại.
app.use('/api', requestLogger);

app.use(express.json({ limit: '1mb' }));

// Dữ liệu nhân sự/bệnh nhân → không cho trình duyệt/proxy lưu cache response API
app.use('/api', (req, res, next) => {
	res.set('Cache-Control', 'no-store');
	next();
});

// Routes
app.use('/api', routes);
app.use('/api', (req, res) =>
	res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'API không tồn tại' }),
);

// Health check – server
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Health check – database (lộ thông tin server/version DB → chỉ cho vai trò dashboard)
app.get('/health/db', authenticate, requirePasswordChanged, requireDashboardRole, async (req, res) => {
	try {
		const pool = await getPool();
		const result = await pool.request().query(`
      SELECT
        now()              AS server_time,
        version()          AS sql_version,
        current_database() AS database_name,
        current_user       AS login_user
    `);
		res.json({
			status: 'ok',
			server_time: result.recordset[0].server_time,
			database: result.recordset[0].database_name,
			login_user: result.recordset[0].login_user,
			sql_version: result.recordset[0].sql_version,
		});
	} catch (err) {
		console.error('[health/db]', err);
		res.status(503).json({
			status: 'error',
			code: err.code || null,
		});
	}
});

// Error handler
app.use(errorHandler);

// ── Lỗi ngoài luồng request: ghi log rồi để tiến trình xử lý như mặc định ──
process.on('unhandledRejection', (reason) => {
	console.error('[unhandledRejection]', reason);
	logError(reason);
});
let crashing = false;
process.on('uncaughtException', (err) => {
	console.error('[uncaughtException]', err);
	// Lỗi phát sinh ngay trong lúc ghi log lỗi → không ghi lại nữa, tránh vòng lặp
	if (crashing) return;
	crashing = true;
	logError(err);
	// Trạng thái tiến trình không còn tin cậy → thoát (Docker/pm2 tự khởi động lại)
	setTimeout(() => process.exit(1), 500);
});

// ── Tác vụ nền: dọn log quá hạn ──
const HOUR_MS = 3600 * 1000;
async function housekeeping() {
	try {
		const removed = await pruneOldLogs();
		if (removed) console.log(`🧹 Đã xoá ${removed} file log cũ hơn ${RETENTION_DAYS} ngày`);
	} catch (err) {
		console.error('[housekeeping] Dọn log lỗi:', err.message);
	}
	try {
		await pruneRateLimits();
	} catch (err) {
		console.error('[housekeeping] Dọn bộ đếm đăng nhập lỗi:', err.message);
	}
}
setTimeout(housekeeping, 10 * 1000).unref();
setInterval(housekeeping, 6 * HOUR_MS).unref();

let currentPort = Number(PORT);

function startServer() {
	const server = app.listen(currentPort, HOST);

	server.on('listening', () => {
		console.log(`🚀 Server running on http://${HOST}:${currentPort}`);
		console.log(`🔍 DB health: http://${HOST}:${currentPort}/health/db`);
	});

	server.on('error', (err) => {
		if (err.code === 'EADDRINUSE') {
			console.warn(`⚠️  Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
			currentPort += 1;
			server.listen(currentPort, HOST);
		} else {
			throw err;
		}
	});
}

// Xác nhận DB đã có đủ schema (tạo bằng server/db/postgres/*.sql) và dọn
// phiên/thiết bị quá hạn trước khi nhận request — thiếu schema thì đăng nhập
// sẽ lỗi, nên dừng hẳn và báo rõ.
checkSchemaAndCleanup()
	.then(startServer)
	.catch((err) => {
		console.error('❌ Không khởi động được vì lỗi database:', err.message);
		process.exit(1);
	});
