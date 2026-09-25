const path = require('path');
const pino = require('pino');

// Logger nhật ký hoạt động (audit/activity log) — cùng bộ thư viện với dự án
// RMS: pino ghi mỗi sự kiện thành 1 dòng JSON, pino-roll xoay file theo ngày
// (và theo dung lượng) trong 1 worker thread riêng nên không chặn request.
//   logs/audit.2026-09-24.1.log, logs/audit.2026-09-24.2.log (khi vượt LOG_FILE_SIZE)
// Đây là nguồn dữ liệu của trang Nhật ký hệ thống (services/logReader.js đọc lại).
//
//   AUDIT_LOG_DIR  thư mục log (mặc định server/logs)
//   LOG_FILE_SIZE  dung lượng tối đa 1 file trước khi tách (mặc định 50m)
//   LOG_STDOUT=1   ghi ra stdout thay vì file (vd khi đã có Loki/Promtail đọc log container)
// Việc xoá log cũ theo LOG_RETENTION_DAYS nằm ở logReader.pruneOldLogs().
// KHÔNG bao giờ ghi mật khẩu / token / body request vào đây.

const LOG_DIR = process.env.AUDIT_LOG_DIR
	? path.resolve(process.env.AUDIT_LOG_DIR)
	: path.join(__dirname, '..', '..', 'logs');

const base = {
	app: 'hospital-hrm',
	stream: 'audit',
};

// time: ISO cho người đọc. ts: epoch ms kèm phần thập phân (tăng đơn điệu
// trong 1 tiến trình) — khoá sắp xếp ổn định khi nhiều dòng cùng 1 ms.
const timestamp = () => {
	const ms = performance.timeOrigin + performance.now();
	return `,"time":"${new Date(ms).toISOString()}","ts":${ms}`;
};

const transport =
	process.env.LOG_STDOUT === '1'
		? pino.transport({ target: 'pino/file', options: { destination: 1 } })
		: pino.transport({
				target: 'pino-roll',
				options: {
					file: path.join(LOG_DIR, 'audit'),
					extension: '.log',
					frequency: 'daily',
					dateFormat: 'yyyy-MM-dd',
					size: process.env.LOG_FILE_SIZE || '50m',
					mkdir: true,
				},
			});

const logger = pino({ base, timestamp, messageKey: 'msg' }, transport);

module.exports = { logger, LOG_DIR };
