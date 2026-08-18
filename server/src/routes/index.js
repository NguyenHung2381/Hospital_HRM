const express = require('express');
const router = express.Router();
const appEmitter = require('../events/appEmitter');

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

router.post('/auth/login', auth.login);

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
router.post('/departments', departments.create);
router.put('/departments/:id', departments.update);
router.delete('/departments/:id', departments.remove);

// Cấu hình Khuyến nghị theo khoa
router.get(
	'/departments/:id/recommended-config',
	deptRecommendedConfig.getRecommendedConfig,
);
router.post(
	'/departments/:id/recommended-config',
	deptRecommendedConfig.createRecommendedConfig,
);
router.put(
	'/departments/:id/recommended-config',
	deptRecommendedConfig.updateRecommendedConfig,
);
router.delete(
	'/departments/:id/recommended-config',
	deptRecommendedConfig.removeRecommendedConfig,
);

// ── Users ─────────────────────────────────────────────────────
router.get('/users', users.getAll);
router.get('/users/:id/departments', userDepartmentAccess.getDepartments);
router.get(
	'/users/:id/assigned-departments',
	userDepartmentAccess.getAssignedDepartments,
);
router.put(
	'/users/:id/assigned-departments',
	userDepartmentAccess.setAssignedDepartments,
);
router.get(
	'/users/:id/dept-permissions',
	userDepartmentAccess.getDeptPermissions,
);
router.put(
	'/users/:id/dept-permissions',
	userDepartmentAccess.setDeptPermissions,
);
router.put('/users/:id/reset-password', userPassword.resetPassword);
router.put('/users/:id/change-password', userPassword.changePassword);
router.get('/users/:id', users.getById);
router.post('/users', users.create);
router.put('/users/:id', users.update);
router.delete('/users/:id', users.remove);

// ── Roles & Permissions ───────────────────────────────────────
router.get('/roles', roles.getAll);
router.get('/roles/:id', roles.getById);
router.post('/roles', roles.create);
router.put('/roles/:id', roles.update);
router.put('/roles/:id/permissions', roles.updatePermissions);
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
router.get('/coordination', coordination.getAll);
router.post('/coordination', coordination.create);
router.put('/coordination/:id', coordination.update);
router.delete('/coordination/:id', coordination.remove);

module.exports = router;
