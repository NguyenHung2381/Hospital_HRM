const express = require('express');
const router = express.Router();
const appEmitter = require('../events/appEmitter');
const {
	authenticate,
	requireAdmin,
	requireDashboardRole,
	requireSelfOrAdmin,
} = require('../middleware/auth');
const { loginRateLimit } = require('../middleware/loginRateLimit');

router.get('/', (req, res) => {
	res.send('OK');
});

const departments = require('../controllers/departments');
const deptRecommendedConfig = require('../controllers/deptRecommendedConfig');
const users = require('../controllers/users');
const userDepartmentAccess = require('../controllers/userDepartmentAccess');
const userPassword = require('../controllers/userPassword');
const roles = require('../controllers/roles');
const reports = require('../controllers/reportsCore');
const reportDepartmentRecords = require('../controllers/reportDepartmentRecords');
const clsRecords = require('../controllers/clsRecords');
const auth = require('../controllers/auth');
const tt03 = require('../controllers/tt03');
const coordination = require('../controllers/coordination');
const { exportToExcel } = require('../controllers/exportReports');
const { exportClsToExcel } = require('../controllers/exportCls');

router.post('/auth/login', loginRateLimit, auth.login);

// ── Từ đây trở xuống: bắt buộc phải đăng nhập (JWT hợp lệ) ─────
router.use(authenticate);

// ── SSE: global realtime subscribe ───────────────────────────
// Đặt TRƯỚC tất cả route /:id để không bị conflict
router.get('/subscribe', (req, res) => {
	res.set({
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		'X-Accel-Buffering': 'no', // quan trọng khi đứng sau nginx
	});
	res.flushHeaders();

	// Giữ kết nối mỗi 30s để không bị proxy/browser timeout
	const keepAlive = setInterval(() => res.write(': ping\n\n'), 30000);

	const onChanged = (payload) => {
		res.write(`data: ${JSON.stringify(payload)}\n\n`);
	};

	appEmitter.on('changed', onChanged);

	// Cleanup khi client đóng tab hoặc mất mạng
	req.on('close', () => {
		clearInterval(keepAlive);
		appEmitter.off('changed', onChanged);
	});
});

// ── Departments ───────────────────────────────────────────────
// QUAN TRỌNG: /departments/simple phải đứng TRƯỚC /departments/:id
// để Express không hiểu "simple" là giá trị của :id
router.get('/departments/simple', departments.getSimple);
router.get('/departments', departments.getAll);
router.get('/departments/:id', departments.getById);
router.post('/departments', requireDashboardRole, departments.create);
router.put('/departments/:id', requireDashboardRole, departments.update);
router.delete('/departments/:id', requireDashboardRole, departments.remove);

// Cấu hình Khuyến nghị theo khoa (trang quản lý Khoa — dashboard)
router.get(
	'/departments/:id/recommended-config',
	deptRecommendedConfig.getRecommendedConfig,
);
router.post(
	'/departments/:id/recommended-config',
	requireDashboardRole,
	deptRecommendedConfig.createRecommendedConfig,
);
router.put(
	'/departments/:id/recommended-config',
	requireDashboardRole,
	deptRecommendedConfig.updateRecommendedConfig,
);
router.delete(
	'/departments/:id/recommended-config',
	requireDashboardRole,
	deptRecommendedConfig.removeRecommendedConfig,
);

// ── Users ─────────────────────────────────────────────────────
// Quản lý tài khoản (danh sách, tạo/sửa/xoá, phân quyền) → 3 vai trò dashboard
// (admin/giám đốc/điều dưỡng trưởng BV), khớp DASHBOARD_ROLES ở client.
// Các route đọc/ghi dữ liệu của CHÍNH tài khoản đang đăng nhập (để load
// dashboard riêng) → cho phép chính chủ hoặc 1 trong 3 vai trò trên.
router.get('/users', requireDashboardRole, users.getAll);
router.get(
	'/users/:id/departments',
	requireSelfOrAdmin(),
	userDepartmentAccess.getDepartments,
);
router.get(
	'/users/:id/assigned-departments',
	requireSelfOrAdmin(),
	userDepartmentAccess.getAssignedDepartments,
);
router.put(
	'/users/:id/assigned-departments',
	requireDashboardRole,
	userDepartmentAccess.setAssignedDepartments,
);
router.get(
	'/users/:id/dept-permissions',
	requireSelfOrAdmin(),
	userDepartmentAccess.getDeptPermissions,
);
router.put(
	'/users/:id/dept-permissions',
	requireDashboardRole,
	userDepartmentAccess.setDeptPermissions,
);
router.put(
	'/users/:id/reset-password',
	requireDashboardRole,
	userPassword.resetPassword,
);
router.put(
	'/users/:id/change-password',
	requireSelfOrAdmin(),
	userPassword.changePassword,
);
router.get('/users/:id', requireDashboardRole, users.getById);
router.post('/users', requireDashboardRole, users.create);
router.put('/users/:id', requireDashboardRole, users.update);
router.delete('/users/:id', requireDashboardRole, users.remove);

// ── Roles & Permissions ───────────────────────────────────────
router.get('/roles', roles.getAll);
router.get('/roles/:id', roles.getById);
router.post('/roles', requireDashboardRole, roles.create);
router.put('/roles/:id', requireDashboardRole, roles.update);
router.put(
	'/roles/:id/permissions',
	requireDashboardRole,
	roles.updatePermissions,
);
router.get('/permissions', roles.getAllPermissions);

// ── Daily Reports ─────────────────────────────────────────────
// QUAN TRỌNG: /reports/export và /reports/date/:date phải đứng
// TRƯỚC /reports/:id để tránh bị Express hiểu nhầm "export"/"date" là :id
router.get('/reports/export', exportToExcel);
router.get('/reports/cls-export', exportClsToExcel);
router.get('/reports/date/:date', reports.getByDate);
router.get('/reports', reports.getAll);
router.get('/reports/:id', reports.getById);
router.post('/reports', reports.create);
router.post('/reports/:id/records', reportDepartmentRecords.addRecord);
router.put(
	'/reports/:id/records/:recordId',
	reportDepartmentRecords.updateRecord,
);
router.delete(
	'/reports/:id/records/:recordId',
	reportDepartmentRecords.removeRecord,
);
router.delete('/reports/:id', reports.remove);

// ── Báo cáo hệ Cận lâm sàng (CLS) — dùng chung Daily_Reports ────
router.post('/reports/:id/cls-records', clsRecords.addRecord);
router.put('/reports/:id/cls-records/:recordId', clsRecords.updateRecord);
router.delete('/reports/:id/cls-records/:recordId', clsRecords.removeRecord);

// ── TT03 / Nhân lực ──────────────────────────────────────────
// Cấu hình Thông tư 03
// GET    /api/tt03/config                        – toàn bộ cấu hình TT03
// GET    /api/tt03/config/:deptId                – cấu hình TT03 của 1 khoa
// PUT    /api/tt03/config/:deptId                – cập nhật cấu hình TT03 (upsert)
router.get('/tt03/config', tt03.getConfig);
router.get('/tt03/config/:deptId', tt03.getConfigByDept);
router.put('/tt03/config/:deptId', tt03.updateConfig);

// Cấu hình Nhân lực Khuyến nghị (toàn bộ / theo deptId — dùng cho màn TT03)
// GET    /api/tt03/recommended-config            – toàn bộ cấu hình khuyến nghị
// GET    /api/tt03/recommended-config/:deptId    – cấu hình khuyến nghị của 1 khoa
// PUT    /api/tt03/recommended-config/:deptId    – cập nhật cấu hình khuyến nghị (upsert)
router.get('/tt03/recommended-config', tt03.getRecommendedConfig);
router.get('/tt03/recommended-config/:deptId', tt03.getRecommendedConfigByDept);
router.put('/tt03/recommended-config/:deptId', tt03.updateRecommendedConfig);

// Tính toán & Báo cáo
// POST   /api/tt03/calculate                     – tính thử cả 2 công thức (không lưu)
// GET    /api/tt03/report/:reportId              – nhân lực TT03 + Khuyến nghị của 1 báo cáo
router.post('/tt03/calculate', tt03.calculate);
router.get('/tt03/report/:reportId', tt03.getReportTT03);

// ── Điều phối nhân lực giữa các khoa ────────────────────────────
// Client (CoordinationPage.tsx) chỉ hiện nút thêm/sửa/xoá cho đúng vai trò
// "Quản trị hệ thống" → khoá tương ứng ở server.
router.get('/coordination', coordination.getAll);
router.post('/coordination', requireAdmin, coordination.create);
router.put('/coordination/:id', requireAdmin, coordination.update);
router.delete('/coordination/:id', requireAdmin, coordination.remove);

module.exports = router;
