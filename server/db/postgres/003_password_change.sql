-- ============================================================================
-- Bắt buộc đổi mật khẩu lần đầu (tài khoản mới tạo / vừa được quản trị đặt lại
-- mật khẩu tạm). Cho database tạo bằng 001_init.sql bản cũ — 001_init.sql bản
-- mới đã có sẵn 2 cột này. File idempotent, chạy lại không sao.
-- Chạy bằng hrm_owner:
--   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 003_password_change.sql
-- ============================================================================

SET client_encoding = 'UTF8';
BEGIN;

-- Lần đầu thêm cột: các tài khoản ĐANG CÓ không rõ mật khẩu do ai đặt (bản cũ
-- cho quản trị đặt / reset và trả mật khẩu tạm cho người reset, không bắt đổi)
-- → DEFAULT true để bắt đổi ở lần đăng nhập tới; sau đó đổi DEFAULT về false
-- cho tài khoản tạo mới. Cột đã có (chạy lại, hoặc 001_init.sql bản mới) thì
-- IF NOT EXISTS bỏ qua, không đụng dữ liệu.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
ALTER TABLE users ALTER COLUMN must_change_password SET DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NULL;

COMMIT;
