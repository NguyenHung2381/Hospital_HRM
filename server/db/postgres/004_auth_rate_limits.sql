-- ============================================================================
-- Bộ đếm giới hạn đăng nhập sai (middleware/loginRateLimit.js) — lưu ở DB thay
-- cho bộ nhớ tiến trình: không mất khi restart server, dùng chung khi chạy
-- nhiều tiến trình. File idempotent, chạy lại không sao (`npm run setup` tự chạy).
-- Chạy bằng hrm_owner:
--   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 004_auth_rate_limits.sql
-- Chưa chạy file này thì server vẫn chạy, nhưng đếm trong bộ nhớ và cảnh báo.
-- ============================================================================

SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
	key          varchar(200) NOT NULL,
	count        integer      NOT NULL DEFAULT 1,
	window_start timestamptz  NOT NULL DEFAULT now(),
	CONSTRAINT pk_auth_rate_limits PRIMARY KEY (key)
);
CREATE INDEX IF NOT EXISTS ix_auth_rate_limits_window ON auth_rate_limits (window_start);

-- Bảng tạo bởi hrm_owner → ALTER DEFAULT PRIVILEGES (000_roles_database.sql)
-- đã cấp quyền cho hrm_app; cấp lại tường minh cho DB cấu hình kiểu khác.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hrm_app') THEN
		GRANT SELECT, INSERT, UPDATE, DELETE ON auth_rate_limits TO hrm_app;
	END IF;
END
$$;

COMMIT;
