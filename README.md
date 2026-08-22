# Hospital HRM

Hệ thống quản lý nhân sự bệnh viện (Human Resource Management). Ứng dụng fullstack monorepo gồm client React và server Node.js/Express kết nối MSSQL.

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Routing | React Router DOM v7 |
| Backend | Node.js, Express |
| Database | Microsoft SQL Server (MSSQL) |
| Auth | JWT (jsonwebtoken), bcrypt |
| Bảo mật | Helmet, CORS whitelist, rate limit đăng nhập, phân quyền theo phòng ban |
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

- **Xác thực & bảo mật**: Đăng nhập JWT, rate limit chống brute-force (5 lần sai/15 phút theo IP+username), Helmet, CORS whitelist theo domain, phân quyền theo role và theo phòng ban (chỉ truy cập khoa được gán)
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

Tạo file `server/.env`:

```env
PORT=3000
HOST=127.0.0.1                 # đổi nếu server cần nhận traffic trực tiếp từ máy khác
DB_HOST=localhost\SQLEXPRESS   # hoặc tên server\instance
DB_NAME=Hospital_HRM
DB_USER=sa
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
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

## API

Base URL: `http://localhost:3000/api`

Tất cả endpoint bên dưới (trừ `/auth/login`) yêu cầu JWT hợp lệ (header `Authorization: Bearer <token>`).

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login` | Đăng nhập (rate limit chống brute-force) |
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
