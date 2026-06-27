import ChartIcon from '@/assets/svg/ChartIcon';
import DownloadIcon from '@/assets/svg/DownloadIcon';

import {
	defaultReportConfig,
	REPORT_COLS,
	REPORT_TYPES,
} from '@/constants/mockData';
import { useAuth } from '@/context/useAuth';
import FormField from '@/modules/admin/components/FormField';
import type { ReportConfig } from '@/types/reportType';
import { diffDays } from '@/utils/dateUtils';
import { useState } from 'react';

const GROUP_BY_OPTIONS = [
	{ value: 'day', label: 'Theo ngày' },
	{ value: 'week', label: 'Theo tuần' },
	{ value: 'month', label: 'Theo tháng' },
	{ value: 'year', label: 'Theo năm' },
];

// ── Page ──────────────────────────────────────────────────
// inModal=true  → bỏ PageHeader, dùng bên trong ModalForm
// inModal=false → hiển thị PageHeader, dùng trong Dashboard
export default function ReportPage({ inModal = false }: { inModal?: boolean }) {
	const { khoaList } = useAuth();
	const [cfg, setCfg] = useState<ReportConfig>(defaultReportConfig());
	const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>(
		'day',
	);
	const [loading, setLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState('');

	const setField = <K extends keyof ReportConfig>(
		key: K,
		val: ReportConfig[K],
	) => setCfg((p) => ({ ...p, [key]: val }));

	const days = diffDays(cfg.rFrom, cfg.rTo);
	const khoaName =
		cfg.rKhoa === 'all'
			? 'Tất cả khoa'
			: (khoaList.find((k) => String(k.id) === cfg.rKhoa)?.ten ?? '—');

	// ── Xuất Excel ──────────────────────────────────────────
	const handleExportExcel = async () => {
		if (!cfg.rFrom || !cfg.rTo) {
			setErrorMsg('Vui lòng chọn khoảng thời gian');
			return;
		}
		if (cfg.rFrom > cfg.rTo) {
			setErrorMsg('Ngày bắt đầu phải trước ngày kết thúc');
			return;
		}

		try {
			setLoading(true);
			setErrorMsg('');

			const params = new URLSearchParams({
				from: cfg.rFrom,
				to: cfg.rTo,
				department: cfg.rKhoa ?? 'all',
				groupBy,
			});

			const res = await fetch(`/api/reports/export?${params}`, {
				headers: {
					Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
				},
			});

			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				throw new Error(
					(json as { message?: string }).message ?? `Lỗi ${res.status}`,
				);
			}

			// Lấy tên file từ header Content-Disposition
			const disposition = res.headers.get('content-disposition') ?? '';
			const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;"\n]+)/i);
			const filename = match
				? decodeURIComponent(match[1].trim().replace(/"/g, ''))
				: `BaoCaoNhanLuc_${cfg.rFrom}_${cfg.rTo}.xlsx`;

			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (err: unknown) {
			setErrorMsg(
				err instanceof Error ? err.message : 'Xuất thất bại, vui lòng thử lại',
			);
		} finally {
			setLoading(false);
		}
	};

	const isAll = cfg.rKhoa === 'all';
	const groupByLabel =
		GROUP_BY_OPTIONS.find((g) => g.value === groupBy)?.label ?? '';

	// Tóm tắt cấu hình để hiển thị trong preview
	const summary = [
		{
			icon: '📋',
			label: 'Loại',
			val: REPORT_TYPES.find((t) => t.value === cfg.rType)?.label ?? '',
		},
		{ icon: '🏥', label: 'Phạm vi', val: khoaName },
		{ icon: '📅', label: 'Từ ngày', val: cfg.rFrom },
		{ icon: '📅', label: 'Đến ngày', val: cfg.rTo },
		{ icon: '🗓️', label: 'Số ngày', val: `${days} ngày` },
		{ icon: '📊', label: 'Nhóm theo', val: groupByLabel },
	];

	return (
		<div className={inModal ? 'pg pg--modal' : 'pg'}>
			{!inModal && (
				<div className='pg-header'>
					<h2 className='pg-title'>Tạo báo cáo</h2>
					<p className='pg-subtitle'>
						Xuất dữ liệu nhân lực ĐD - HS - KTV theo khoa và thời gian
					</p>
				</div>
			)}

			<div className='report-layout'>
				{/* ── Cột trái: Cấu hình ── */}
				<section className='rep-card'>
					<h3 className='rep-card-title'>⚙️ Cấu hình báo cáo</h3>

					<FormField label='Loại báo cáo'>
						<select
							className='fi-input'
							value={cfg.rType}
							onChange={(e) =>
								setField('rType', e.target.value as ReportConfig['rType'])
							}
						>
							{REPORT_TYPES.map((t) => (
								<option
									key={t.value}
									value={t.value}
								>
									{t.label}
								</option>
							))}
						</select>
					</FormField>

					<FormField label='Khoa / Phòng'>
						<select
							className='fi-input'
							value={cfg.rKhoa}
							onChange={(e) => setField('rKhoa', e.target.value)}
						>
							<option value='all'>Tất cả khoa</option>
							{khoaList.map((k) => (
								<option
									key={k.id}
									value={String(k.id)}
								>
									{k.ten}
								</option>
							))}
						</select>
					</FormField>

					<FormField label='Nhóm dữ liệu theo'>
						<select
							className='fi-input'
							value={groupBy}
							onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
						>
							{GROUP_BY_OPTIONS.map((g) => (
								<option
									key={g.value}
									value={g.value}
								>
									{g.label}
								</option>
							))}
						</select>
					</FormField>

					<div className='mrow2'>
						<FormField label='Từ ngày'>
							<input
								className='fi-input'
								type='date'
								value={cfg.rFrom}
								onChange={(e) => setField('rFrom', e.target.value)}
							/>
						</FormField>

						<FormField label='Đến ngày'>
							<input
								className='fi-input'
								type='date'
								value={cfg.rTo}
								min={cfg.rFrom}
								onChange={(e) => setField('rTo', e.target.value)}
							/>
						</FormField>
					</div>

					{/* Cột dữ liệu sẽ xuất */}
					<div className='rep-cols-preview'>
						<p
							className='fi-label'
							style={{ marginBottom: 6 }}
						>
							Các cột dữ liệu sẽ xuất
						</p>
						<div className='rep-cols-list'>
							{REPORT_COLS.map((c) => (
								<span
									key={c.key}
									className='rep-col-chip'
									style={{ '--cc': c.color } as React.CSSProperties}
								>
									{c.label}
								</span>
							))}
						</div>
					</div>

					{/* Thông báo lỗi */}
					{errorMsg && <p className='rep-error-msg'>⚠️ {errorMsg}</p>}

					{/* Nút xuất */}
					<div className='rep-actions'>
						<button
							className='btn-primary rep-btn'
							onClick={handleExportExcel}
							disabled={loading}
						>
							{loading ? (
								<>
									<span className='rep-spinner' /> Đang xuất…
								</>
							) : (
								<>
									<DownloadIcon /> Xuất Excel (.xlsx)
								</>
							)}
						</button>

						<button
							className='btn-outline rep-btn'
							disabled
							title='Đang phát triển'
						>
							<DownloadIcon /> Xuất PDF
						</button>
					</div>
				</section>

				{/* ── Cột phải: Preview ── */}
				<section className='rep-card rep-card-preview'>
					<h3 className='rep-card-title'>👁️ Xem trước cấu hình</h3>

					{/* Tóm tắt tham số */}
					<div className='rep-summary'>
						{summary.map((s) => (
							<div
								key={s.label}
								className='rep-summary-row'
							>
								<span className='rep-summary-icon'>{s.icon}</span>
								<span className='rep-summary-label'>{s.label}</span>
								<span className='rep-summary-val'>{s.val}</span>
							</div>
						))}
					</div>

					{/* Biểu đồ cột giả minh hoạ */}
					<div className='rep-chart-area'>
						<p className='rep-chart-title'>
							<ChartIcon size={16} /> Minh hoạ dữ liệu (demo)
						</p>
						<div className='rep-bars'>
							{REPORT_COLS.map((c, ci) => {
								const heights = [72, 55, 60, 40, 22];
								return (
									<div
										key={c.key}
										className='rep-bar-col'
									>
										<div
											className='rep-bar'
											style={
												{
													height: heights[ci],
													background: c.color,
												} as React.CSSProperties
											}
											title={c.label}
										/>
										<span className='rep-bar-label'>{c.label}</span>
									</div>
								);
							})}
						</div>
					</div>

					{/* Mô tả cấu trúc file */}
					<div className='rep-preview-empty'>
						<div className='rep-preview-icon'>📊</div>
						{isAll ? (
							<>
								<p className='rep-preview-title'>
									Xuất toàn bệnh viện — nhiều sheet
								</p>
								<ul className='rep-preview-list'>
									<li>
										<strong>Sheet 1 — Tổng hợp toàn BV</strong>
										<span>
											Tổng NB, tổng NV, đi làm, nghỉ, số khoa thiếu NL (
											{groupByLabel})
										</span>
									</li>
									<li>
										<strong>Sheet 2..N — Từng khoa</strong>
										<span>
											Mỗi sheet = 1 khoa, dòng theo {groupByLabel.toLowerCase()}
											, ngày không có dữ liệu ghi "Không có dữ liệu"
										</span>
									</li>
								</ul>
							</>
						) : (
							<>
								<p className='rep-preview-title'>Xuất 1 khoa — 1 sheet</p>
								<ul className='rep-preview-list'>
									<li>
										<strong>1 sheet duy nhất</strong>
										<span>
											Mỗi dòng = 1{' '}
											{groupByLabel.replace('Theo ', '').toLowerCase()}, theo
											mẫu TT03
										</span>
									</li>
									<li>
										<strong>Ngày không có dữ liệu</strong>
										<span>Dòng đó ghi "Không có dữ liệu"</span>
									</li>
								</ul>
							</>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
