require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { getPool } = require('./config/db');
const { authenticate, requireDashboardRole } = require('./middleware/auth');
const { requestLogger, logError } = require('./utils/auditLog');
const { ensureSchema } = require('./config/schema');
const { pruneOldLogs, RETENTION_DAYS } = require('./services/logReader');
const { cleanupSessions } = require('./services/sessions');

const app = express();
const PORT = process.env.PORT || 3000;
// Apache/IIS đứng trước Node reverse-proxy cho /api trên CÙNG máy (xem
// client/public/.htaccess) → Node không cần và không nên nghe trên mọi
// interface. Chỉ đổi HOST nếu Node thực sự cần nhận traffic trực tiếp từ
// máy khác (không khuyến khích khi server đã thông ra Internet).
const HOST = process.env.HOST || '127.0.0.1';

app.set('trust proxy', 1); // đứng sau Apache → lấy đúng IP client thật (req.ip, dùng bởi loginRateLimit)
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

// Health check – server
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Health check – database (lộ thông tin server/version DB → chỉ cho vai trò dashboard)
app.get('/health/db', authenticate, requireDashboardRole, async (req, res) => {
	try {
		const pool = await getPool();
		const result = await pool.request().query(`
      SELECT
        GETDATE()        AS server_time,
        @@VERSION        AS sql_version,
        DB_NAME()        AS database_name,
        SYSTEM_USER      AS login_user
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
			code: err.code || err.number || null,
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
process.on('uncaughtException', (err) => {
	console.error('[uncaughtException]', err);
	logError(err);
	// Trạng thái tiến trình không còn tin cậy → thoát (Docker/pm2 tự khởi động lại)
	setTimeout(() => process.exit(1), 500);
});

// ── Tác vụ nền: tạo bảng phiên, dọn log quá hạn và phiên đã hết hạn ──
const HOUR_MS = 3600 * 1000;
async function housekeeping() {
	try {
		const removed = await pruneOldLogs();
		if (removed) console.log(`🧹 Đã xoá ${removed} file log cũ hơn ${RETENTION_DAYS} ngày`);
	} catch (err) {
		console.error('[housekeeping] Dọn log lỗi:', err.message);
	}
	try {
		const n = await cleanupSessions();
		if (n) console.log(`🧹 Đã xoá ${n} phiên đăng nhập hết hạn`);
	} catch (err) {
		console.error('[housekeeping] Dọn phiên lỗi:', err.message);
	}
}
ensureSchema().catch((err) =>
	console.error('⚠️  Chưa tạo được bảng Auth_Sessions (sẽ thử lại khi có đăng nhập):', err.message),
);
setTimeout(housekeeping, 10 * 1000).unref();
setInterval(housekeeping, 6 * HOUR_MS).unref();

let currentPort = Number(PORT);

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
