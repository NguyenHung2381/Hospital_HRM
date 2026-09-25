const { getPool } = require('./db');

// Tự tạo các bảng phục vụ xác thực nếu DB chưa có (idempotent — chạy lại
// nhiều lần an toàn). Làm bằng code thay vì file .sql vì *.sql nằm trong
// .gitignore của dự án, và để triển khai Docker không cần bước chạy tay.
//
// Auth_Sessions: mỗi dòng = 1 phiên đăng nhập (1 thiết bị / 1 client API).
//  - refresh_hash: SHA-256 của refresh token hiện tại (không lưu token gốc —
//    lộ DB/backup cũng không dùng được).
//  - prev_refresh_hash: token ngay trước lần xoay gần nhất — nhận diện việc
//    dùng lại token cũ (dấu hiệu token bị đánh cắp) → thu hồi cả phiên.
//  - pwf: dấu vân tay mật khẩu lúc tạo phiên — đổi mật khẩu thì phiên cũ
//    không làm mới được nữa.
const STATEMENTS = [
	`IF OBJECT_ID(N'dbo.Auth_Sessions', N'U') IS NULL
	CREATE TABLE dbo.Auth_Sessions (
		id_session        CHAR(32)      NOT NULL CONSTRAINT PK_Auth_Sessions PRIMARY KEY,
		id_user           INT           NOT NULL
			CONSTRAINT FK_Auth_Sessions_Users REFERENCES dbo.Users(id_user) ON DELETE CASCADE,
		client_type       VARCHAR(10)   NOT NULL,
		remember          BIT           NOT NULL CONSTRAINT DF_Auth_Sessions_remember DEFAULT 0,
		refresh_hash      CHAR(64)      NOT NULL,
		prev_refresh_hash CHAR(64)      NULL,
		rotated_at        DATETIME2(0)  NULL,
		pwf               VARCHAR(32)   NOT NULL,
		ip_address        VARCHAR(64)   NULL,
		user_agent        NVARCHAR(300) NULL,
		created_at        DATETIME2(0)  NOT NULL CONSTRAINT DF_Auth_Sessions_created DEFAULT SYSUTCDATETIME(),
		last_used_at      DATETIME2(0)  NOT NULL CONSTRAINT DF_Auth_Sessions_used DEFAULT SYSUTCDATETIME(),
		expires_at        DATETIME2(0)  NOT NULL,
		max_expires_at    DATETIME2(0)  NOT NULL,
		revoked_at        DATETIME2(0)  NULL,
		revoked_reason    NVARCHAR(50)  NULL
	)`,
	`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Auth_Sessions_refresh' AND object_id = OBJECT_ID(N'dbo.Auth_Sessions'))
	CREATE UNIQUE INDEX UX_Auth_Sessions_refresh ON dbo.Auth_Sessions(refresh_hash)`,
	`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Auth_Sessions_prev' AND object_id = OBJECT_ID(N'dbo.Auth_Sessions'))
	CREATE INDEX IX_Auth_Sessions_prev ON dbo.Auth_Sessions(prev_refresh_hash)`,
	`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Auth_Sessions_user' AND object_id = OBJECT_ID(N'dbo.Auth_Sessions'))
	CREATE INDEX IX_Auth_Sessions_user ON dbo.Auth_Sessions(id_user, revoked_at, expires_at)`,
];

let ready = null;

// Gọi trước mọi truy vấn vào bảng xác thực. Thành công thì nhớ lại; lỗi (vd
// DB chưa sẵn sàng lúc khởi động) thì lần gọi sau thử lại.
function ensureSchema() {
	if (!ready) {
		ready = (async () => {
			const pool = await getPool();
			for (const stmt of STATEMENTS) await pool.request().batch(stmt);
		})().catch((err) => {
			ready = null;
			throw err;
		});
	}
	return ready;
}

module.exports = { ensureSchema };
