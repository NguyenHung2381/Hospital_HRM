// Quy tắc "chốt sổ" ngày báo cáo — cùng quy tắc với isReportLocked() ở
// client (client/src/utils/staffingCalc.ts), nhưng thực thi ở SERVER để không
// lách được bằng cách gọi API trực tiếp:
//  - người có phạm vi toàn viện (department_access_type = 'all') và 3 vai trò
//    dashboard (sửa bù qua trang quản trị — trang này không khoá theo ngày)
//    luôn sửa được;
//  - người khác: ngày trước hôm nay đã chốt; hôm nay chốt từ 23:59 (giờ VN);
//    ngày tương lai chưa chốt.
const { isDashboardRole } = require('../middleware/auth');

const VN_OFFSET_MS = 7 * 3600 * 1000;
const LOCK_HOUR = 23;
const LOCK_MINUTE = 59;

// reportDate: Date (DATE của pg được parse thành 00:00 UTC, xem config/db.js)
// hoặc chuỗi 'YYYY-MM-DD'.
function toDateStr(reportDate) {
	if (reportDate instanceof Date) return reportDate.toISOString().slice(0, 10);
	return String(reportDate ?? '').slice(0, 10);
}

function isReportDateLocked(reportDate, access, user, now = Date.now()) {
	if (access && access.accessType === 'all') return false;
	if (user && isDashboardRole(user)) return false;
	const target = toDateStr(reportDate);
	const nowVn = new Date(now + VN_OFFSET_MS);
	const today = nowVn.toISOString().slice(0, 10);
	if (target > today) return false;
	const minutes = nowVn.getUTCHours() * 60 + nowVn.getUTCMinutes();
	if (minutes >= LOCK_HOUR * 60 + LOCK_MINUTE) return true;
	return target < today;
}

const LOCKED_MESSAGE = 'Ngày báo cáo này đã chốt sổ — chỉ Admin mới có thể chỉnh sửa';

function lockedResponse(res) {
	return res.status(403).json({ success: false, code: 'REPORT_LOCKED', message: LOCKED_MESSAGE });
}

module.exports = { isReportDateLocked, lockedResponse, LOCKED_MESSAGE };
