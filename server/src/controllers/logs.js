const ExcelJS = require('exceljs');
const { getPool, sql } = require('../config/db');
const logReader = require('../services/logReader');
const sessionStore = require('../services/sessionStore');
const { invalidateUserCache } = require('../middleware/auth');
const { audit } = require('../utils/auditLog');
const { C, fnt, al, sf, tb } = require('../utils/excelReportStyle');

// Trang Nhật ký hệ thống — chỉ vai trò "Quản trị hệ thống" (routes/index.js).

// GET /api/logs?page&limit&from&to&actor&kind&module&status&method&ip&search&hide_noise
async function list(req, res, next) {
	try {
		res.json({ success: true, ...(await logReader.getAll(req.query)) });
	} catch (err) {
		next(err);
	}
}

// GET /api/logs/stats — cùng bộ lọc như danh sách
async function stats(req, res, next) {
	try {
		res.json({ success: true, data: await logReader.getStats(req.query) });
	} catch (err) {
		next(err);
	}
}

// GET /api/logs/meta — cấu hình lưu trữ + danh mục nhãn cho bộ lọc
async function meta(req, res, next) {
	try {
		res.json({ success: true, data: await logReader.getMeta() });
	} catch (err) {
		next(err);
	}
}

const fmtTime = (iso) =>
	new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

// GET /api/logs/export — xuất Excel theo bộ lọc hiện tại
async function exportExcel(req, res, next) {
	try {
		const { rows, truncated } = await logReader.getRowsForExport(req.query);
		const wb = new ExcelJS.Workbook();
		wb.creator = 'Hospital HRM';
		const ws = wb.addWorksheet('Nhật ký', { views: [{ state: 'frozen', ySplit: 1 }] });
		ws.columns = [
			{ header: 'Thời gian', key: 'time', width: 20 },
			{ header: 'Tài khoản', key: 'user', width: 20 },
			{ header: 'Vai trò', key: 'role', width: 20 },
			{ header: 'Thao tác', key: 'action', width: 26 },
			{ header: 'Phân hệ', key: 'module', width: 20 },
			{ header: 'Phương thức', key: 'method', width: 11 },
			{ header: 'Đường dẫn', key: 'path', width: 38 },
			{ header: 'Trạng thái', key: 'status', width: 10 },
			{ header: 'Thời gian xử lý (ms)', key: 'duration', width: 14 },
			{ header: 'IP', key: 'ip', width: 16 },
			{ header: 'Chi tiết', key: 'details', width: 40 },
			{ header: 'Lỗi', key: 'error', width: 40 },
			{ header: 'Mã request', key: 'request_id', width: 38 },
		];
		const hdr = ws.getRow(1);
		hdr.eachCell((c) => {
			c.font = fnt({ bold: true, color: 'FFFFFF' });
			c.fill = sf(C.hdrBlue);
			c.alignment = al('center', true);
			c.border = tb();
		});
		hdr.height = 28;

		for (const r of rows) {
			const row = ws.addRow({
				time: fmtTime(r.time),
				user: r.actor_username ?? r.details?.attempted_username ?? '—',
				role: r.actor_role ?? '',
				action: r.action_label,
				module: r.module_label,
				method: r.method ?? '',
				path: r.path ?? '',
				status: r.status_code ?? '',
				duration: r.duration_ms ?? '',
				ip: r.ip ?? '',
				details: r.details ? JSON.stringify(r.details) : '',
				error: r.error?.message ?? '',
				request_id: r.request_id ?? '',
			});
			row.eachCell((c) => {
				c.font = fnt({ size: 9 });
				c.border = tb('DDDDDD');
				c.alignment = al('left');
			});
			if ((r.status_code ?? 0) >= 400) row.getCell('status').font = fnt({ size: 9, bold: true, color: 'C00000' });
		}
		if (truncated) {
			const note = ws.addRow({ time: 'Đã cắt bớt — thu hẹp khoảng thời gian để xuất đầy đủ' });
			note.getCell('time').font = fnt({ italic: true, color: 'C00000' });
		}
		ws.autoFilter = { from: 'A1', to: 'M1' };

		audit(req, 'export', { rows: rows.length });
		const stamp = new Date().toISOString().slice(0, 10);
		res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		res.setHeader('Content-Disposition', `attachment; filename="nhat-ky-he-thong-${stamp}.xlsx"`);
		await wb.xlsx.write(res);
		res.end();
	} catch (err) {
		next(err);
	}
}

// ── Quản lý phiên đăng nhập toàn hệ thống ──────────────────────

function toSessionDto(s, currentJti) {
	return {
		id: s.jti,
		id_user: s.id_user,
		username: s.username,
		full_name: s.full_name,
		name_role: s.name_role,
		ip_address: s.ip_address,
		user_agent: s.user_agent,
		created_at: s.created_at,
		last_used_at: s.last_seen_at ?? s.created_at,
		expires_at: s.expires_at,
		current: s.jti === currentJti,
	};
}

// GET /api/admin/sessions?user_id=
async function allSessions(req, res, next) {
	try {
		const id_user = req.query.user_id ? Number(req.query.user_id) : null;
		if (id_user !== null && !Number.isInteger(id_user))
			return res.status(400).json({ success: false, message: 'user_id không hợp lệ' });
		const rows = await sessionStore.listActiveSessions({ id_user });
		res.json({ success: true, data: rows.map((s) => toSessionDto(s, req.sessionJti)) });
	} catch (err) {
		next(err);
	}
}

// DELETE /api/admin/sessions/:sid
async function revokeAnySession(req, res, next) {
	try {
		const sid = String(req.params.sid);
		if (!/^[0-9a-f]{32}$/.test(sid))
			return res.status(400).json({ success: false, message: 'Mã phiên không hợp lệ' });
		const ok = await sessionStore.revokeSession(sid);
		if (!ok) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên đăng nhập' });
		audit(req, 'session.revoke', { session_id: sid });
		res.json({ success: true, message: 'Đã thu hồi phiên đăng nhập' });
	} catch (err) {
		next(err);
	}
}

// POST /api/admin/users/:id/revoke-sessions — buộc đăng xuất 1 tài khoản khỏi mọi thiết bị
async function revokeUserSessions(req, res, next) {
	try {
		const id_user = Number(req.params.id);
		if (!Number.isInteger(id_user))
			return res.status(400).json({ success: false, message: 'Mã tài khoản không hợp lệ' });
		const pool = await getPool();
		const u = await pool
			.request()
			.input('id', sql.Int, id_user)
			.query(`SELECT id_user, username FROM Users WHERE id_user = @id`);
		if (!u.recordset.length)
			return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
		// Không tự đá phiên đang dùng để thao tác
		const exceptJti = id_user === req.user.id_user ? req.sessionJti : null;
		const count = await sessionStore.revokeAllSessions(id_user, exceptJti);
		invalidateUserCache(id_user);
		audit(req, 'session.revoke_user', {
			target_user_id: id_user,
			target_username: u.recordset[0].username,
			revoked: count,
		});
		res.json({ success: true, message: `Đã thu hồi ${count} phiên`, data: { revoked: count } });
	} catch (err) {
		next(err);
	}
}

module.exports = { list, stats, meta, exportExcel, allSessions, revokeAnySession, revokeUserSessions };
