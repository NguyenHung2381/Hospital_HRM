# Hospital HRM

Hệ thống quản lý nhân sự bệnh viện (Human Resource Management). Ứng dụng fullstack monorepo gồm client React và server Node.js/Express kết nối MSSQL.

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Routing | React Router DOM v7 |
| Backend | Node.js, Express |
| Database | Microsoft SQL Server (MSSQL) |
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
    ├── scripts/
    │   └── setAccountPasswords.js  # Script set mật khẩu tài khoản (không commit output plaintext)
    └── src/
        ├── index.js                # Entry point (helmet, CORS, health check)
        ├── config/                 # Cấu hình DB (db.js)
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

- Node.js >= 18
- Microsoft SQL Server

### 1. Cài dependencies

```bash
# Từ thư mục gốc — cài cả root, client và server
npm install
npm install --prefix client
npm install --prefix server
```

### 2. Cấu hình environment

Tạo file `server/.env` (xem đầy đủ các biến trong `server/.env.example`):

```env
PORT=3000
HOST=127.0.0.1                 # đổi nếu server cần nhận traffic trực tiếp từ máy khác
DB_HOST=localhost\SQLEXPRESS   # hoặc tên server\instance
DB_NAME=Hospital_HRM
DB_USER=sa
DB_PASSWORD=your_password
JWT_SECRET=                    # chuỗi ngẫu nhiên >= 32 ký tự: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
COOKIE_SECURE=false            # đặt true khi site chạy HTTPS
CORS_ORIGIN=                   # domain thật nếu cần gọi API từ origin khác, cách nhau bởi dấu phẩy
```

### 3. Chạy ứng dụng

```bash
# Chạy đồng thời client + server
npm run dev

# Hoặc chạy riêng lẻ
npm run client   # Frontend: http://localhost:5173
npm run server   # Backend:  http://localhost:3000
```

## Chạy bằng Docker

Gồm 2 container: `web` (nginx — phục vụ giao diện, reverse-proxy `/api`, header bảo mật, giới hạn tốc độ đăng nhập) và `api` (Node, không mở cổng ra ngoài). Database dùng SQL Server có sẵn trên máy host, kết nối qua `host.docker.internal`.

```bash
# 1. Cấu hình server/.env như mục trên (DB_PORT phải là cổng TCP của SQL Server,
#    SQL Server phải bật TCP/IP và cho phép kết nối không chỉ từ localhost)
# 2. Build + chạy
docker compose up -d --build
# Truy cập: http://localhost:8080

docker compose logs -f api        # xem log server
docker compose down               # dừng
```

Biến tuỳ chọn (đặt trong shell hoặc file `.env` ở thư mục gốc):

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `WEB_PORT` | `8080` | Cổng truy cập giao diện |
| `WEB_BIND` | `0.0.0.0` | Đặt `127.0.0.1` nếu chỉ cho truy cập từ chính máy chủ |
| `DOCKER_DB_HOST` | `host.docker.internal` | Địa chỉ SQL Server nhìn từ container |
| `COOKIE_SECURE` | `false` | Đặt `true` khi truy cập qua HTTPS |

Nhật ký hệ thống nằm trong volume `hospital_hrm_api-logs`: `docker compose exec backend ls logs`.

## Nhật ký hệ thống (logs)

Ghi bằng **pino + pino-roll** (giống dự án RMS): mỗi request `/api` là 1 dòng JSON trong `server/logs/audit.YYYY-MM-DD.N.log`, xoay theo ngày (tách file khi vượt `LOG_FILE_SIZE`). Mỗi dòng có: tài khoản, vai trò, hành động, phân hệ, method/đường dẫn, mã trạng thái, thời gian xử lý, IP, thiết bị, mã request (`X-Request-Id`) và — với lỗi — message + stack. **Không** ghi body request, mật khẩu hay token.

- Trang **Dashboard → Nhật ký hệ thống** (chỉ Quản trị hệ thống): lọc theo thời gian / tài khoản / loại thao tác / phân hệ / kết quả / IP, xem chi tiết từng dòng, xuất Excel; tab Thống kê (lượt theo ngày & giờ, đăng nhập sai, lỗi 5xx, endpoint chậm, tài khoản hoạt động nhiều); tab Phiên đăng nhập (thu hồi phiên bất kỳ).
- Response lỗi trả kèm `request_id` — người dùng báo lỗi kèm mã này, admin dán vào ô tìm kiếm để ra đúng dòng log.
- File cũ hơn `LOG_RETENTION_DAYS` (mặc định 90) và phiên hết hạn quá `SESSION_RETENTION_DAYS` tự xoá (kiểm tra mỗi 6 giờ).
- Người dùng tự xem/thu hồi thiết bị đang đăng nhập ở menu tài khoản → **Phiên đăng nhập**.

### Dev bằng Docker (hot reload)

`docker-compose.dev.yml` chạy môi trường dev trong project Compose riêng `hospital_hrm_dev`: container, network, image và volume tách hẳn khỏi production (`hospital_hrm`), nên hai môi trường chạy song song được và `down` bên này không ảnh hưởng bên kia.

```bash
docker compose -f docker-compose.dev.yml up -d --build   # lần đầu / sau khi sửa Dockerfile, package.json
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml down
```

- Giao diện: `http://localhost:5174` (Vite, sửa code tự nạp lại). API: `http://127.0.0.1:3002`. Đổi bằng `DEV_WEB_PORT` / `DEV_API_PORT`.
- Cấu hình đọc từ `server/.env`. Compose tự ghi đè `HOST=0.0.0.0` và `DB_HOST=host.docker.internal` (giữ `DB_PORT`), vì `localhost\SQLEXPRESS` bên trong container là chính container. SQL Server phải bật TCP/IP ở cổng cố định.
- Thêm dependency mới: chạy lại với `--build --renew-anon-volumes` để cài lại `node_modules` trong container.

## API

Base URL: `http://localhost:3000/api`

Các endpoint (trừ nhóm đăng nhập) yêu cầu phiên đăng nhập hợp lệ: cookie HttpOnly `hrm_session` do `/auth/login` đặt (JWT, mặc định 8 giờ — `JWT_EXPIRES`). Mỗi phiên được lưu trong bảng `UserSessions` (server tự tạo khi khởi động) nên có thể xem và đăng xuất từ xa. Mọi request POST/PUT/DELETE phải kèm header `X-Requested-With: XMLHttpRequest` (chống CSRF). Đổi/đặt lại mật khẩu, khoá tài khoản → mọi phiên của tài khoản bị thu hồi.

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
