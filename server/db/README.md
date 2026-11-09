# Database — chuyển SQL Server → PostgreSQL

| Thư mục | Nội dung |
|---|---|
| `mssql/schema-snapshot.txt` | Snapshot schema SQL Server hiện tại (bảng, cột, index, FK, CHECK, số dòng, định nghĩa view/proc) — mốc để đối chiếu |
| `postgres/000_roles_database.sql` | Tạo role `hrm_owner`, `hrm_app` + database `hrm_hospital` (chạy bằng `postgres`) |
| `postgres/001_init.sql` | Toàn bộ bảng, khoá, index |
| `postgres/002_views_functions.sql` | `vw_tt03_recommended`, `usp_recalc_all()`, `usp_recalc_tt03()` |
| `postgres/003_password_change.sql` | Thêm cột `must_change_password`, `password_changed_at` cho DB tạo bằng `001_init.sql` bản cũ (idempotent — `npm run setup` tự chạy) |
| `postgres/004_auth_rate_limits.sql` | Bảng bộ đếm giới hạn đăng nhập sai (thay cho bộ nhớ tiến trình — không mất khi restart). Idempotent — `npm run setup` tự chạy |
| `postgres/010_seed_data.sql` | Danh mục cho bản cài mới (vai trò, quyền, khoa phòng + hệ số, cấu hình TT03/khuyến nghị) — sinh bằng `npm run db:export-seed`, nạp bởi `npm run setup` |
| `postgres/900_reset_sequences.sql` | Đẩy sequence IDENTITY lên MAX(id) — `db:migrate-data` đã tự làm; dùng khi nạp dữ liệu bằng cách khác |
| `../scripts/migrate-from-mssql.js`, `../scripts/verify-migration.js` | Chuyển dữ liệu và đối chiếu từng ô — xem [Chuyển dữ liệu](#chuyển-dữ-liệu-từ-sql-server) |

> Thêm file migration mới (`005_...sql`, ...): **phải idempotent** (`IF NOT EXISTS`, `CREATE OR REPLACE`...). Tự deploy ([deploy/deploy.sh](../../deploy/deploy.sh)) chạy lại mọi file trong `postgres/` bằng `hrm_owner` mỗi khi thư mục này thay đổi — trừ `000`, `001`, `010`, `900`. `npm run setup` hiện chỉ chạy `002`–`004`: thêm file mới thì bổ sung vào `setupDatabase()` trong `server/scripts/setup.js`.

## Cài PostgreSQL trực tiếp trên máy chủ (Windows, không Docker)

1. Cài **PostgreSQL 17 hoặc 18** (đã kiểm tra cả hai) bằng bộ cài EDB
   (postgresql.org/download/windows). Ghi lại mật khẩu superuser `postgres`.
   Bộ cài có sẵn ICU (cần cho collation tiếng Việt).
2. Cho `psql`/`pg_dump` chạy được trong terminal. Bộ cài **không** tự thêm thư
   mục `bin` vào `PATH` — gõ `psql` sẽ báo *"is not recognized"*. Tìm thư mục
   cài (không nhất thiết ở `C:\Program Files`):

   ```powershell
   (Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql%'").PathName
   # vd: "D:\PostgreSQL\18\bin\pg_ctl.exe" ... -D "D:\PostgreSQL\18\data"  → bin = D:\PostgreSQL\18\bin
   ```

   Thêm vào `PATH` của tài khoản Windows (mở terminal **mới** sau khi chạy):

   ```powershell
   [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';D:\PostgreSQL\18\bin', 'User')
   ```

   Chỉ cần cho phiên terminal hiện tại: `$env:Path += ';D:\PostgreSQL\18\bin'`.
3. Tạo role + DB (mật khẩu truyền qua biến, không ghi vào file). Thay
   `<mk-owner>`/`<mk-app>` bằng mật khẩu thật, **bỏ cả dấu `< >`**; `psql` sẽ
   hỏi mật khẩu của `postgres`:

   ```powershell
   cd server\db\postgres
   psql -U postgres -v ON_ERROR_STOP=1 -v owner_password="<mk-owner>" -v app_password="<mk-app>" -f 000_roles_database.sql
   ```

4. Tạo schema (hỏi mật khẩu `hrm_owner` vừa đặt):

   ```powershell
   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 001_init.sql
   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 002_views_functions.sql
   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 003_password_change.sql
   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 004_auth_rate_limits.sql
   ```

### Quên mật khẩu superuser `postgres`

`npm run setup` cần mật khẩu này (cho nhập lại 3 lần). Quên thì đặt lại
(PowerShell **Run as Administrator**, thư mục `data` tìm như bước 2):

1. Sao lưu `<data>\pg_hba.conf`, sửa **chỉ** 2 dòng `host all all 127.0.0.1/32`
   và `host all all ::1/128`: đổi `scram-sha-256` thành `trust`.
2. `Restart-Service postgresql-x64-18` (tên theo phiên bản đã cài).
3. `psql -U postgres -h localhost -c "\password postgres"` → nhập mật khẩu mới.
4. Chép lại file `pg_hba.conf` đã sao lưu, `Restart-Service` lần nữa. **Đừng
   quên bước này** — để `trust` thì ai trên máy cũng vào DB không cần mật khẩu.

### Backend chạy trong Docker, PostgreSQL trên host

Container backend (`docker-compose.prod.yml`) gọi DB qua `host.docker.internal`,
nên PostgreSQL phải nhận kết nối từ mạng Docker:

- `postgresql.conf`: `listen_addresses = 'localhost,<IP host trong mạng Docker/LAN>'`
  (hoặc `'*'` và chặn cổng 5432 bằng Windows Firewall, chỉ mở cho dải Docker).
- `pg_hba.conf` — chỉ cho đúng DB/role/dải mạng, bắt buộc `scram-sha-256`:

  ```
  host  hrm_hospital  hrm_app  172.16.0.0/12  scram-sha-256
  ```

- Restart service PostgreSQL sau khi sửa (`Restart-Service postgresql-x64-18`
  — tên theo phiên bản đã cài).
- Không chắc kết nối từ container tới với IP nguồn nào (Docker Desktop/WSL2 mỗi
  máy một khác)? Khởi động backend, xem log PostgreSQL
  (`<thư mục data>\log`, vd `D:\PostgreSQL\18\data\log`) dòng
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

PowerShell (mật khẩu nhập ẩn, không lưu vào lịch sử lệnh; biến chỉ tồn tại trong cửa sổ này):

```powershell
cd server
$env:PG_HOST = 'localhost'; $env:PG_PORT = '5432'; $env:PG_DATABASE = 'hrm_hospital'; $env:PG_USER = 'hrm_owner'
$s = Read-Host 'Mat khau hrm_owner' -AsSecureString
$env:PG_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
npm run db:migrate-data            # lần đầu (bảng trống); chạy lại thì thêm:  -- --truncate
npm run db:verify-data
Remove-Item Env:PG_PASSWORD        # xoá mật khẩu khỏi phiên khi xong
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
