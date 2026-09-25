const { getPool, sql } = require('../config/db');
const { audit } = require('./auditLog');

// Ghi 1 sự kiện bảo mật (khoá tài khoản, sai mã 2FA, bật/tắt 2FA, đăng xuất
// mọi thiết bị...) vào bảng SecurityEvents — tra cứu được qua
// GET /api/security-events (chỉ Quản trị hệ thống). Đồng thời ghi audit log
// file. Không bao giờ throw: lỗi ghi log không được làm hỏng luồng chính.
async function logSecurityEvent(
	req,
	{ eventType, actorId = null, targetType = 'user', targetId = null, detail = null },
) {
	const ip = req?.ip ?? null;
	const userAgent = req?.get?.('user-agent') ?? null;
	audit(req, `security.${eventType}`, {
		actor_id: actorId,
		target_id: targetId,
		...(detail ? { detail } : {}),
	});
	try {
		const pool = await getPool();
		await pool
			.request()
			.input('event_type', sql.VarChar(50), eventType)
			.input('actor_id', sql.Int, actorId)
			.input('target_type', sql.VarChar(50), targetType)
			.input('target_id', sql.VarChar(50), targetId == null ? null : String(targetId))
			.input('ip_address', sql.VarChar(64), ip)
			.input('user_agent', sql.NVarChar(255), userAgent ? String(userAgent).slice(0, 255) : null)
			.input('detail', sql.NVarChar(1000), detail).query(`
				INSERT INTO SecurityEvents
					(event_type, actor_id, target_type, target_id, ip_address, user_agent, detail)
				VALUES
					(@event_type, @actor_id, @target_type, @target_id, @ip_address, @user_agent, @detail)
			`);
	} catch (err) {
		console.error('[security-events] Không ghi được sự kiện:', err.message);
	}
}

// GET /api/security-events?limit=&cursor=&event_type=&actor_id=
// Phân trang keyset theo id giảm dần.
async function listSecurityEvents(req, res, next) {
	try {
		const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
		const pool = await getPool();
		const request = pool.request().input('limit', sql.Int, limit);
		const where = ['1 = 1'];
		if (req.query.cursor && /^\d+$/.test(req.query.cursor)) {
			request.input('cursor', sql.BigInt, req.query.cursor);
			where.push('e.id < @cursor');
		}
		if (req.query.event_type) {
			request.input('event_type', sql.VarChar(50), String(req.query.event_type));
			where.push('e.event_type = @event_type');
		}
		if (req.query.actor_id && /^\d+$/.test(req.query.actor_id)) {
			request.input('actor_id', sql.Int, Number(req.query.actor_id));
			where.push('e.actor_id = @actor_id');
		}
		const result = await request.query(`
			SELECT TOP (@limit) e.*, u.username AS actor_username
			FROM SecurityEvents e
			LEFT JOIN Users u ON u.id_user = e.actor_id
			WHERE ${where.join(' AND ')}
			ORDER BY e.id DESC
		`);
		const data = result.recordset;
		const next_cursor = data.length === limit ? String(data[data.length - 1].id) : null;
		res.json({ success: true, data, next_cursor });
	} catch (err) {
		next(err);
	}
}

module.exports = { logSecurityEvent, listSecurityEvents };
