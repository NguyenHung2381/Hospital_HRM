import Pagination from '@/components/ui/Pagination';
import type { LogFilters, LogListResponse, LogRow } from '@/types/logType';
import { describeUserAgent, formatDateTime, statusTone } from '@/utils/logUtils';
import { Fragment, useEffect, useState } from 'react';
import { filtersToQuery } from './logsPageConstants';

interface Props {
	filters: LogFilters;
}

const KIND_TONE: Record<string, string> = {
	create: 'ok',
	update: 'info',
	delete: 'err',
	login: 'ok',
	login_failed: 'err',
	denied: 'warn',
	export: 'info',
	error: 'err',
};

export default function LogsActivityTab({ filters }: Props) {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [result, setResult] = useState<LogListResponse | null>(null);
	// Khoá của lần tải gần nhất đã xong — khác khoá hiện tại = đang tải
	const [done, setDone] = useState<{ key: string; error: string } | null>(null);
	const [openId, setOpenId] = useState<string | null>(null);

	// Đổi bộ lọc → về trang 1
	const query = filtersToQuery(filters);
	const [prevQuery, setPrevQuery] = useState(query);
	if (query !== prevQuery) {
		setPrevQuery(query);
		setPage(1);
	}

	const requestKey = filtersToQuery(filters, { page, limit: pageSize });
	useEffect(() => {
		const ctrl = new AbortController();
		fetch(`/api/logs?${requestKey}`, { signal: ctrl.signal })
			.then((r) => r.json())
			.then((d: LogListResponse) => {
				if (d.success) setResult(d);
				setDone({ key: requestKey, error: d.success ? '' : 'Không tải được nhật ký' });
			})
			.catch((e) => {
				if (e.name !== 'AbortError') setDone({ key: requestKey, error: 'Lỗi kết nối server' });
			});
		return () => ctrl.abort();
	}, [requestKey]);
	const loading = done?.key !== requestKey;
	const error = loading ? '' : (done?.error ?? '');

	const rows = result?.data ?? [];

	return (
		<div className='lg-wrap'>
			{result?.truncated && (
				<div className='lg-banner'>
					Dữ liệu quá lớn nên chỉ quét một phần — hãy thu hẹp khoảng thời gian hoặc thêm bộ lọc.
				</div>
			)}
			<table className='lg-tbl'>
				<thead>
					<tr>
						<th>Thời gian</th>
						<th>Tài khoản</th>
						<th>Thao tác</th>
						<th>Đường dẫn</th>
						<th>Kết quả</th>
						<th style={{ textAlign: 'right' }}>Xử lý</th>
						<th>IP</th>
					</tr>
				</thead>
				<tbody>
					{loading && !rows.length ? (
						<tr>
							<td
								colSpan={7}
								className='lg-empty'
							>
								Đang tải...
							</td>
						</tr>
					) : error ? (
						<tr>
							<td
								colSpan={7}
								className='lg-empty'
							>
								{error}
							</td>
						</tr>
					) : rows.length === 0 ? (
						<tr>
							<td
								colSpan={7}
								className='lg-empty'
							>
								Không có nhật ký phù hợp bộ lọc
							</td>
						</tr>
					) : (
						rows.map((r) => (
							<Fragment key={r.id}>
								<tr
									className={`lg-row${openId === r.id ? ' is-open' : ''}${loading ? ' is-stale' : ''}`}
									onClick={() => setOpenId(openId === r.id ? null : r.id)}
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											setOpenId(openId === r.id ? null : r.id);
										}
									}}
									aria-expanded={openId === r.id}
								>
									<td className='lg-nowrap'>{formatDateTime(r.time)}</td>
									<td>
										<ActorCell r={r} />
									</td>
									<td>
										<div className='lg-actor'>
											<span className={`lg-chip lg-chip-${KIND_TONE[r.action_kind] ?? 'muted'}`}>
												{r.action_label}
											</span>
											<span className='lg-actor-sub'>{r.module_label}</span>
										</div>
									</td>
									<td className='lg-path'>
										{r.method && <span className='lg-method'>{r.method}</span>}
										<span className='lg-mono'>{r.path ?? '—'}</span>
									</td>
									<td>
										{r.status_code != null ? (
											<span className={`lg-status lg-status-${statusTone(r.status_code)}`}>
												{r.status_code}
											</span>
										) : (
											'—'
										)}
									</td>
									<td
										className='lg-mono'
										style={{ textAlign: 'right' }}
									>
										{r.duration_ms != null ? `${r.duration_ms} ms` : '—'}
									</td>
									<td className='lg-mono'>{r.ip ?? '—'}</td>
								</tr>
								{openId === r.id && (
									<tr className='lg-detail-row'>
										<td colSpan={7}>
											<LogDetail r={r} />
										</td>
									</tr>
								)}
							</Fragment>
						))
					)}
				</tbody>
			</table>
			{result && (
				<Pagination
					page={result.page}
					pageSize={pageSize}
					totalItems={result.total}
					totalPages={result.total_pages}
					onPageChange={setPage}
					onPageSizeChange={(n) => {
						setPageSize(n);
						setPage(1);
					}}
				/>
			)}
		</div>
	);
}

function ActorCell({ r }: { r: LogRow }) {
	const attempted = r.details?.attempted_username as string | undefined;
	if (!r.actor_username && !attempted) return <span className='lg-actor-sub'>Chưa đăng nhập</span>;
	return (
		<div className='lg-actor'>
			<span className='lg-actor-name'>{r.actor_username ?? attempted}</span>
			<span className='lg-actor-sub'>
				{r.actor_role ?? (attempted ? 'thử đăng nhập' : '')}
				{r.auth_via === 'bearer' ? ' · API' : ''}
			</span>
		</div>
	);
}

function LogDetail({ r }: { r: LogRow }) {
	const items: [string, React.ReactNode][] = [
		['Mã request', r.request_id],
		['Hành động', r.action],
		['Route', r.route],
		['Tham số', r.params ? JSON.stringify(r.params) : null],
		['Query', r.query],
		['Chi tiết', r.details ? JSON.stringify(r.details) : null],
		['Phiên', r.session_id ? `${r.session_id.slice(0, 8)}… (${r.auth_via === 'bearer' ? 'Bearer token' : 'cookie'})` : null],
		['Thiết bị', r.user_agent ? `${describeUserAgent(r.user_agent)} — ${r.user_agent}` : null],
	];
	return (
		<div className='lg-detail'>
			<dl>
				{items
					.filter(([, v]) => v != null && v !== '')
					.map(([k, v]) => (
						<Fragment key={k}>
							<dt>{k}</dt>
							<dd className='lg-mono'>{v}</dd>
						</Fragment>
					))}
			</dl>
			{r.error && (
				<div className='lg-error'>
					<strong>
						Lỗi{r.error.code != null ? ` (${r.error.code})` : ''}: {r.error.message}
					</strong>
					{r.error.stack && <pre>{r.error.stack}</pre>}
				</div>
			)}
		</div>
	);
}
