// ── Tiện ích ngày + gom nhóm kỳ báo cáo (day/week/month/year) ──────────────

function toDateStr(d) {
	if (d instanceof Date) {
		// Dung local time thay vi UTC (toISOString tra UTC → lech -1 ngay voi UTC+7)
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	return String(d).slice(0, 10);
}

// Lấy tất cả các ngày trong khoảng [from, to]
function enumerateDays(from, to) {
	const days = [];
	const cur = new Date(from + 'T00:00:00');
	const end = new Date(to + 'T00:00:00');
	while (cur <= end) {
		// Dung local time thay vi toISOString (UTC) de tranh lech ngay cuoi
		days.push(toDateStr(cur));
		cur.setDate(cur.getDate() + 1);
	}
	return days;
}

// Nhóm ngày theo groupBy
function getGroupKey(dateStr, groupBy) {
	const d = new Date(dateStr + 'T00:00:00');
	switch (groupBy) {
		case 'week': {
			// ISO week: lấy thứ Hai đầu tuần
			const day = d.getDay() || 7;
			const monday = new Date(d);
			monday.setDate(d.getDate() - day + 1);
			return `Tuần ${toDateStr(monday)}`;
		}
		case 'month':
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		case 'year':
			return String(d.getFullYear());
		default:
			return dateStr;
	}
}

function formatGroupLabel(key, groupBy) {
	switch (groupBy) {
		case 'week':
			return key; // "Tuần 2024-01-01"
		case 'month': {
			const [y, m] = key.split('-');
			return `Tháng ${parseInt(m)}/${y}`;
		}
		case 'year':
			return `Năm ${key}`;
		default:
			return key;
	}
}

module.exports = { toDateStr, enumerateDays, getGroupKey, formatGroupLabel };
