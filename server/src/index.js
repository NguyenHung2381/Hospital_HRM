require('dotenv').config();
const express = require('express');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { getPool } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
app.use(
	cors({
		origin: '*',
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
	}),
);

app.use(express.json());

// Routes
app.use('/api', routes);

// Health check – server
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Health check – database
app.get('/health/db', async (req, res) => {
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

const server = app.listen(currentPort);

server.on('listening', () => {
	console.log(`🚀 Server running on http://localhost:${currentPort}`);
	console.log(`🔍 DB health: http://localhost:${currentPort}/health/db`);
});

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.warn(`⚠️  Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
		currentPort += 1;
		server.listen(currentPort);
	} else {
		throw err;
	}
});
