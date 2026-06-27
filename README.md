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
| Export | ExcelJS |
| Dev tools | Nodemon, Concurrently, ESLint |

## Cấu trúc dự án

```
Hospital_HRM/
├── client/                  # React + TypeScript frontend
│   └── src/
│       ├── app/             # Router, ProtectedRoute
│       ├── modules/
│       │   ├── admin/       # Trang quản trị (Dashboard, Tài khoản, Phòng ban, Phân quyền, Báo cáo)
│       │   ├── home/        # Trang người dùng
│       │   └── auth/        # Đăng nhập / xác thực
│       ├── components/      # Shared UI components
│       ├── layouts/         # AuthLayout, DashboardLayout, MainLayout
│       ├── hooks/           # Custom hooks
│       ├── context/         # React context
│       ├── types/           # TypeScript types
│       ├── constants/       # Hằng số
│       ├── utils/           # Tiện ích
│       └── styles/          # CSS / style
└── server/                  # Node.js + Express backend
    └── src/
        ├── index.js         # Entry point
        ├── config/          # Cấu hình DB (db.js)
        ├── controllers/     # auth, users, departments, roles, reports, exportReports
        ├── routes/          # API routes (/api/...)
        ├── middleware/      # errorHandler, auth middleware
        └── events/          # Server-sent events (SSE)
```

## Tính năng

- **Xác thực**: Đăng nhập JWT, phân quyền theo role
- **Quản lý tài khoản**: CRUD nhân viên, phân công role
- **Phòng ban**: Quản lý danh sách phòng ban
- **Phân quyền**: Cấu hình role và quyền truy cập
- **Báo cáo**: Xem và xuất báo cáo ra file Excel
- **Dashboard**: Tổng quan số liệu
- **Health check**: `/health` (server) và `/health/db` (database)

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
DB_HOST=localhost\SQLEXPRESS   # hoặc tên server\instance
DB_NAME=HospitalHRM
DB_USER=sa
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
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

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/users` | Danh sách người dùng |
| GET | `/api/departments` | Danh sách phòng ban |
| GET | `/api/roles` | Danh sách role |
| GET | `/api/reports` | Dữ liệu báo cáo |
| GET | `/api/exportReports` | Xuất báo cáo Excel |
| GET | `/health` | Kiểm tra server |
| GET | `/health/db` | Kiểm tra kết nối DB |
