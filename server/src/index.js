require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { getPool } = require('./config/db');
const { authenticate, requireDashboardRole } = require('./middleware/auth');

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
	}),
);

app.use(express.json());

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
			host: process.env.DB_HOST,
		});
	} catch (err) {
		res.status(503).json({
			status: 'error',
			message: err.message,
			code: err.code || err.number || null,
		});
	}
});

// Error handler
app.use(errorHandler);

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
