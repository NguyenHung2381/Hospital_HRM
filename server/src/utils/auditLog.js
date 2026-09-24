const fs = require('fs');
const path = require('path');

// Nhật ký thao tác (audit log): ghi lại AI làm GÌ, LÚC NÀO, TỪ ĐÂU với các
// hành động nhạy cảm (đăng nhập, quản lý tài khoản/vai trò/phân quyền, xoá dữ
// liệu...) để truy vết khi có sự cố. Mỗi dòng là 1 JSON, mỗi ngày 1 file:
//   server/logs/audit-YYYY-MM-DD.log   (thư mục logs/ đã nằm trong .gitignore)
// Đổi thư mục bằng biến môi trường AUDIT_LOG_DIR. KHÔNG bao giờ ghi mật khẩu
// hay token vào đây.
const LOG_DIR = process.env.AUDIT_LOG_DIR || path.join(__dirname, '..', '..', 'logs');

let dirReady = false;

function localDate(d) {
	const pad = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * @param {import('express').Request | null} req  request hiện tại (lấy user + IP)
 * @param {string} action   vd 'auth.login', 'user.delete', 'report.delete'
 * @param {object} [details] thông tin thêm (id đối tượng, kết quả...)
 */
function audit(req, action, details = {}) {
	const now = new Date();
	const entry = {
		time: now.toISOString(),
		action,
		user_id: req?.user?.id_user ?? null,
		username: req?.user?.username ?? null,
		ip: req?.ip ?? null,
		...details,
	};
	const line = JSON.stringify(entry) + '\n';
	const file = path.join(LOG_DIR, `audit-${localDate(now)}.log`);

	try {
		if (!dirReady) {
			fs.mkdirSync(LOG_DIR, { recursive: true });
			dirReady = true;
		}
	} catch (err) {
		console.error('[audit] Không tạo được thư mục log:', err.message);
		return;
	}
	fs.appendFile(file, line, (err) => {
		if (err) console.error('[audit] Không ghi được audit log:', err.message);
	});
}

// Middleware: tự ghi audit (nếu controller chưa ghi riêng) cho
//  - request ghi dữ liệu (POST/PUT/DELETE) thành công (2xx);
//  - mọi request bị từ chối quyền (403) — dấu hiệu dò quyền;
//  - xuất Excel (tải dữ liệu hàng loạt).
// Chỉ ghi method + đường dẫn + tham số, KHÔNG ghi body (có thể chứa mật khẩu
// / dữ liệu bệnh nhân).
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function auditWrites(req, res, next) {
	res.on('finish', () => {
		if (req.auditLogged) return;
		const ok = res.statusCode >= 200 && res.statusCode < 300;
		const isWrite = !READ_METHODS.has(req.method);
		const isExport = req.method === 'GET' && /export/.test(req.path);
		if ((ok && (isWrite || isExport)) || res.statusCode === 403) {
			audit(req, `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`, {
				params: req.params,
				...(isExport ? { query: req.query } : {}),
				status: res.statusCode,
			});
		}
	});
	next();
}

module.exports = { audit, auditWrites };
