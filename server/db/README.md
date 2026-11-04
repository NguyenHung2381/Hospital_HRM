# Database — chuyển SQL Server → PostgreSQL

| Thư mục | Nội dung |
|---|---|
| `mssql/schema-snapshot.txt` | Snapshot schema SQL Server hiện tại (bảng, cột, index, FK, CHECK, số dòng, định nghĩa view/proc) — mốc để đối chiếu |
| `postgres/000_roles_database.sql` | Tạo role `hrm_owner`, `hrm_app` + database `hrm_hospital` (chạy bằng `postgres`) |
| `postgres/001_init.sql` | Toàn bộ bảng, khoá, index |
| `postgres/002_views_functions.sql` | `vw_tt03_recommended`, `usp_recalc_all()`, `usp_recalc_tt03()` |
| `postgres/900_reset_sequences.sql` | Đẩy sequence IDENTITY lên MAX(id) — `db:migrate-data` đã tự làm; dùng khi nạp dữ liệu bằng cách khác |
| `../scripts/migrate-from-mssql.js`, `../scripts/verify-migration.js` | Chuyển dữ liệu và đối chiếu từng ô — xem [Chuyển dữ liệu](#chuyển-dữ-liệu-từ-sql-server) |

## Cài PostgreSQL trực tiếp trên máy chủ (Windows, không Docker)

1. Cài **PostgreSQL 17** bằng bộ cài EDB (postgresql.org/download/windows). Ghi
   lại mật khẩu superuser `postgres`. Bộ cài có sẵn ICU (cần cho collation tiếng Việt).
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
- Không chắc kết nối từ container tới với IP nguồn nào (Docker Desktop/WSL2 mỗi
  máy một khác)? Khởi động backend, xem log PostgreSQL
  (`C:\Program Files\PostgreSQL\17\data\log`) dòng
  `no pg_hba.conf entry for host "x.x.x.x"` rồi thêm đúng IP/dải đó — đừng mở `0.0.0.0/0`.

## Chuyển dữ liệu từ SQL Server

Hai script (chạy trong thư mục `server/`):

| Lệnh | Việc |
|---|---|
| `npm run db:migrate-data` (`scripts/migrate-from-mssql.js`) | Đọc 18 bảng SQL Server, ghi vào PostgreSQL trong **1 transaction** (lỗi → không ghi gì), kiểm tra số dòng, đặt lại sequence. Thêm `-- --truncate` để xoá dữ liệu PostgreSQL trước khi nạp lại. |
| `npm run db:verify-data` (`scripts/verify-migration.js`) | **Chỉ đọc.** So từng ô dữ liệu của 18 bảng + kết quả view `vw_TT03_Recommended` giữa 2 DB, kiểm tra sequence. Sai khác → in chi tiết, thoát mã 1. |

**Máy chạy script** cần: Node.js ≥ 22, `npm ci` trong `server/`, `sqlcmd`
(có sẵn khi cài SQL Server / SSMS) và kết nối được tới cả 2 DB. Image Docker
production không chứa thư mục `scripts/` — chạy từ máy quản trị hoặc máy chủ.

Biến môi trường (đặt trong phiên cmd/PowerShell, **không** ghi vào `.env`):

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `MSSQL_SERVER` | `localhost\SQLEXPRESS` | |
| `MSSQL_DATABASE` | `HRM_HOSPITAL` | |
| `MSSQL_USER`, `MSSQL_PASSWORD` | trống | Trống = Windows Authentication. Mật khẩu được chuyển cho sqlcmd qua `SQLCMDPASSWORD`, không nằm trên dòng lệnh. |
| `PG_HOST`, `PG_PORT`, `PG_DATABASE` | lấy `DB_*` trong `server/.env` | |
| `PG_USER`, `PG_PASSWORD` | lấy `DB_*` | Dùng **`hrm_owner`** — `hrm_app` không được `TRUNCATE`. |

```bat
cd server
set PG_USER=hrm_owner
set PG_PASSWORD=<mk-owner>
npm run db:migrate-data -- --truncate
npm run db:verify-data
```

### Quy trình chuyển hệ thống thật

**Trước ngày chuyển (chạy thử, không ảnh hưởng người dùng):**

1. Cài PostgreSQL, chạy `000`, `001`, `002` như trên.
2. Chạy `db:migrate-data` + `db:verify-data` với dữ liệu hiện tại → phải ra
   `✅ Khớp hoàn toàn`. Chạy thử app (bản nhánh mới) trỏ vào PostgreSQL, kiểm tra
   đăng nhập, nhập liệu, báo cáo, xuất Excel.
3. Ghi lại thời gian chạy để báo trước thời gian dừng hệ thống (dữ liệu hiện
   tại ~4 nghìn dòng → dưới 1 phút).

**Ngày chuyển:**

1. Thông báo dừng nhập liệu. Dừng backend để không còn ghi vào SQL Server:
   `docker compose -f docker-compose.prod.yml stop backend`
2. Backup SQL Server (giữ lại để quay về):

   ```bat
   sqlcmd -S localhost\SQLEXPRESS -E -C -Q "BACKUP DATABASE HRM_HOSPITAL TO DISK = N'D:\Backup\HRM_HOSPITAL_before_pg.bak' WITH COPY_ONLY, CHECKSUM"
   ```

3. `npm run db:migrate-data -- --truncate` rồi `npm run db:verify-data` → bắt buộc `✅`.
   Có sai khác → **dừng lại**, khởi động lại backend cũ (`start backend`), xử lý sau.
4. Sửa `server/.env.production`: `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`
   trỏ PostgreSQL (`hrm_app`), bỏ `DB_ENCRYPT/DB_TRUST_CERT`, thêm `DB_SSL` nếu cần.
5. Build + chạy bản mới: `docker compose -f docker-compose.prod.yml up -d --build`.
   Kiểm tra `/health`, đăng nhập, mở 1 báo cáo, xuất 1 file Excel.
6. Khoá SQL Server ở chế độ chỉ đọc (giữ 1–2 tuần để đối chiếu / quay về):

   ```bat
   sqlcmd -S localhost\SQLEXPRESS -E -C -Q "ALTER DATABASE HRM_HOSPITAL SET READ_ONLY WITH ROLLBACK IMMEDIATE"
   ```

**Quay về SQL Server** (nếu bản mới lỗi nặng):

1. `docker compose -f docker-compose.prod.yml stop backend`
2. `sqlcmd ... -Q "ALTER DATABASE HRM_HOSPITAL SET READ_WRITE"`
3. Trả `server/.env.production` về cấu hình SQL Server, checkout bản code cũ
   (nhánh `main` trước khi merge), `up -d --build`.

> ⚠️ Không có script chuyển ngược PostgreSQL → SQL Server: dữ liệu nhập **sau**
> thời điểm chuyển sẽ không có ở SQL Server. Quyết định quay về càng sớm càng tốt
> (trong ngày đầu); quá thời điểm đó thì sửa lỗi trên bản PostgreSQL.

### Backup PostgreSQL

Đặt lịch (Task Scheduler) chạy hằng ngày, giữ nhiều bản:

```bat
pg_dump -U hrm_owner -d hrm_hospital -Fc -f D:\Backup\hrm_hospital_%DATE:~-4%%DATE:~3,2%%DATE:~0,2%.dump
```

Khôi phục: `pg_restore -U hrm_owner -d hrm_hospital --clean --if-exists <file.dump>`.
Mật khẩu cho tác vụ tự động: file `%APPDATA%\postgresql\pgpass.conf` của tài
khoản Windows chạy tác vụ (không ghi mật khẩu vào file .bat).

## Khác biệt so với SQL Server cần nhớ khi chuyển code (giai đoạn 2–3)

- Tên bảng/cột không đặt trong `""` bị hạ chữ thường → câu SQL cũ
  (`FROM Departments`, `rdr.Id`) vẫn chạy, nhưng **key kết quả là chữ thường**:
  `recordset[0].Id` → `rows[0].id`.
- `[Report_Department_Records ]` (có dấu cách cuối) → `report_department_records`.
- `username`, `code_department` dùng collation ICU `ci_vi` → so sánh/UNIQUE không
  phân biệt hoa thường như cũ (có phân biệt dấu). Không dùng `LIKE` trực tiếp trên
  2 cột này (PostgreSQL < 18 báo lỗi) — viết `col COLLATE "default" LIKE ...`.
- Lớp `src/config/db.js` giữ API kiểu `mssql` (`request().input().query()`,
  `sql.Transaction`) và tự đổi `@ten` → `$n::kiểu`.
- Thời gian lưu `timestamptz` (UTC); `SYSUTCDATETIME()`/`SYSDATETIMEOFFSET()` → `now()`.
- `CAST(numeric AS SMALLINT)` của SQL Server cắt phần thập phân; PostgreSQL làm
  tròn → dùng `trunc(x)::smallint` khi cần giữ hành vi cũ.
- Đã thêm CHECK thật cho `users.status`, `departments.status`,
  `roles.department_access_type` (bản cũ đặt nhầm thành tên DEFAULT nên chưa có hiệu lực).
- Bảng `auth_sessions` và `role_department_access` có trong DB nhưng code HRM
  không dùng; vẫn giữ để không mất dữ liệu.
