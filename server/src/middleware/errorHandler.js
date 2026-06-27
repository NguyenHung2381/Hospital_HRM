/**
 * Middleware xử lý lỗi tập trung
 * Đặt cuối cùng trong app.use() ở index.js
 */
function errorHandler(err, req, res, next) {
	// Log chi tiết ra console (server side)
	console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
	console.error(err);

	// ── SQL Server errors (err.number) ──────────────────────────
	if (err.number) {
		switch (err.number) {
			// Duplicate key (UNIQUE constraint)
			case 2627:
			case 2601:
				return res.status(409).json({
					success: false,
					code: 'DUPLICATE_KEY',
					message: 'Dữ liệu đã tồn tại, không thể thêm trùng',
				});

			// Foreign key violation
			case 547:
				return res.status(409).json({
					success: false,
					code: 'FOREIGN_KEY_VIOLATION',
					message:
						'Không thể thực hiện vì dữ liệu đang được tham chiếu ở bảng khác',
				});

			// String too long
			case 8152:
				return res.status(400).json({
					success: false,
					code: 'VALUE_TOO_LONG',
					message: 'Giá trị nhập vào vượt quá độ dài cho phép',
				});

			// NULL constraint
			case 515:
				return res.status(400).json({
					success: false,
					code: 'NULL_VIOLATION',
					message: 'Thiếu giá trị bắt buộc',
				});

			// Login / connection failed
			case 18456:
				return res.status(503).json({
					success: false,
					code: 'DB_AUTH_FAILED',
					message: 'Không thể kết nối database',
				});

			default:
				return res.status(500).json({
					success: false,
					code: 'DB_ERROR',
					message: 'Lỗi database: ' + err.message,
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

	// ── Mssql connection timeout / refused ──────────────────────
	if (err.code === 'ETIMEOUT' || err.code === 'ECONNREFUSED') {
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
			process.env.NODE_ENV === 'production'
				? 'Đã xảy ra lỗi, vui lòng thử lại sau'
				: err.message,
	});
}

module.exports = errorHandler;
