-- ============================================================================
-- Tạo role + database cho Hospital HRM. Chạy 1 lần bằng superuser "postgres"
-- trên máy cài PostgreSQL (không phải Docker). Mật khẩu truyền qua biến psql,
-- KHÔNG ghi vào file:
--
--   psql -U postgres -v ON_ERROR_STOP=1 ^
--        -v owner_password="..." -v app_password="..." ^
--        -f 000_roles_database.sql
--
--  • hrm_owner: sở hữu database + mọi bảng; dùng để chạy migration (001, 002...).
--  • hrm_app:   role ứng dụng (DB_USER trong server/.env) — chỉ đọc/ghi dữ
--               liệu, KHÔNG tạo/sửa/xoá bảng được.
-- ============================================================================

\set ON_ERROR_STOP on

SELECT format('CREATE ROLE hrm_owner LOGIN PASSWORD %L', :'owner_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hrm_owner') \gexec

SELECT format('CREATE ROLE hrm_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hrm_app') \gexec

-- UTF8 + ICU tiếng Việt: ORDER BY tên khoa/nhân viên sắp đúng thứ tự a ă â ...
-- (ICU đi kèm bộ cài PostgreSQL cho Windows của EDB, cần PostgreSQL >= 15).
SELECT 'CREATE DATABASE hrm_hospital OWNER hrm_owner ENCODING ''UTF8''
	LOCALE_PROVIDER icu ICU_LOCALE ''vi-VN'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'hrm_hospital') \gexec

\connect hrm_hospital

-- Không cho PUBLIC tạo object trong schema public; chỉ hrm_owner được.
REVOKE ALL ON DATABASE hrm_hospital FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE hrm_hospital TO hrm_app;
ALTER SCHEMA public OWNER TO hrm_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO hrm_app;

-- Mọi bảng/sequence/hàm hrm_owner tạo SAU NÀY tự cấp quyền cho hrm_app.
ALTER DEFAULT PRIVILEGES FOR ROLE hrm_owner IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hrm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE hrm_owner IN SCHEMA public
	GRANT USAGE, SELECT ON SEQUENCES TO hrm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE hrm_owner IN SCHEMA public
	GRANT EXECUTE ON FUNCTIONS TO hrm_app;

-- Giờ trả về theo UTC (giống SYSUTCDATETIME cũ); hiển thị giờ VN do app/client lo.
ALTER DATABASE hrm_hospital SET timezone TO 'UTC';
