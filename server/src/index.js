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
	if (process.env.DB_ENCRYPT !== 'true')
		console.warn('⚠️  DB_ENCRYPT khác "true" — kết nối tới SQL Server không được mã hoá.');
	if ((process.env.DB_USER || '').toLowerCase() === 'sa')
		console.warn('⚠️  DB_USER=sa — nên dùng 1 SQL login riêng, chỉ cấp quyền trên DB của HRM.');
}

process.on('unhandledRejection', (reason) => {
	console.error('❌ Unhandled Promise Rejection:', reason);
});

const express = require('express');
const helmet = require('helmet');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { getPool } = require('./config/db');
const { ensureSecuritySchema } = require('./config/securitySchema');
const { authenticate, requireDashboardRole } = require('./middleware/auth');
const { requestLogger, logError } = require('./utils/auditLog');
const { pruneOldLogs, RETENTION_DAYS } = require('./services/logReader');

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

// ── Tác vụ nền: dọn log quá hạn ──
const HOUR_MS = 3600 * 1000;
async function housekeeping() {
	try {
		const removed = await pruneOldLogs();
		if (removed) console.log(`🧹 Đã xoá ${removed} file log cũ hơn ${RETENTION_DAYS} ngày`);
	} catch (err) {
		console.error('[housekeeping] Dọn log lỗi:', err.message);
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

// Tạo bảng/cột bảo mật (khoá TK, 2FA, phiên, sự kiện bảo mật) trước khi nhận
// request — thiếu schema thì đăng nhập sẽ lỗi, nên dừng hẳn và báo rõ.
ensureSecuritySchema()
	.then(startServer)
	.catch((err) => {
		console.error('❌ Không cập nhật được schema bảo mật:', err.message);
		console.error(
			'   Nếu tài khoản DB của app không có quyền ALTER/CREATE TABLE, hãy chạy 1 lần bằng tài khoản có quyền:',
		);
		console.error('   node src/config/securitySchema.js');
		process.exit(1);
	});
