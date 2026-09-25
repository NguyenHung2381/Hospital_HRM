import type { LogFilters, LogMeta } from '@/types/logType';
import { formatBytes } from '@/utils/logUtils';
import '@/styles/logs.css';
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import LogsActivityTab from './LogsActivityTab';
import LogsFilterBar from './LogsFilterBar';
import LogsSessionsTab from './LogsSessionsTab';
import LogsStatsTab from './LogsStatsTab';
import { DEFAULT_FILTERS, filtersToQuery } from './logsPageConstants';

type Tab = 'activity' | 'stats' | 'sessions';

const TABS: { id: Tab; label: string }[] = [
	{ id: 'activity', label: 'Nhật ký hoạt động' },
	{ id: 'stats', label: 'Thống kê' },
	{ id: 'sessions', label: 'Phiên đăng nhập' },
];

/**
 * Trang Nhật ký hệ thống — chỉ vai trò Quản trị hệ thống.
 * Dữ liệu đọc từ file log của server (pino + pino-roll), không lưu trong DB.
 */
export default function LogsPage() {
	const [tab, setTab] = useState<Tab>('activity');
	const [filters, setFilters] = useState<LogFilters>(DEFAULT_FILTERS);
	const [meta, setMeta] = useState<LogMeta | null>(null);

	useEffect(() => {
		fetch('/api/logs/meta')
			.then((r) => r.json())
			.then((d) => d.success && setMeta(d.data))
			.catch(() => {});
	}, []);

	return (
		<div className='pg'>
			<PageHeader
				title='Nhật ký hệ thống'
				subtitle={
					meta
						? `Lưu ${meta.retention_days} ngày · ${meta.file_count} file log (${formatBytes(meta.total_bytes)})${meta.oldest_day ? ` · từ ${meta.oldest_day.split('-').reverse().join('/')}` : ''}`
						: 'Theo dõi thao tác người dùng, đăng nhập, lỗi hệ thống và phiên đăng nhập'
				}
			/>

			<div
				className='lg-tabs'
				role='tablist'
			>
				{TABS.map((t) => (
					<button
						key={t.id}
						role='tab'
						aria-selected={tab === t.id}
						className={`lg-tab${tab === t.id ? ' is-active' : ''}`}
						onClick={() => setTab(t.id)}
					>
						{t.label}
					</button>
				))}
			</div>

			{tab !== 'sessions' && (
				<LogsFilterBar
					value={filters}
					onChange={setFilters}
					meta={meta}
					exportQuery={tab === 'activity' ? filtersToQuery(filters) : null}
				/>
			)}

			{tab === 'activity' && <LogsActivityTab filters={filters} />}
			{tab === 'stats' && (
				<LogsStatsTab
					filters={filters}
					onDrill={(patch) => {
						setFilters((f) => ({ ...f, ...patch }));
						setTab('activity');
					}}
				/>
			)}
			{tab === 'sessions' && <LogsSessionsTab />}
		</div>
	);
}
