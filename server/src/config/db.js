const sql = require('mssql');
require('dotenv').config();

const [server, instanceName] = (process.env.DB_HOST || '').split('\\');
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

const config = {
	server,
	// instanceName chỉ dùng khi không chỉ định port tường minh
	...(port ? { port } : {}),
	database: process.env.DB_NAME,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	options: {
		...(!port && instanceName && { instanceName }),
		// Mã hoá kết nối tới SQL Server. Mặc định tắt để không phá cấu hình
		// hiện tại (DB cùng máy). Nếu DB nằm ở máy khác trong mạng → đặt
		// DB_ENCRYPT=true, và DB_TRUST_CERT=false khi SQL Server có chứng chỉ hợp lệ.
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
		enableArithAbort: true,
	},
	pool: {
		max: 10,
		min: 0,
		idleTimeoutMillis: 30000,
	},
};

let pool = null;

async function getPool() {
	if (!pool) {
		pool = await sql.connect(config);
		console.log(
			`✅ Connected to ${server}${port ? ':' + port : instanceName ? '\\' + instanceName : ''} → ${process.env.DB_NAME}`,
		);
	}
	return pool;
}

module.exports = { getPool, sql };
