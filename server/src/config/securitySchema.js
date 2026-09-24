const { getPool } = require('./db');

// Bổ sung schema cho các tính năng bảo mật (nâng cấp theo RMS):
//  - Users: khoá tài khoản theo số lần sai mật khẩu (lưu DB, không mất khi
//    restart và không lách được bằng cách đổi IP) + xác thực 2 lớp TOTP.
//  - UserSessions: mỗi lần đăng nhập = 1 phiên (theo jti của JWT) → liệt kê
//    phiên, đăng xuất từng thiết bị / mọi thiết bị, thu hồi không mất khi restart.
//  - SecurityEvents: nhật ký sự kiện bảo mật (khoá TK, sai OTP, bật/tắt 2FA...).
//  - TrustedDevices: trình duyệt đã đăng nhập thành công ("thiết bị quen") —
//    không bị khoá tạm tài khoản chặn (xem services/trustedDevice.js).
// Mọi câu lệnh đều idempotent (kiểm tra tồn tại trước) nên chạy lại nhiều lần
// không sao. Mỗi câu chạy riêng vì SQL Server không cho dùng cột vừa ALTER ADD
// trong cùng batch.
const STATEMENTS = [
	`IF COL_LENGTH('dbo.Users', 'failed_login_count') IS NULL
		ALTER TABLE dbo.Users ADD failed_login_count INT NOT NULL
			CONSTRAINT DF_Users_failed_login_count DEFAULT 0`,
	`IF COL_LENGTH('dbo.Users', 'locked_until') IS NULL
		ALTER TABLE dbo.Users ADD locked_until DATETIME2 NULL`,
	`IF COL_LENGTH('dbo.Users', 'lockout_level') IS NULL
		ALTER TABLE dbo.Users ADD lockout_level INT NOT NULL
			CONSTRAINT DF_Users_lockout_level DEFAULT 0`,
	`IF COL_LENGTH('dbo.Users', 'totp_secret') IS NULL
		ALTER TABLE dbo.Users ADD totp_secret NVARCHAR(255) NULL`,
	`IF COL_LENGTH('dbo.Users', 'totp_enabled') IS NULL
		ALTER TABLE dbo.Users ADD totp_enabled BIT NOT NULL
			CONSTRAINT DF_Users_totp_enabled DEFAULT 0`,
	`IF COL_LENGTH('dbo.Users', 'totp_verified_at') IS NULL
		ALTER TABLE dbo.Users ADD totp_verified_at DATETIME2 NULL`,
	`IF COL_LENGTH('dbo.Users', 'totp_last_step') IS NULL
		ALTER TABLE dbo.Users ADD totp_last_step BIGINT NULL`,
	`IF OBJECT_ID('dbo.UserSessions', 'U') IS NULL
		CREATE TABLE dbo.UserSessions (
			jti          CHAR(32)      NOT NULL CONSTRAINT PK_UserSessions PRIMARY KEY,
			id_user      INT           NOT NULL,
			ip_address   VARCHAR(64)   NULL,
			user_agent   NVARCHAR(255) NULL,
			created_at   DATETIME2     NOT NULL CONSTRAINT DF_UserSessions_created_at DEFAULT SYSUTCDATETIME(),
			last_seen_at DATETIME2     NULL,
			expires_at   DATETIME2     NOT NULL,
			revoked_at   DATETIME2     NULL
		)`,
	`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserSessions_user' AND object_id = OBJECT_ID('dbo.UserSessions'))
		CREATE INDEX IX_UserSessions_user ON dbo.UserSessions (id_user, expires_at)`,
	`IF OBJECT_ID('dbo.SecurityEvents', 'U') IS NULL
		CREATE TABLE dbo.SecurityEvents (
			id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SecurityEvents PRIMARY KEY,
			event_type  VARCHAR(50)    NOT NULL,
			actor_id    INT            NULL,
			target_type VARCHAR(50)    NULL,
			target_id   VARCHAR(50)    NULL,
			ip_address  VARCHAR(64)    NULL,
			user_agent  NVARCHAR(255)  NULL,
			detail      NVARCHAR(1000) NULL,
			created_at  DATETIME2      NOT NULL CONSTRAINT DF_SecurityEvents_created_at DEFAULT SYSUTCDATETIME()
		)`,
	`IF OBJECT_ID('dbo.TrustedDevices', 'U') IS NULL
		CREATE TABLE dbo.TrustedDevices (
			device_id    CHAR(32)  NOT NULL,
			id_user      INT       NOT NULL,
			failed_count INT       NOT NULL CONSTRAINT DF_TrustedDevices_failed_count DEFAULT 0,
			created_at   DATETIME2 NOT NULL CONSTRAINT DF_TrustedDevices_created_at DEFAULT SYSUTCDATETIME(),
			last_used_at DATETIME2 NOT NULL CONSTRAINT DF_TrustedDevices_last_used_at DEFAULT SYSUTCDATETIME(),
			CONSTRAINT PK_TrustedDevices PRIMARY KEY (device_id, id_user)
		)`,
	`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrustedDevices_user' AND object_id = OBJECT_ID('dbo.TrustedDevices'))
		CREATE INDEX IX_TrustedDevices_user ON dbo.TrustedDevices (id_user)`,
	// Dọn phiên đã hết hạn quá 30 ngày để bảng không phình
	`DELETE FROM dbo.UserSessions WHERE expires_at < DATEADD(DAY, -30, SYSUTCDATETIME())`,
	// Dọn thiết bị quen không dùng quá 180 ngày (khớp DEVICE_TRUST_DAYS)
	`DELETE FROM dbo.TrustedDevices WHERE last_used_at < DATEADD(DAY, -180, SYSUTCDATETIME())`,
];

async function ensureSecuritySchema() {
	const pool = await getPool();
	for (const stmt of STATEMENTS) {
		await pool.request().batch(stmt);
	}
}

module.exports = { ensureSecuritySchema };

// Chạy trực tiếp: node src/config/securitySchema.js (dùng khi tài khoản DB của
// app không có quyền ALTER — chạy 1 lần bằng tài khoản có quyền).
if (require.main === module) {
	require('dotenv').config();
	ensureSecuritySchema()
		.then(() => {
			console.log('✅ Đã cập nhật schema bảo mật');
			process.exit(0);
		})
		.catch((err) => {
			console.error('❌ Cập nhật schema bảo mật thất bại:', err.message);
			process.exit(1);
		});
}
