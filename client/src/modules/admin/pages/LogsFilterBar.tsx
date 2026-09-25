import type { LogFilters, LogMeta } from '@/types/logType';
import { useEffect, useState } from 'react';

interface LogsFilterBarProps {
	value: LogFilters;
	onChange: (f: LogFilters) => void;
	meta: LogMeta | null;
	/** Query cho nút Xuất Excel; null = ẩn nút */
	exportQuery: string | null;
}

const KIND_OPTIONS: { value: string; label: string }[] = [
	{ value: '', label: 'Mọi thao tác' },
	{ value: 'create,update,delete', label: 'Thay đổi dữ liệu' },
	{ value: 'login,login_failed,auth,refresh', label: 'Đăng nhập / phiên' },
	{ value: 'login_failed', label: 'Đăng nhập thất bại' },
	{ value: 'export', label: 'Xuất Excel' },
	{ value: 'denied', label: 'Bị từ chối quyền' },
	{ value: 'view', label: 'Xem' },
];

const STATUS_OPTIONS = [
	{ value: '', label: 'Mọi kết quả' },
	{ value: '2xx', label: 'Thành công' },
	{ value: 'error', label: 'Lỗi (4xx + 5xx)' },
	{ value: '4xx', label: 'Lỗi phía người dùng (4xx)' },
	{ value: '5xx', label: 'Lỗi hệ thống (5xx)' },
];

// Bộ lọc dùng chung cho tab Nhật ký và Thống kê — 1 hàng phía trên nội dung.
// Ô chữ (tài khoản, IP, tìm kiếm) chỉ áp dụng khi ngừng gõ 400ms.
export default function LogsFilterBar({ value, onChange, meta, exportQuery }: LogsFilterBarProps) {
	const [text, setText] = useState({ actor: value.actor, ip: value.ip, search: value.search });
	const [exporting, setExporting] = useState(false);

	useEffect(() => {
		setText({ actor: value.actor, ip: value.ip, search: value.search });
	}, [value.actor, value.ip, value.search]);

	useEffect(() => {
		if (text.actor === value.actor && text.ip === value.ip && text.search === value.search) return;
		const t = setTimeout(() => onChange({ ...value, ...text }), 400);
		return () => clearTimeout(t);
	}, [text, value, onChange]);

	const set = <K extends keyof LogFilters>(k: K, v: LogFilters[K]) => onChange({ ...value, [k]: v });

	const doExport = async () => {
		if (exportQuery == null) return;
		setExporting(true);
		try {
			const res = await fetch(`/api/logs/export?${exportQuery}`);
			if (!res.ok) {
				alert('Xuất Excel thất bại');
				return;
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `nhat-ky-he-thong-${value.from}_${value.to}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className='lg-filters'>
			<label className='lg-field'>
				<span>Từ ngày</span>
				<input
					type='date'
					value={value.from}
					max={value.to || undefined}
					onChange={(e) => set('from', e.target.value)}
				/>
			</label>
			<label className='lg-field'>
				<span>Đến ngày</span>
				<input
					type='date'
					value={value.to}
					min={value.from || undefined}
					onChange={(e) => set('to', e.target.value)}
				/>
			</label>
			<label className='lg-field'>
				<span>Loại thao tác</span>
				<select
					value={value.kind}
					onChange={(e) => set('kind', e.target.value)}
				>
					{KIND_OPTIONS.map((o) => (
						<option
							key={o.value}
							value={o.value}
						>
							{o.label}
						</option>
					))}
				</select>
			</label>
			<label className='lg-field'>
				<span>Phân hệ</span>
				<select
					value={value.module}
					onChange={(e) => set('module', e.target.value)}
				>
					<option value=''>Mọi phân hệ</option>
					{meta &&
						Object.entries(meta.modules)
							.filter(([k]) => k !== 'permissions')
							.map(([k, label]) => (
								<option
									key={k}
									value={k === 'roles' ? 'roles,permissions' : k}
								>
									{label}
								</option>
							))}
				</select>
			</label>
			<label className='lg-field'>
				<span>Kết quả</span>
				<select
					value={value.status}
					onChange={(e) => set('status', e.target.value)}
				>
					{STATUS_OPTIONS.map((o) => (
						<option
							key={o.value}
							value={o.value}
						>
							{o.label}
						</option>
					))}
				</select>
			</label>
			<label className='lg-field'>
				<span>Tài khoản</span>
				<input
					type='search'
					placeholder='Tên đăng nhập / ID'
					value={text.actor}
					onChange={(e) => setText((t) => ({ ...t, actor: e.target.value }))}
				/>
			</label>
			<label className='lg-field'>
				<span>IP</span>
				<input
					type='search'
					placeholder='vd 192.168.1.'
					value={text.ip}
					onChange={(e) => setText((t) => ({ ...t, ip: e.target.value }))}
				/>
			</label>
			<label className='lg-field lg-field-grow'>
				<span>Tìm kiếm</span>
				<input
					type='search'
					placeholder='Đường dẫn, lỗi, mã request...'
					value={text.search}
					onChange={(e) => setText((t) => ({ ...t, search: e.target.value }))}
				/>
			</label>
			<label className='lg-check'>
				<input
					type='checkbox'
					checked={value.hide_noise}
					onChange={(e) => set('hide_noise', e.target.checked)}
				/>
				Ẩn thao tác xem & làm mới phiên
			</label>
			{exportQuery != null && (
				<button
					className='btn-outline lg-export'
					onClick={doExport}
					disabled={exporting}
				>
					{exporting ? 'Đang xuất...' : 'Xuất Excel'}
				</button>
			)}
		</div>
	);
}
