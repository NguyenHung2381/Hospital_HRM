# Database — chuyển SQL Server → PostgreSQL

| Thư mục | Nội dung |
|---|---|
| `mssql/schema-snapshot.txt` | Snapshot schema SQL Server hiện tại (bảng, cột, index, FK, CHECK, số dòng, định nghĩa view/proc) — mốc để đối chiếu |
| `postgres/000_roles_database.sql` | Tạo role `hrm_owner`, `hrm_app` + database `hrm_hospital` (chạy bằng `postgres`) |
| `postgres/001_init.sql` | Toàn bộ bảng, khoá, index |
| `postgres/002_views_functions.sql` | `vw_tt03_recommended`, `usp_recalc_all()`, `usp_recalc_tt03()` |
| `postgres/900_reset_sequences.sql` | Chạy sau khi nạp dữ liệu cũ — đẩy sequence IDENTITY lên MAX(id) |

## Cài PostgreSQL trực tiếp trên máy chủ (Windows, không Docker)

1. Cài **PostgreSQL 17** bằng bộ cài EDB (postgresql.org/download/windows). Ghi
   lại mật khẩu superuser `postgres`. Bộ cài có sẵn ICU và `citext`.
2. Thêm `C:\Program Files\PostgreSQL\17\bin` vào `PATH` (để có `psql`, `pg_dump`).
3. Tạo role + DB (mật khẩu truyền qua biến, không ghi vào file):

   ```bat
   cd server\db\postgres
   psql -U postgres -v ON_ERROR_STOP=1 -v owner_password="<mk-owner>" -v app_password="<mk-app>" -f 000_roles_database.sql
   ```

4. Tạo schema:

   ```bat
   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 001_init.sql
   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 002_views_functions.sql
   ```

### Backend chạy trong Docker, PostgreSQL trên host

Container backend (`docker-compose.prod.yml`) gọi DB qua `host.docker.internal`,
nên PostgreSQL phải nhận kết nối từ mạng Docker:

- `postgresql.conf`: `listen_addresses = 'localhost,<IP host trong mạng Docker/LAN>'`
  (hoặc `'*'` và chặn cổng 5432 bằng Windows Firewall, chỉ mở cho dải Docker).
- `pg_hba.conf` — chỉ cho đúng DB/role/dải mạng, bắt buộc `scram-sha-256`:

  ```
  host  hrm_hospital  hrm_app  172.16.0.0/12  scram-sha-256
  ```

- Restart service `postgresql-x64-17` sau khi sửa.

## Khác biệt so với SQL Server cần nhớ khi chuyển code (giai đoạn 2–3)

- Tên bảng/cột không đặt trong `""` bị hạ chữ thường → câu SQL cũ
  (`FROM Departments`, `rdr.Id`) vẫn chạy, nhưng **key kết quả là chữ thường**:
  `recordset[0].Id` → `rows[0].id`.
- `[Report_Department_Records ]` (có dấu cách cuối) → `report_department_records`.
- `username`, `code_department` dùng `citext` → so sánh không phân biệt hoa thường như cũ.
- Thời gian lưu `timestamptz` (UTC); `SYSUTCDATETIME()`/`SYSDATETIMEOFFSET()` → `now()`.
- `CAST(numeric AS SMALLINT)` của SQL Server cắt phần thập phân; PostgreSQL làm
  tròn → dùng `trunc(x)::smallint` khi cần giữ hành vi cũ.
- Đã thêm CHECK thật cho `users.status`, `departments.status`,
  `roles.department_access_type` (bản cũ đặt nhầm thành tên DEFAULT nên chưa có hiệu lực).
- Bảng `auth_sessions` và `role_department_access` có trong DB nhưng code HRM
  không dùng; vẫn giữ để không mất dữ liệu.
