# Hospital HRM

Hệ thống quản lý nhân sự bệnh viện (Human Resource Management). Ứng dụng fullstack monorepo gồm client React và server Node.js/Express kết nối PostgreSQL.

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Routing | React Router DOM v7 |
| Backend | Node.js, Express |
| Database | PostgreSQL 17 hoặc 18 (node-postgres) — cài trực tiếp trên máy chủ, không chạy trong Docker |
| Auth | JWT trong cookie HttpOnly (jsonwebtoken), bcrypt |
| Bảo mật | Helmet, CSP, CORS whitelist, chống CSRF, rate limit đăng nhập, phân quyền xem/ghi theo phòng ban, audit log |
| Realtime | Server-Sent Events (SSE) |
| Export | ExcelJS |
| Dev tools | Nodemon, Concurrently, ESLint |

## Cấu trúc dự án

```
Hospital_HRM/
├── client/                        # React + TypeScript frontend
│   ├── public/
│   │   └── .htaccess              # Rewrite/route config khi deploy sau Apache
│   └── src/
│       ├── app/                   # Router, ProtectedRoute
│       ├── modules/
│       │   ├── admin/             # Dashboard, Tài khoản, Phòng ban, Phân quyền,
│       │   │                      # Báo cáo (khoa lâm sàng + CLS), TT03, Điều phối
│       │   ├── home/               # Trang người dùng
│       │   ├── auth/               # Đăng nhập / xác thực
│       │   └── errors/             # Trang lỗi (403, 404, ...)
│       ├── components/            # Shared UI components (common, ui)
│       ├── layouts/                # AuthLayout, DashboardLayout, MainLayout
│       ├── hooks/                  # Custom hooks
│       ├── context/                # React context
│       ├── lib/                    # API client, cấu hình dùng chung
│       ├── types/                  # TypeScript types
│       ├── constants/              # Hằng số
│       ├── utils/                  # Tiện ích
│       └── styles/                 # CSS / style (bao gồm styles/dashboard)
└── server/                         # Node.js + Express backend
    ├── db/
    │   ├── postgres/               # Script tạo role/DB, schema, view (chạy bằng psql)
    │   ├── mssql/                  # Snapshot schema SQL Server cũ (tham chiếu)
    │   └── README.md               # Cài PostgreSQL, chuyển dữ liệu, backup
    ├── scripts/
    │   ├── migrate-from-mssql.js   # Chuyển dữ liệu SQL Server → PostgreSQL (npm run db:migrate-data)
    │   └── verify-migration.js     # Đối chiếu từng ô dữ liệu 2 DB (npm run db:verify-data)
    └── src/
        ├── index.js                # Entry point (helmet, CORS, health check)
        ├── config/                 # db.js (pool pg, API kiểu request().input().query()), schemaCheck.js
        ├── controllers/            # auth, users, departments, roles, reports,
        │                           # clsRecords, coordination, tt03,
        │                           # userDepartmentAccess, userPassword,
        │                           # deptRecommendedConfig, exportReports, exportCls
        ├── services/                # reportAggregation, reportsRepository,
        │                            # reportRowFormulas, tt03Formulas, deptAccess,
        │                            # deptSheetBuilder, summarySheetBuilder,
        │                            # reportRecommendedHelper
        ├── routes/                  # API routes (/api/...)
        ├── middleware/              # auth (JWT/role/dept access), loginRateLimit, errorHandler
        ├── events/                  # Server-sent events (appEmitter)
        └── utils/                   # excelReportStyle, password, reportDateGrouping
```

## Tính năng

- **Xác thực & bảo mật**: Đăng nhập JWT lưu trong cookie HttpOnly + SameSite=Strict (thu hồi khi đăng xuất / đổi mật khẩu / khoá tài khoản), chống CSRF (header `X-Requested-With`), rate limit chống brute-force (5 lần sai/15 phút theo IP+username, 30 lần/IP), chính sách mật khẩu (≥ 8 ký tự, có chữ và số), đặt lại mật khẩu bằng mật khẩu tạm ngẫu nhiên, Helmet + CSP, CORS whitelist, phân quyền theo role và theo phòng ban (chỉ xem/ghi khoa được gán), audit log (`server/logs/audit-YYYY-MM-DD.log`)
- **Quản lý tài khoản**: CRUD nhân viên, gán phòng ban, phân quyền, đổi/đặt lại mật khẩu
- **Phòng ban**: Quản lý danh sách phòng ban, cấu hình nhân lực khuyến nghị theo khoa
- **Phân quyền**: Cấu hình role và quyền truy cập (permission grid)
- **Báo cáo ngày**: Nhập/xem số liệu khoa lâm sàng (ward) và khoa Cận lâm sàng (CLS) trên cùng báo cáo, xuất Excel riêng cho từng loại
- **TT03 / Nhân lực**: Cấu hình theo Thông tư 03, tính toán nhân lực định biên và khuyến nghị theo khoa
- **Điều phối nhân lực**: Ghi nhận điều động nhân sự giữa các khoa, lịch sử điều phối
- **Dashboard**: Tổng quan số liệu, biểu đồ xu hướng, tình trạng nhân sự, top khoa thiếu người
- **Realtime**: Cập nhật dữ liệu qua SSE (`/api/subscribe`)
- **Health check**: `/health` (server) và `/health/db` (database, yêu cầu đăng nhập + vai trò dashboard)

## Cài đặt

### Yêu cầu

- Node.js >= 22
- PostgreSQL 17 hoặc 18 (bộ cài Windows của EDB, có sẵn ICU), thư mục `bin` đã thêm vào `PATH` — tạo role/DB/schema theo [server/db/README.md](server/db/README.md)

### 1. Cài dependencies

```bash
# Từ thư mục gốc — cài cả root, client và server
npm install
npm install --prefix client
npm install --prefix server
```

### 2. Tạo database

```bat
cd server\db\postgres
psql -U postgres -v ON_ERROR_STOP=1 -v owner_password="<mk-owner>" -v app_password="<mk-app>" -f 000_roles_database.sql
psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 001_init.sql
psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 002_views_functions.sql
```

Chuyển dữ liệu cũ từ SQL Server: xem [server/db/README.md → Chuyển dữ liệu](server/db/README.md#chuyển-dữ-liệu-từ-sql-server).

### 3. Cấu hình environment

Tạo file `server/.env` (xem đầy đủ các biến trong `server/.env.example`):

```env
NODE_ENV=development           # máy dev; production dùng server/.env.production (xem mục Môi trường)
PORT=3000
HOST=127.0.0.1                 # đổi nếu server cần nhận traffic trực tiếp từ máy khác
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hrm_hospital
DB_USER=hrm_app                # role ứng dụng — KHÔNG dùng postgres / hrm_owner
DB_PASSWORD=your_password
DB_SSL=false                   # true khi PostgreSQL ở máy khác
JWT_SECRET=                    # chuỗi ngẫu nhiên >= 32 ký tự: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
COOKIE_SECURE=false            # đặt true khi site chạy HTTPS
CORS_ORIGIN=                   # domain thật nếu cần gọi API từ origin khác, cách nhau bởi dấu phẩy
```

### 4. Chạy ứng dụng

```bash
# Chạy đồng thời client + server
npm run dev

# Hoặc chạy riêng lẻ
npm run client   # Frontend: http://localhost:5173
npm run server   # Backend:  http://localhost:3000
```

## Môi trường Dev và Production

Dự án tách thành 2 môi trường độc lập. Mỗi môi trường có file compose, stage Dockerfile, file cấu hình và cổng riêng. Có thể chạy song song trên cùng một máy mà không ảnh hưởng nhau.

| | **Dev** | **Production** |
|---|---|---|
| Mục đích | Lập trình, sửa code thấy ngay (hot reload) | Chạy thật cho người dùng trong viện |
| Cách chạy | `npm run dev` hoặc `docker-compose.yml` | `docker-compose.prod.yml` |
| Tên project Compose | `hospital_hrm_dev` | `hospital_hrm` |
| Stage Dockerfile | `dev` (nodemon + Vite dev server) | `prod` (Node + nginx, build tĩnh) |
| File cấu hình server | `server/.env` | `server/.env.production` (không có → dùng `server/.env`) |
| `NODE_ENV` | `development` — trả chi tiết lỗi DB về client | `production` — ẩn chi tiết lỗi, cảnh báo nếu DB ở máy khác mà `DB_SSL≠true`, hoặc `DB_USER` là `postgres`/`hrm_owner` |
| Giao diện | `http://localhost:5173` (npm) / `http://localhost:5174` (Docker) | `https://dieuduong.bvnghean.vn` → máy chủ `:8080` |
| API | `http://localhost:3000` (npm) / `http://127.0.0.1:3002` (Docker) | Không mở ra ngoài, chỉ nginx gọi qua mạng nội bộ |
| Source code | Mount từ máy host, sửa là chạy lại | Đóng vào image lúc build, phải build lại khi cập nhật |
| Cookie phiên | `COOKIE_SECURE=false` (HTTP) | `COOKIE_SECURE=true` (bắt buộc HTTPS) |
| Bảo mật container | Không giới hạn (tiện debug) | read-only, không root, `cap_drop: ALL`, giới hạn RAM |
| Log | `server/logs/` trên máy | volume `hospital_hrm_api-logs` |

> Cả hai môi trường dùng PostgreSQL cài trực tiếp trên máy (không nằm trong compose). Backend chạy trong Docker gọi DB qua `host.docker.internal`, nên PostgreSQL phải nghe trên interface mạng Docker và `pg_hba.conf` phải cho phép dải đó — xem [server/db/README.md](server/db/README.md#backend-chạy-trong-docker-postgresql-trên-host).

### Dev

#### Cách 1: npm (không cần Docker)

```bash
# 1. Cài dependencies (xem mục Cài đặt)
# 2. cp server/.env.example server/.env rồi điền DB, JWT_SECRET
#    và đổi NODE_ENV=development (file mẫu để sẵn production)
npm run dev          # client :5173 + server :3000 cùng lúc
```

Vite tự proxy `/api` sang `http://localhost:3000`, nên mở `http://localhost:5173` là dùng được ngay.

#### Cách 2: Docker (hot reload)

Không cần cài Node trên máy, chỉ cần Docker Desktop.

```bash
docker compose up -d --build   # lần đầu / sau khi sửa Dockerfile, package.json
docker compose logs -f backend # xem log server
docker compose down            # dừng
```

- Giao diện `http://localhost:5174`, API `http://127.0.0.1:3002` (chỉ máy local gọi được, dùng cho Postman...). Muốn đổi cổng thì đặt `DEV_WEB_PORT` / `DEV_API_PORT` trong file `.env` ở thư mục gốc. Cổng mặc định khác `npm run dev` và Hospital_RMS dev nên không bị trùng.
- `./server` và `./client` được mount vào container: sửa code → nodemon / Vite tự nạp lại (dùng polling vì bind mount trên Windows không phát sự kiện thay đổi file).
- Cấu hình đọc từ `server/.env` (dùng chung với cách 1). Compose tự ghi đè:
  - `NODE_ENV=development`
  - `HOST=0.0.0.0`: để container frontend gọi được backend
  - `DB_HOST=host.docker.internal`: vì `localhost` bên trong container là chính container. `DB_PORT` vẫn lấy từ `server/.env`.
- `node_modules` nằm trong container (bản Linux), không dùng thư mục của Windows (`bcrypt` là native module). Thêm dependency mới thì chạy lại với `--build --renew-anon-volumes`.

### Production

Gồm 2 container:

- `frontend`: nginx phục vụ giao diện đã build, reverse-proxy `/api`, header bảo mật, rate-limit, lấy IP thật của người dùng qua proxy tin cậy. Đây là container duy nhất mở cổng ra ngoài.
- `backend`: Node, không mở cổng ra ngoài, read-only, không chạy bằng root. Có healthcheck `/health`; `frontend` chỉ khởi động khi `backend` đã healthy.

Luồng truy cập: `https://dieuduong.bvnghean.vn` → reverse proxy HTTPS → máy chủ `:8080` → `frontend` (nginx) → `backend:3000` → PostgreSQL trên host.

#### Triển khai lần đầu

```bash
# 1. Tạo cấu hình server
cp server/.env.production.example server/.env.production
#    Điền DB_USER=hrm_app / DB_PASSWORD (KHÔNG dùng postgres/hrm_owner) và JWT_SECRET
#    (khác với máy dev). Xem chú thích trong file mẫu.

# 2. (Tuỳ chọn) Tạo file .env ở thư mục gốc cho biến của compose — xem bảng dưới

# 3. Build + chạy
docker compose -f docker-compose.prod.yml up -d --build

# 4. Kiểm tra
docker compose -f docker-compose.prod.yml ps                 # cả 2 container phải ở trạng thái healthy
docker compose -f docker-compose.prod.yml logs -f backend    # log server
```

#### Cập nhật phiên bản mới

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build      # build lại image, thay container; volume log giữ nguyên
```

#### Lệnh thường dùng

```bash
docker compose -f docker-compose.prod.yml down                       # dừng (giữ volume log)
docker compose -f docker-compose.prod.yml restart backend            # khởi động lại server (vd sau khi sửa .env.production)
docker compose -f docker-compose.prod.yml exec backend ls logs       # xem danh sách file log
```

#### Biến của compose

Đặt trong file `.env` ở thư mục gốc (không commit, dùng chung cho cả 2 file compose). Khác với `server/.env.production`: file này chỉ dành cho compose, không đi vào container.

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `WEB_PORT` | `8080` | Cổng nhận traffic từ proxy HTTPS |
| `WEB_BIND` | `0.0.0.0` | Proxy HTTPS ở cùng máy → `127.0.0.1` (LAN không gọi thẳng HTTP được). Proxy ở máy khác → giữ mặc định và dùng firewall chỉ mở `8080` cho IP proxy |
| `TRUSTED_PROXIES` | `127.0.0.1 + 172.16.0.0/12` | IP/CIDR của proxy HTTPS. Proxy ở máy khác **bắt buộc** khai, nếu không mọi người dùng chung 1 IP → rate-limit đăng nhập chặn cả viện |

#### Lưu ý

- `COOKIE_SECURE=true` thì cookie chỉ gửi qua HTTPS. Thử nhanh bằng `http://localhost:8080` (không qua proxy) thì tạm đặt `false`, nếu không sẽ không đăng nhập được.
- `NODE_ENV`, `HOST`, `PORT`, `TRUST_PROXY` đã cố định trong `docker-compose.prod.yml`, đặt trong `.env.production` cũng không có tác dụng.
- Không đổi `name: hospital_hrm` trong `docker-compose.prod.yml`: tên volume log thật (`hospital_hrm_api-logs`) phụ thuộc vào nó.
- Server **không** tự tạo/sửa bảng: role `hrm_app` không có quyền DDL. Schema tạo trước bằng `server/db/postgres/*.sql` (role `hrm_owner`); lúc khởi động server chỉ kiểm tra đủ bảng, thiếu thì dừng và báo file cần chạy.
- Backup PostgreSQL hằng ngày bằng `pg_dump` — xem [server/db/README.md](server/db/README.md#backup-postgresql).

### Các file cấu hình

| File | Môi trường | Commit? | Ghi chú |
|------|-----------|---------|---------|
| `server/.env.example` | Dev | Có | Mẫu cho `server/.env` |
| `server/.env` | Dev (npm + Docker dev) | **Không** | |
| `server/.env.production.example` | Production | Có | Mẫu cho `server/.env.production` |
| `server/.env.production` | Production | **Không** | Đọc lúc chạy container, không đóng vào image (`.dockerignore`) |
| `.env` (thư mục gốc) | Cả hai | **Không** | Biến của compose: `WEB_PORT`, `TRUSTED_PROXIES`, `DEV_WEB_PORT`... |
| `docker-compose.yml` | Dev | Có | Project `hospital_hrm_dev` |
| `docker-compose.prod.yml` | Production | Có | Project `hospital_hrm` |
| `server/Dockerfile`, `client/Dockerfile` | Cả hai | Có | Stage `dev` và `prod`; `prod` luôn nằm cuối file để build mặc định ra image prod |

## Nhật ký hệ thống (logs)

Ghi bằng **pino + pino-roll** (giống dự án RMS): mỗi request `/api` là 1 dòng JSON trong `server/logs/audit.YYYY-MM-DD.N.log`, xoay theo ngày (tách file khi vượt `LOG_FILE_SIZE`). Mỗi dòng có: tài khoản, vai trò, hành động, phân hệ, method/đường dẫn, mã trạng thái, thời gian xử lý, IP, thiết bị, mã request (`X-Request-Id`) và — với lỗi — message + stack. **Không** ghi body request, mật khẩu hay token.

- Trang **Dashboard → Nhật ký hệ thống** (chỉ Quản trị hệ thống): lọc theo thời gian / tài khoản / loại thao tác / phân hệ / kết quả / IP, xem chi tiết từng dòng, xuất Excel; tab Thống kê (lượt theo ngày & giờ, đăng nhập sai, lỗi 5xx, endpoint chậm, tài khoản hoạt động nhiều); tab Phiên đăng nhập (thu hồi phiên bất kỳ).
- Response lỗi trả kèm `request_id` — người dùng báo lỗi kèm mã này, admin dán vào ô tìm kiếm để ra đúng dòng log.
- File cũ hơn `LOG_RETENTION_DAYS` (mặc định 90) và phiên hết hạn quá `SESSION_RETENTION_DAYS` tự xoá (kiểm tra mỗi 6 giờ).
- Người dùng tự xem/thu hồi thiết bị đang đăng nhập ở menu tài khoản → **Phiên đăng nhập**.

## API

Base URL: `http://localhost:3000/api`

Các endpoint (trừ nhóm đăng nhập) yêu cầu phiên đăng nhập hợp lệ: cookie HttpOnly `hrm_session` do `/auth/login` đặt (JWT, mặc định 8 giờ — `JWT_EXPIRES`). Mỗi phiên được lưu trong bảng `usersessions` nên có thể xem và đăng xuất từ xa. Mọi request POST/PUT/DELETE phải kèm header `X-Requested-With: XMLHttpRequest` (chống CSRF). Đổi/đặt lại mật khẩu, khoá tài khoản → mọi phiên của tài khoản bị thu hồi.

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login` | Đăng nhập web — `{ username, password }` (rate limit + khoá tạm tài khoản khi sai nhiều lần) |
| POST | `/api/auth/2fa/verify` | Bước 2 cho tài khoản đã bật 2FA — `{ pre_auth_token, code }` |
| POST | `/api/auth/logout` | Đăng xuất (thu hồi phiên hiện tại) |
| GET | `/api/auth/me` | Tài khoản đang đăng nhập |
| GET / POST | `/api/auth/2fa/status` \| `/2fa/setup` \| `/2fa/verify-setup` \| `/2fa/disable` | Quản lý xác thực 2 lớp của chính mình |
| GET / DELETE | `/api/auth/sessions` \| `/api/auth/sessions/:sessionId` | Phiên đăng nhập của chính mình / đăng xuất 1 thiết bị khác |
| POST | `/api/auth/logout-all` | Đăng xuất mọi thiết bị khác |
| GET | `/api/security-events` | Nhật ký sự kiện bảo mật (chỉ Quản trị hệ thống) |
| GET | `/api/logs` \| `/logs/stats` \| `/logs/export` \| `/logs/meta` | Nhật ký hệ thống: danh sách, thống kê, xuất Excel (chỉ Quản trị hệ thống) |
| GET / DELETE | `/api/admin/sessions` \| `/api/admin/sessions/:sid` | Mọi phiên đang hoạt động / thu hồi (chỉ Quản trị hệ thống) |
| POST | `/api/admin/users/:id/revoke-sessions` | Buộc 1 tài khoản đăng xuất khỏi mọi thiết bị |
| GET | `/api/subscribe` | Realtime updates qua SSE |
| GET/POST/PUT/DELETE | `/api/departments` | Quản lý phòng ban |
| GET/POST/PUT/DELETE | `/api/departments/:id/recommended-config` | Cấu hình nhân lực khuyến nghị theo khoa |
| GET/POST/PUT/DELETE | `/api/users` | Quản lý tài khoản |
| GET/PUT | `/api/users/:id/assigned-departments` | Phòng ban được gán cho user |
| GET/PUT | `/api/users/:id/dept-permissions` | Quyền theo phòng ban |
| PUT | `/api/users/:id/reset-password` \| `/change-password` | Đặt lại / đổi mật khẩu |
| GET/POST/PUT | `/api/roles`, `/api/permissions` | Role và quyền truy cập |
| GET/POST/DELETE | `/api/reports` | Báo cáo ngày |
| POST/PUT/DELETE | `/api/reports/:id/records` | Số liệu khoa lâm sàng trong báo cáo |
| POST/PUT/DELETE | `/api/reports/:id/cls-records` | Số liệu khoa Cận lâm sàng (CLS) trong báo cáo |
| GET | `/api/reports/export` \| `/api/reports/cls-export` | Xuất báo cáo ra Excel (ward / CLS) |
| GET/PUT | `/api/tt03/config`, `/api/tt03/recommended-config` | Cấu hình TT03 và nhân lực khuyến nghị |
| POST | `/api/tt03/calculate` | Tính thử nhân lực (không lưu) |
| GET | `/api/tt03/report/:reportId` | Nhân lực TT03 + khuyến nghị của 1 báo cáo |
| GET/POST/PUT/DELETE | `/api/coordination` | Điều phối nhân lực giữa các khoa |
| GET | `/health` | Kiểm tra server |
| GET | `/health/db` | Kiểm tra kết nối DB (yêu cầu vai trò dashboard) |
