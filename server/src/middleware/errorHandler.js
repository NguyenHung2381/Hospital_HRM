/**
 * Middleware xử lý lỗi tập trung
 * Đặt cuối cùng trong app.use() ở index.js
 */
const { logError } = require('../utils/auditLog');

// Lỗi trả về từ PostgreSQL (pg.DatabaseError): code = SQLSTATE 5 ký tự
function isPgError(err) {
	return typeof err?.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code) && !!err.severity;
}

function errorHandler(err, req, res, next) {
	// Log chi tiết ra console (server side) + gắn message/stack vào dòng nhật
	// ký của request (tra trên trang Nhật ký hệ thống theo mã request)
	console.error(`[${new Date().toISOString()}] ${req.id ?? ''} ${req.method} ${req.url}`);
	console.error(err);
	logError(err, req);

	// Trả kèm mã request — người dùng báo lỗi kèm mã này là tra được log
	if (req.id) {
		const json = res.json.bind(res);
		res.json = (body) => json({ ...body, request_id: req.id });
	}

	// ── PostgreSQL errors (err.code = SQLSTATE 5 ký tự, có err.severity) ──
	if (isPgError(err)) {
		switch (err.code) {
			// Duplicate key (UNIQUE constraint)
			case '23505':
				return res.status(409).json({
					success: false,
					code: 'DUPLICATE_KEY',
					message: 'Dữ liệu đã tồn tại, không thể thêm trùng',
				});

			// Foreign key violation
			case '23503':
				return res.status(409).json({
					success: false,
					code: 'FOREIGN_KEY_VIOLATION',
					message:
						'Không thể thực hiện vì dữ liệu đang được tham chiếu ở bảng khác',
				});

			// CHECK constraint (SQL Server gộp chung với FK ở lỗi 547)
			case '23514':
				return res.status(400).json({
					success: false,
					code: 'CHECK_VIOLATION',
					message: 'Giá trị nhập vào không hợp lệ',
				});

			// String too long
			case '22001':
				return res.status(400).json({
					success: false,
					code: 'VALUE_TOO_LONG',
					message: 'Giá trị nhập vào vượt quá độ dài cho phép',
				});

			// Sai kiểu (vd chữ vào ô số) / số vượt giới hạn cột
			case '22P02':
			case '22003':
			case '22007':
			case '22008':
				return res.status(400).json({
					success: false,
					code: 'INVALID_VALUE',
					message: 'Giá trị nhập vào không đúng định dạng hoặc vượt giới hạn cho phép',
				});

			// NULL constraint
			case '23502':
				return res.status(400).json({
					success: false,
					code: 'NULL_VIOLATION',
					message: 'Thiếu giá trị bắt buộc',
				});

			// Login / connection failed
			case '28P01':
			case '28000':
				return res.status(503).json({
					success: false,
					code: 'DB_AUTH_FAILED',
					message: 'Không thể kết nối database',
				});

			// statement_timeout (DB_STATEMENT_TIMEOUT_MS)
			case '57014':
				return res.status(503).json({
					success: false,
					code: 'DB_TIMEOUT',
					message: 'Truy vấn dữ liệu quá lâu, vui lòng thử lại sau',
				});

			default:
				// 08xxx: mất kết nối; 57P0x: PostgreSQL đang tắt/khởi động lại
				if (/^(08|57P0)/.test(err.code))
					return res.status(503).json({
						success: false,
						code: 'DB_UNAVAILABLE',
						message: 'Không thể kết nối tới database, thử lại sau',
					});
				return res.status(500).json({
					success: false,
					code: 'DB_ERROR',
					message:
						process.env.NODE_ENV !== 'development'
							? 'Đã xảy ra lỗi khi truy vấn dữ liệu, vui lòng thử lại sau'
							: 'Lỗi database: ' + err.message,
				});
		}
	}

	// ── Validation errors (tự throw từ controller) ───────────────
	if (err.status === 400) {
		return res.status(400).json({
			success: false,
			code: 'VALIDATION_ERROR',
			message: err.message,
		});
	}

	// ── Not found ────────────────────────────────────────────────
	if (err.status === 404) {
		return res.status(404).json({
			success: false,
			code: 'NOT_FOUND',
			message: err.message || 'Không tìm thấy tài nguyên',
		});
	}

	// ── JSON parse error (body không hợp lệ) ────────────────────
	if (err.type === 'entity.parse.failed') {
		return res.status(400).json({
			success: false,
			code: 'INVALID_JSON',
			message: 'Body request không phải JSON hợp lệ',
		});
	}

	// ── Không kết nối được PostgreSQL (mạng / pool hết thời gian chờ) ──
	if (
		['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EHOSTUNREACH'].includes(err.code) ||
		/timeout exceeded when trying to connect|Connection terminated/i.test(err.message || '')
	) {
		return res.status(503).json({
			success: false,
			code: 'DB_UNAVAILABLE',
			message: 'Không thể kết nối tới database, thử lại sau',
		});
	}

	// ── Mặc định: 500 Internal Server Error ─────────────────────
	res.status(500).json({
		success: false,
		code: 'INTERNAL_ERROR',
		message:
			process.env.NODE_ENV !== 'development'
				? 'Đã xảy ra lỗi, vui lòng thử lại sau'
				: err.message,
	});
}

module.exports = errorHandler;
