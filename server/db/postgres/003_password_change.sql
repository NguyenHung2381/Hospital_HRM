-- ============================================================================
-- Bắt buộc đổi mật khẩu lần đầu (tài khoản mới tạo / vừa được quản trị đặt lại
-- mật khẩu tạm). Cho database tạo bằng 001_init.sql bản cũ — 001_init.sql bản
-- mới đã có sẵn 2 cột này. File idempotent, chạy lại không sao.
-- Chạy bằng hrm_owner:
--   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 003_password_change.sql
-- ============================================================================

SET client_encoding = 'UTF8';
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NULL;

COMMIT;
