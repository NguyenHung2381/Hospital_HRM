/**
 * exportReports.js  —  GET /api/reports/export
 *
 * Query params:
 *   from        YYYY-MM-DD  (bắt buộc)
 *   to          YYYY-MM-DD  (bắt buộc)
 *   department  number | 'all'  (mặc định: all)
 *   groupBy     'day' | 'week' | 'month' | 'year'  (mặc định: 'day')
 *
 * Cấu trúc file Excel (xuất theo TỪNG KHOA):
 *   Sheet duy nhất — mỗi dòng = 1 ngày/tuần/tháng/năm
 *   Giống file mẫu: TT | Tên khoa | Giường/máy | NB(CSC1,CSC2,CSC3) | Tổng NB | NB ngoại trú | NV(Tổng,Nghỉ trực,Nghỉ>2ng) | Đi làm | TT03 | KN | Điều phối
 *
 * Cấu trúc file Excel (xuất TOÀN BỘ BỆNH VIỆN):
 *   Sheet 1 — "Tổng hợp"   : tổng hợp theo ngày toàn BV
 *     Cột: STT | Kỳ báo cáo | CSC1 | CSC2 | CSC3 | Tổng NB | NB ngoại trú/PT | Tổng NV | Nghỉ trực | Nghỉ>2ng | NV đi làm | Số khoa thiếu NL | TT03 toàn BV | Điều phối NL
 *   Sheet 2..N — mỗi sheet = 1 khoa, format giống file mẫu
 *
 * npm install exceljs
 */

const ExcelJS = require('exceljs');
const { getPool } = require('../config/db');
const { fetchRawRecords } = require('../services/reportsRepository');
const { enumerateDays } = require('../utils/reportDateGrouping');
const {
	groupByDepartment,
	groupKhoaByPeriod,
	buildSummaryGroups,
} = require('../services/reportAggregation');
const { buildDeptSheet } = require('../services/deptSheetBuilder');
const { buildSummarySheet } = require('../services/summarySheetBuilder');

// ════════════════════════════════════════════════════════════
// HANDLER CHÍNH
// ════════════════════════════════════════════════════════════
async function exportToExcel(req, res, next) {
	try {
		const { from, to, department = 'all', groupBy = 'day' } = req.query;

		if (!from || !to) {
			return res
				.status(400)
				.json({ success: false, message: 'Thiếu from hoặc to' });
		}
		if (!['day', 'week', 'month', 'year'].includes(groupBy)) {
			return res.status(400).json({
				success: false,
				message: 'groupBy không hợp lệ (day/week/month/year)',
			});
		}

		const pool = await getPool();
		const raw = await fetchRawRecords(pool, { from, to, department });

		if (!raw.length) {
			return res.status(404).json({
				success: false,
				message: 'Không có dữ liệu trong khoảng thời gian này',
			});
		}

		const allDays = enumerateDays(from, to);
		const wb = new ExcelJS.Workbook();
		wb.creator = 'NurseStaff System';
		wb.created = new Date();

		const isAll = !department || department === 'all';

		if (isAll) {
			// ── Xuất toàn bệnh viện ──
			const deptList = groupByDepartment(raw);

			const allGroupsForSummary = buildSummaryGroups(raw, allDays, groupBy);

			buildSummarySheet(
				wb.addWorksheet('Tổng hợp toàn BV'),
				allGroupsForSummary,
				{ from, to, groupBy },
			);

			// Sheet từng khoa
			for (const dept of deptList) {
				const safeSheetName = dept.name_department
					.replace(/[\\/*?[\]:]/g, '')
					.slice(0, 31);
				const ws = wb.addWorksheet(safeSheetName);
				const groups = groupKhoaByPeriod(dept.records, allDays, groupBy);
				buildDeptSheet(ws, dept, groups, { from, to, groupBy });
			}
		} else {
			// ── Xuất 1 khoa ──
			const dept = groupByDepartment(raw)[0];
			if (!dept) {
				return res
					.status(404)
					.json({ success: false, message: 'Không tìm thấy dữ liệu khoa này' });
			}
			const ws = wb.addWorksheet(
				dept.name_department.replace(/[\\/*?[\]:]/g, '').slice(0, 31),
			);
			const groups = groupKhoaByPeriod(dept.records, allDays, groupBy);
			buildDeptSheet(ws, dept, groups, { from, to, groupBy });
		}

		const groupLabel =
			{ day: 'Ngay', week: 'Tuan', month: 'Thang', year: 'Nam' }[groupBy] ||
			'Ngay';
		const deptLabel = isAll ? 'ToanBV' : `Khoa${department}`;
		const filename = `BaoCaoNhanLuc_${deptLabel}_${groupLabel}_${from}_${to}.xlsx`;

		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
		);
		await wb.xlsx.write(res);
		res.end();
	} catch (err) {
		next(err);
	}
}

module.exports = { exportToExcel };
