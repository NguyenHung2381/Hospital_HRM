const crypto = require('crypto');
const { getPool, sql } = require('../config/db');
const { setDeviceCookie, readDeviceCookie } = require('../utils/sessionCookie');
const { logSecurityEvent } = require('../utils/securityEvents');

// "Thiết bị quen" (OWASP — device cookie): trình duyệt đã từng đăng nhập
// thành công vào 1 tài khoản được ghi vào TrustedDevices. Khoá tạm tài khoản
// (accountLockout.js) chỉ chặn thiết bị LẠ — kẻ tấn công cố tình nhập sai để
// khoá tài khoản sẽ không chặn được chủ tài khoản đăng nhập trên máy quen.
// Thiết bị quen có bộ đếm sai riêng: sai quá ngưỡng thì mất "quen", các lần
// sai sau đó tính như thiết bị lạ (vào bộ đếm khoá tài khoản).
// Không dùng MAC/IP: trình duyệt không đọc được MAC, còn IP/MAC đều giả được.
const DEVICE_TRUST_DAYS = 180;
const MAX_DEVICE_FAILED_ATTEMPTS = 10;

// Trả về bản ghi thiết bị quen của user cho trình duyệt đang gửi request,
// hoặc null nếu là thiết bị lạ / đã quá hạn không dùng.
async function findTrustedDevice(pool, req, id_user) {
	const deviceId = readDeviceCookie(req);
	if (!deviceId) return null;
	const result = await pool
		.request()
		.input('device_id', sql.Char(32), deviceId)
		.input('id_user', sql.Int, id_user)
		.input('days', sql.Int, DEVICE_TRUST_DAYS).query(`
			SELECT device_id, id_user, failed_count FROM TrustedDevices
			WHERE device_id = @device_id AND id_user = @id_user
				AND last_used_at > DATEADD(DAY, -@days, SYSUTCDATETIME())
		`);
	return result.recordset[0] || null;
}

// Gọi khi đăng nhập thành công: đánh dấu trình duyệt này là thiết bị quen của
// user (reset bộ đếm sai) và gia hạn cookie.
async function trustDevice(req, res, id_user) {
	const deviceId = readDeviceCookie(req) || crypto.randomBytes(16).toString('hex');
	const pool = await getPool();
	await pool
		.request()
		.input('device_id', sql.Char(32), deviceId)
		.input('id_user', sql.Int, id_user).query(`
			MERGE TrustedDevices WITH (HOLDLOCK) AS t
			USING (SELECT @device_id AS device_id, @id_user AS id_user) AS s
				ON t.device_id = s.device_id AND t.id_user = s.id_user
			WHEN MATCHED THEN
				UPDATE SET failed_count = 0, last_used_at = SYSUTCDATETIME()
			WHEN NOT MATCHED THEN
				INSERT (device_id, id_user) VALUES (s.device_id, s.id_user);
		`);
	setDeviceCookie(req, res, deviceId, DEVICE_TRUST_DAYS * 24 * 60 * 60 * 1000);
}

// Sai mật khẩu / mã 2FA trên thiết bị quen: tăng bộ đếm của riêng thiết bị,
// đủ ngưỡng thì bỏ "quen" (không khoá tài khoản).
async function recordDeviceFailure(pool, req, device, reason) {
	const result = await pool
		.request()
		.input('device_id', sql.Char(32), device.device_id)
		.input('id_user', sql.Int, device.id_user).query(`
			UPDATE TrustedDevices SET failed_count = failed_count + 1
			OUTPUT INSERTED.failed_count
			WHERE device_id = @device_id AND id_user = @id_user
		`);
	const count = result.recordset[0]?.failed_count ?? 0;
	if (count < MAX_DEVICE_FAILED_ATTEMPTS) return;

	await pool
		.request()
		.input('device_id', sql.Char(32), device.device_id)
		.input('id_user', sql.Int, device.id_user)
		.query(`DELETE FROM TrustedDevices WHERE device_id = @device_id AND id_user = @id_user`);
	await logSecurityEvent(req, {
		eventType: 'device_untrusted',
		actorId: device.id_user,
		targetId: device.id_user,
		detail: `Bỏ tin cậy thiết bị sau ${MAX_DEVICE_FAILED_ATTEMPTS} lần ${reason} liên tiếp`,
	});
}

// Bỏ "quen" mọi thiết bị của user — dùng khi đổi/đặt lại mật khẩu (nghi lộ).
async function revokeTrustedDevices(pool, id_user) {
	await pool
		.request()
		.input('id_user', sql.Int, id_user)
		.query(`DELETE FROM TrustedDevices WHERE id_user = @id_user`);
}

module.exports = {
	DEVICE_TRUST_DAYS,
	MAX_DEVICE_FAILED_ATTEMPTS,
	findTrustedDevice,
	trustDevice,
	recordDeviceFailure,
	revokeTrustedDevices,
};
