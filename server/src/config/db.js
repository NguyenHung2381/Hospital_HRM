const sql = require('mssql');
require('dotenv').config();

const [server, instanceName] = (process.env.DB_HOST || '').split('\\');

const config = {
	server,
	database: process.env.DB_NAME,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	options: {
		...(instanceName && { instanceName }),
		encrypt: false, // 🔥 local thì nên false
		trustServerCertificate: true,
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
			`✅ Connected to ${server}${instanceName ? '\\' + instanceName : ''} → ${process.env.DB_NAME}`,
		);
	}
	return pool;
}

module.exports = { getPool, sql };
