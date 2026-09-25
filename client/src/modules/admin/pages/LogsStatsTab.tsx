import type { LogFilters, LogStats } from '@/types/logType';
import { useEffect, useState } from 'react';
import LogBarChart from '../components/LogBarChart';
import { filtersToQuery } from './logsPageConstants';

interface Props {
	filters: LogFilters;
	/** Bấm vào 1 mục thống kê → sang tab Nhật ký với bộ lọc tương ứng */
	onDrill: (patch: Partial<LogFilters>) => void;
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('vi-VN'));

export default function LogsStatsTab({ filters, onDrill }: Props) {
	const [stats, setStats] = useState<LogStats | null>(null);
	// Khoá của lần tải gần nhất đã xong — khác khoá hiện tại = đang tải
	const [done, setDone] = useState<{ key: string; error: string } | null>(null);

	const requestKey = filtersToQuery(filters);
	useEffect(() => {
		const ctrl = new AbortController();
		fetch(`/api/logs/stats?${requestKey}`, { signal: ctrl.signal })
			.then((r) => r.json())
			.then((d) => {
				if (d.success) setStats(d.data);
				setDone({ key: requestKey, error: d.success ? '' : 'Không tải được thống kê' });
			})
			.catch((e) => {
				if (e.name !== 'AbortError') setDone({ key: requestKey, error: 'Lỗi kết nối server' });
			});
		return () => ctrl.abort();
	}, [requestKey]);
	const loading = done?.key !== requestKey;
	const error = loading ? '' : (done?.error ?? '');

	if (error) return <div className='lg-empty-box'>{error}</div>;
	if (!stats) return <div className='lg-empty-box'>Đang tải thống kê...</div>;

	const t = stats.totals;
	const dayData = stats.by_day.map((d) => {
		const [y, m, day] = d.day.split('-');
		return {
			key: d.day,
			label: `${day}/${m}`,
			fullLabel: `Ngày ${day}/${m}/${y}`,
			value: d.requests,
			extra: [d.writes && `${d.writes} thay đổi`, d.errors && `${d.errors} lỗi`, d.failed_logins && `${d.failed_logins} đăng nhập sai`]
				.filter(Boolean)
				.join(' · '),
		};
	});
	const hourData = stats.by_hour.map((v, h) => ({
		key: String(h),
		label: `${h}h`,
		fullLabel: `${h}:00 – ${h}:59`,
		value: v,
	}));

	const kpis: { label: string; value: string; sub?: string; tone?: 'err' | 'warn'; drill?: Partial<LogFilters> }[] = [
		{ label: 'Lượt thao tác', value: fmt(t.requests), sub: `${fmt(t.users)} tài khoản · ${fmt(t.ips)} IP` },
		{ label: 'Thay đổi dữ liệu', value: fmt(t.writes), drill: { kind: 'create,update,delete', hide_noise: false } },
		{ label: 'Đăng nhập', value: fmt(t.logins), drill: { kind: 'login' } },
		{
			label: 'Đăng nhập thất bại',
			value: fmt(t.failed_logins),
			tone: t.failed_logins ? 'warn' : undefined,
			drill: { kind: 'login_failed' },
		},
		{ label: 'Bị từ chối quyền', value: fmt(t.denied), tone: t.denied ? 'warn' : undefined, drill: { kind: 'denied' } },
		{
			label: 'Lỗi hệ thống (5xx)',
			value: fmt(t.server_errors),
			tone: t.server_errors ? 'err' : undefined,
			drill: { status: '5xx', hide_noise: false },
		},
		{ label: 'Thời gian xử lý TB', value: t.avg_ms != null ? `${t.avg_ms} ms` : '—', sub: `p95: ${t.p95_ms ?? '—'} ms` },
	];

	return (
		<div className={`lg-stats${loading ? ' is-stale' : ''}`}>
			{stats.truncated && (
				<div className='lg-banner'>Dữ liệu quá lớn nên chỉ tính một phần — hãy thu hẹp khoảng thời gian.</div>
			)}
			<div className='lg-kpis'>
				{kpis.map((k) => {
					const body = (
						<>
							<span className='lg-kpi-lbl'>
								{k.tone && (
									<span
										className={`lg-dot lg-dot-${k.tone}`}
										aria-hidden
									/>
								)}
								{k.label}
							</span>
							<span className='lg-kpi-val'>{k.value}</span>
							{k.sub && <span className='lg-kpi-sub'>{k.sub}</span>}
						</>
					);
					return k.drill ? (
						<button
							key={k.label}
							className='lg-kpi lg-kpi-link'
							onClick={() => onDrill(k.drill!)}
							title='Xem chi tiết trong nhật ký'
						>
							{body}
						</button>
					) : (
						<div
							key={k.label}
							className='lg-kpi'
						>
							{body}
						</div>
					);
				})}
			</div>

			<div className='lg-grid-2'>
				<div className='lg-card'>
					<LogBarChart
						title='Lượt thao tác theo ngày'
						data={dayData}
						unit='lượt'
						labelEvery={Math.ceil(dayData.length / 10)}
					/>
				</div>
				<div className='lg-card'>
					<LogBarChart
						title='Lượt thao tác theo giờ trong ngày'
						data={hourData}
						unit='lượt'
						labelEvery={3}
					/>
				</div>
			</div>

			<div className='lg-grid-3'>
				<RankList
					title='Tài khoản hoạt động nhiều nhất'
					empty='Chưa có hoạt động'
					items={stats.top_users.map((u) => ({
						key: String(u.actor_id),
						label: u.actor_username ?? `#${u.actor_id}`,
						sub: [u.actor_role, u.writes ? `${u.writes} thay đổi` : null, u.errors ? `${u.errors} lỗi` : null]
							.filter(Boolean)
							.join(' · '),
						value: u.count,
						onClick: () => onDrill({ actor: u.actor_username ?? String(u.actor_id) }),
					}))}
				/>
				<RankList
					title='Theo phân hệ'
					empty='Chưa có hoạt động'
					items={stats.top_modules.map((m) => ({
						key: m.module,
						label: m.label,
						value: m.count,
						onClick: () => onDrill({ module: m.module }),
					}))}
				/>
				<RankList
					title='IP đăng nhập sai nhiều'
					empty='Không có lần đăng nhập sai nào'
					items={stats.failed_login_ips.map((x) => ({
						key: x.ip,
						label: x.ip,
						value: x.count,
						tone: 'warn',
						onClick: () => onDrill({ ip: x.ip, kind: 'login_failed' }),
					}))}
				/>
				<RankList
					title='Endpoint lỗi hệ thống (5xx)'
					empty='Không có lỗi hệ thống 🎉'
					items={stats.error_endpoints.map((e) => ({
						key: e.endpoint,
						label: e.endpoint,
						mono: true,
						sub: `${fmt(e.count)} lượt gọi`,
						value: e.errors,
						tone: 'err',
						onClick: () => onDrill({ status: '5xx', search: e.endpoint.split(' ')[1] ?? '', hide_noise: false }),
					}))}
				/>
				<RankList
					title='Endpoint chậm nhất (p95)'
					empty='Chưa đủ dữ liệu'
					unit='ms'
					items={stats.slowest_endpoints.map((e) => ({
						key: e.endpoint,
						label: e.endpoint,
						mono: true,
						sub: `TB ${e.avg_ms} ms · ${fmt(e.count)} lượt`,
						value: e.p95_ms ?? 0,
					}))}
				/>
			</div>
		</div>
	);
}

interface RankItem {
	key: string;
	label: string;
	sub?: string;
	value: number;
	mono?: boolean;
	tone?: 'warn' | 'err';
	onClick?: () => void;
}

function RankList({ title, items, empty, unit }: { title: string; items: RankItem[]; empty: string; unit?: string }) {
	const max = Math.max(1, ...items.map((i) => i.value));
	return (
		<div className='lg-card'>
			<h3 className='lg-card-title'>{title}</h3>
			{items.length === 0 ? (
				<p className='lg-note'>{empty}</p>
			) : (
				<ol className='lg-rank'>
					{items.map((i) => {
						const inner = (
							<>
								<span className='lg-rank-main'>
									<span className={`lg-rank-label${i.mono ? ' lg-mono' : ''}`}>
										{i.tone && (
											<span
												className={`lg-dot lg-dot-${i.tone}`}
												aria-hidden
											/>
										)}
										{i.label}
									</span>
									{i.sub && <span className='lg-actor-sub'>{i.sub}</span>}
									<span
										className='lg-rank-bar'
										style={{ width: `${(i.value / max) * 100}%` }}
									/>
								</span>
								<span className='lg-rank-val'>
									{i.value.toLocaleString('vi-VN')}
									{unit ? ` ${unit}` : ''}
								</span>
							</>
						);
						return (
							<li key={i.key}>
								{i.onClick ? (
									<button
										className='lg-rank-item lg-rank-link'
										onClick={i.onClick}
									>
										{inner}
									</button>
								) : (
									<div className='lg-rank-item'>{inner}</div>
								)}
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}
