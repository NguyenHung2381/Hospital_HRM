import MiniBar from '@/components/ui/MiniBar';
import { useAppSSE } from '@/hooks/useAppSSE';
import type { ApiReport } from '@/types/apiType';
import {
	formatDateToVN,
	formatShortDay,
	getTodayDateStringVNLong,
} from '@/utils/dateUtils';
import {
	aggregateDashboardStats,
	getTrendStats,
	toKhoaRecord,
} from '@/utils/staffingCalc';
import { aggregateClsDashboardStats, toKhoaClsRecord } from '@/utils/clsCalc';
import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';

export default function DashboardPage() {
	const today = getTodayDateStringVNLong();

	const [allReports, setAllReports] = useState<ApiReport[]>([]);
	const [loading, setLoading] = useState(true);
	// Index của báo cáo đang xem (0 = mới nhất)
	const [selIdx, setSelIdx] = useState(0);

	const fetchData = useCallback(async () => {
		try {
			const from = new Date();
			from.setDate(from.getDate() - 30);
			const fromStr = from.toISOString().slice(0, 10);

			const listRes = await fetch(`/api/reports?from=${fromStr}`);
			const listData = (await listRes.json()) as {
				success: boolean;
				data: { id_report: number; report_date: string }[];
			};

			if (!listData.success || !listData.data.length) {
				setLoading(false);
				return;
			}

			// Lấy chi tiết tất cả báo cáo (tối đa 30 ngày)
			const detailResults = await Promise.all(
				listData.data.map((r) =>
					fetch(`/api/reports/${r.id_report}`).then(
						(res) =>
							res.json() as Promise<{
								success: boolean;
								data: ApiReport;
							}>,
					),
				),
			);

			const reports = detailResults.filter((r) => r.success).map((r) => r.data);

			// Sắp xếp mới nhất lên đầu
			reports.sort((a, b) => b.report_date.localeCompare(a.report_date));

			setAllReports(reports);
			setSelIdx(0);
		} catch {
			/* bỏ qua */
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// ── Realtime: tự cập nhật khi có báo cáo mới/đổi ────────
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'reports') {
					fetchData();
				}
			},
			[fetchData],
		),
	);

	if (loading) {
		return (
			<div
				className='pg'
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					minHeight: 300,
				}}
			>
				<p style={{ color: '#64748b', fontSize: '0.9rem' }}>
					Đang tải dữ liệu...
				</p>
			</div>
		);
	}

	if (!allReports.length) {
		return (
			<div
				className='pg'
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					minHeight: 300,
				}}
			>
				<p style={{ color: '#64748b', fontSize: '0.9rem' }}>
					Chưa có dữ liệu báo cáo.
				</p>
			</div>
		);
	}

	const selectedReport = allReports[selIdx];

	const rows = selectedReport.records.map((r, i) => toKhoaRecord(r, i + 1));
	const clsRows = selectedReport.cls_records.map((r, i) =>
		toKhoaClsRecord(r, i + 1),
	);
	const selDateStr = selectedReport.report_date.slice(0, 10);
	const isLatest = selIdx === 0;

	const {
		totalNB,
		totalCSC1,
		totalCSC2,
		totalCSC3,
		totalNBKham,
		totalNL,
		totalDiLam,
		totalNghiTruc,
		totalNghiDai,
		totalTT03,
		totalKC,
		rateDiLam,
		khoaThieu,
		khoaDu,
		tongThieu,
		top5Thieu,
	} = aggregateDashboardStats(rows);

	const clsStats = aggregateClsDashboardStats(clsRows);

	// Trend luôn dùng 7 ngày mới nhất
	const multiDayData = allReports.map((rep) => ({
		date: rep.report_date.slice(0, 10),
		data: rep.records.map((r, i) => toKhoaRecord(r, i + 1)),
	}));
	const { trend7, maxTrendNB, maxTrendNL } = getTrendStats(multiDayData, 7);

	return (
		<div className='pg'>
			<PageHeader
				title='Tổng quan hệ thống'
				subtitle={today}
			>
				{/* ── Chọn ngày xem ── */}
				<div className='ov-date-select-wrap'>
					<label
						className='ov-date-select-lbl'
						htmlFor='ov-date-sel'
					>
						📅 Ngày báo cáo
					</label>
					<select
						id='ov-date-sel'
						className='ov-date-select'
						value={selIdx}
						onChange={(e) => setSelIdx(Number(e.target.value))}
					>
						{allReports.map((r, i) => (
							<option
								key={r.id_report}
								value={i}
							>
								{formatDateToVN(r.report_date.slice(0, 10))}
								{i === 0 ? ' — Mới nhất' : ''}
							</option>
						))}
					</select>
				</div>

				{isLatest && (
					<span className='ov-latest-badge'>
						<span className='ov-latest-dot' />
						Cập nhật hôm nay
					</span>
				)}
			</PageHeader>

			{/* ── Row 1: KPI ── */}
			<div className='ov-kpi-grid'>
				{[
					{
						icon: '🏥',
						val: rows.length,
						lbl: 'Tổng số khoa',
						sub: 'đang theo dõi',
						col: '#2563eb',
						bg: '#eff6ff',
					},
					{
						icon: '🛌',
						val: totalNB,
						lbl: 'Tổng người bệnh',
						sub: `${totalNBKham} NB khám/PT KH`,
						col: '#079341',
						bg: '#f0faf4',
					},
					{
						icon: '👥',
						val: totalNL,
						lbl: 'Tổng nhân lực',
						sub: `${totalDiLam} đi làm hôm nay`,
						col: '#7c3aed',
						bg: '#f5f3ff',
					},
					{
						icon: '⚠️',
						val: khoaThieu.length,
						lbl: 'Khoa thiếu NL',
						sub: `thiếu ${tongThieu} người theo TT03`,
						col: '#dc2626',
						bg: '#fef2f2',
					},
				].map((c) => (
					<StatCard
						key={c.lbl}
						className='ov-kpi'
						label={c.lbl}
						value={c.val}
						icon={c.icon}
						subText={c.sub}
						textColor={c.col}
						bgColor={c.bg}
					/>
				))}
			</div>

			{/* ── Row 2: Người bệnh + Nhân lực ── */}
			<div className='ov-row2'>
				<section className='hcard ov-card'>
					<h3 className='hcard-title'>🩺 Số người bệnh theo phân cấp</h3>
					<div className='ov-nb-grid'>
						{[
							{
								lbl: 'Cấp 1 (nặng)',
								val: totalCSC1,
								col: '#dc2626',
								bg: '#fee2e2',
							},
							{
								lbl: 'Cấp 2 (trung bình)',
								val: totalCSC2,
								col: '#d97706',
								bg: '#fef3c7',
							},
							{
								lbl: 'Cấp 3 (nhẹ)',
								val: totalCSC3,
								col: '#2563eb',
								bg: '#eff6ff',
							},
							{
								lbl: 'NB khám / PT KH',
								val: totalNBKham,
								col: '#7c3aed',
								bg: '#f5f3ff',
							},
						].map((item) => (
							<div
								key={item.lbl}
								className='ov-nb-card'
								style={
									{ '--nc': item.col, '--nb': item.bg } as React.CSSProperties
								}
							>
								<span className='ov-nb-val'>{item.val}</span>
								<span className='ov-nb-lbl'>{item.lbl}</span>
								<div style={{ marginTop: 6, width: '100%' }}>
									<MiniBar
										val={item.val}
										max={totalNB}
										color={item.col}
									/>
									<span
										style={{
											fontSize: '.62rem',
											color: '#94a3b8',
											marginTop: 2,
											display: 'block',
										}}
									>
										{totalNB > 0 ? Math.round((item.val / totalNB) * 100) : 0}%
										tổng NB
									</span>
								</div>
							</div>
						))}
					</div>
					<div className='ov-nb-total'>
						<span
							style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 600 }}
						>
							Tổng người bệnh
						</span>
						<span
							style={{ fontSize: '1.4rem', fontWeight: 800, color: '#079341' }}
						>
							{totalNB}
						</span>
					</div>
				</section>

				<section className='hcard ov-card'>
					<h3 className='hcard-title'>👩‍⚕️ Tình trạng nhân lực ĐD – HS – KTV</h3>
					<div className='ov-nl-ring-wrap'>
						<div className='ov-nl-ring'>
							<svg
								viewBox='0 0 80 80'
								width='80'
								height='80'
							>
								<circle
									cx='40'
									cy='40'
									r='32'
									fill='none'
									stroke='#f1f5f9'
									strokeWidth='10'
								/>
								<circle
									cx='40'
									cy='40'
									r='32'
									fill='none'
									stroke='#079341'
									strokeWidth='10'
									strokeDasharray={`${2 * Math.PI * 32 * rateDiLam} ${2 * Math.PI * 32 * (1 - rateDiLam)}`}
									strokeLinecap='round'
									transform='rotate(-90 40 40)'
									style={{ transition: 'stroke-dasharray .5s' }}
								/>
							</svg>
							<div className='ov-nl-ring-center'>
								<span className='ov-nl-pct'>
									{Math.round(rateDiLam)}%
								</span>
								<span className='ov-nl-pct-lbl'>đi làm</span>
							</div>
						</div>
						<div className='ov-nl-stats'>
							{[
								{ lbl: 'Tổng NL', val: totalNL, col: '#1e293b' },
								{ lbl: 'Đi làm', val: totalDiLam, col: '#079341' },
								{ lbl: 'Nghỉ trực', val: totalNghiTruc, col: '#d97706' },
								{ lbl: 'Nghỉ > 2 ngày', val: totalNghiDai, col: '#dc2626' },
							].map((s) => (
								<div
									key={s.lbl}
									className='ov-nl-stat-row'
								>
									<span style={{ fontSize: '.72rem', color: '#64748b' }}>
										{s.lbl}
									</span>
									<span
										style={{
											fontSize: '.85rem',
											fontWeight: 700,
											color: s.col,
										}}
									>
										{s.val}
									</span>
								</div>
							))}
						</div>
					</div>
					<div className='ov-tt03-row'>
						{[
							{
								lbl: 'KC theo TT03',
								val: totalTT03.toFixed(1),
								col: '#2563eb',
								bg: '#eff6ff',
							},
							{
								lbl: 'Khuyến nghị',
								val: totalKC > 0 ? totalKC.toFixed(1) : '—',
								col: '#7c3aed',
								bg: '#f5f3ff',
							},
						].map((t) => (
							<div
								key={t.lbl}
								className='ov-tt03-card'
								style={{ background: t.bg }}
							>
								<span
									style={{
										fontSize: '1.1rem',
										fontWeight: 800,
										color: t.col,
									}}
								>
									{t.val}
								</span>
								<span style={{ fontSize: '.65rem', color: '#64748b' }}>
									{t.lbl}
								</span>
							</div>
						))}
					</div>
				</section>

				<section
					className='hcard ov-card'
					style={{ flex: '1 1 260px' }}
				>
					<h3 className='hcard-title'>⚠️ Top khoa thiếu nhân lực</h3>
					{top5Thieu.length === 0 ? (
						<div
							style={{
								textAlign: 'center',
								padding: '24px',
								color: '#64748b',
								fontSize: '.82rem',
							}}
						>
							✅ Tất cả khoa đủ nhân lực theo TT03
						</div>
					) : (
						<div className='hcard-list'>
							{top5Thieu.map((r, i) => (
								<div
									key={r.tt}
									className='hcard-row ov-thieu-row'
								>
									<div
										style={{
											width: 22,
											height: 22,
											borderRadius: '50%',
											background:
												i === 0 ? '#fef2f2' : i === 1 ? '#fef3c7' : '#f1f5f9',
											color:
												i === 0 ? '#dc2626' : i === 1 ? '#d97706' : '#94a3b8',
											fontSize: '.7rem',
											fontWeight: 800,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											flexShrink: 0,
										}}
									>
										{i + 1}
									</div>
									<div className='hcard-info'>
										<p
											className='hcard-name'
											style={{ fontSize: '.8rem' }}
										>
											{r.ten}
										</p>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 6,
												marginTop: 2,
											}}
										>
											<MiniBar
												val={r.diLam ?? 0}
												max={r.nlTong ?? 1}
												color='#079341'
											/>
											<span
												style={{
													fontSize: '.65rem',
													color: '#64748b',
													whiteSpace: 'nowrap',
												}}
											>
												{r.diLam}/{r.nlTong} đi làm
											</span>
										</div>
									</div>
									<div style={{ textAlign: 'right', flexShrink: 0 }}>
										<span
											style={{
												fontSize: '.85rem',
												fontWeight: 800,
												color: '#dc2626',
											}}
										>
											+{Math.abs(r.dieuPhoi ?? 0)}
										</span>
										<p style={{ fontSize: '.6rem', color: '#94a3b8' }}>
											cần bổ sung
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				<section
					className='hcard'
					style={{ flex: '1 1 320px' }}
				>
					<h3 className='hcard-title'>📈 Xu hướng 7 ngày gần nhất</h3>
					<div className='ov-trend'>
						{trend7.map((t) => {
							const isSel = t.date === selDateStr;
							return (
								<div
									key={t.date}
									className={`ov-trend-col${isSel ? ' ov-trend-col-sel' : ''}`}
									onClick={() => {
										const idx = allReports.findIndex(
											(r) => r.report_date.slice(0, 10) === t.date,
										);
										if (idx !== -1) setSelIdx(idx);
									}}
									title={formatDateToVN(t.date)}
									style={{ cursor: 'pointer' }}
								>
									<div className='ov-trend-bars'>
										<div
											title={`NB: ${t.nb}`}
											style={{
												height:
													maxTrendNB > 0
														? `${Math.max(4, (t.nb / maxTrendNB) * 52)}px`
														: '4px',
												background: '#3b82f6',
												borderRadius: '4px 4px 0 0',
												width: 10,
												transition: 'height .3s',
											}}
										/>
										<div
											title={`NL đi làm: ${t.nl}`}
											style={{
												height:
													maxTrendNL > 0
														? `${Math.max(4, (t.nl / maxTrendNL) * 52)}px`
														: '4px',
												background: '#079341',
												borderRadius: '4px 4px 0 0',
												width: 10,
												transition: 'height .3s',
												marginLeft: 2,
											}}
										/>
									</div>
									<span
										style={{
											fontSize: '.62rem',
											color: '#94a3b8',
											marginTop: 3,
											textAlign: 'center',
										}}
									>
										{formatShortDay(t.date)}
									</span>
									<span style={{ fontSize: '.6rem', color: '#cbd5e1' }}>
										{t.nb}
									</span>
								</div>
							);
						})}
					</div>
					<div
						style={{
							display: 'flex',
							gap: 12,
							marginTop: 8,
							justifyContent: 'center',
						}}
					>
						{[
							{ lbl: 'Người bệnh', col: '#3b82f6' },
							{ lbl: 'NL đi làm', col: '#079341' },
						].map((leg) => (
							<span
								key={leg.lbl}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 4,
									fontSize: '.68rem',
									color: '#64748b',
								}}
							>
								<span
									style={{
										width: 10,
										height: 10,
										borderRadius: 2,
										background: leg.col,
										display: 'inline-block',
									}}
								/>
								{leg.lbl}
							</span>
						))}
					</div>

					<div className='ov-dieuphoi-wrap'>
						<p
							style={{
								fontSize: '.72rem',
								fontWeight: 700,
								color: '#64748b',
								marginBottom: 6,
							}}
						>
							📋 Tình trạng điều phối
						</p>
						<div style={{ display: 'flex', gap: 8 }}>
							{[
								{
									lbl: 'Đề xuất giảm (-)',
									val: rows.filter((r) => r.dieuPhoi !== null && r.dieuPhoi > 0)
										.length,
									col: '#079341',
									bg: '#f0faf4',
								},
								{
									lbl: 'Cần điều phối (+)',
									val: rows.filter((r) => r.dieuPhoi !== null && r.dieuPhoi < 0)
										.length,
									col: '#dc2626',
									bg: '#fef2f2',
								},
								{
									lbl: 'Không điều phối',
									val: rows.filter(
										(r) => r.dieuPhoi === 0 || r.dieuPhoi === null,
									).length,
									col: '#94a3b8',
									bg: '#f8fafc',
								},
							].map((d) => (
								<div
									key={d.lbl}
									style={{
										flex: 1,
										background: d.bg,
										borderRadius: 8,
										padding: '8px 6px',
										textAlign: 'center',
									}}
								>
									<p
										style={{
											fontSize: '1.1rem',
											fontWeight: 800,
											color: d.col,
										}}
									>
										{d.val}
									</p>
									<p
										style={{
											fontSize: '.6rem',
											color: '#64748b',
											lineHeight: 1.3,
										}}
									>
										{d.lbl}
									</p>
								</div>
							))}
						</div>
					</div>
				</section>

				<section
					className='hcard'
					style={{ flex: '0 0 240px' }}
				>
					<h3 className='hcard-title'>ℹ️ Thông tin hệ thống</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
						{[
							['Đơn vị', 'BVHN ĐK Nghệ An'],
							['Chuẩn tính', 'TT 03/2023/TT-BYT'],
							['Phiên bản', '1.0.0 – Beta'],
							['Cập nhật', new Date().toLocaleDateString('vi-VN')],
						].map(([k, v]) => (
							<div
								key={k}
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									padding: '6px 0',
									borderBottom: '1px solid #f1f5f9',
								}}
							>
								<span style={{ fontSize: '.7rem', color: '#64748b' }}>{k}</span>
								<span
									style={{
										fontSize: '.75rem',
										fontWeight: 700,
										color: '#1e293b',
									}}
								>
									{v}
								</span>
							</div>
						))}
					</div>
					<div
						style={{
							marginTop: 10,
							background: '#f0faf4',
							borderRadius: 8,
							padding: '10px 12px',
						}}
					>
						<p style={{ fontSize: '.7rem', color: '#065f2b', fontWeight: 600 }}>
							📊 Tổng quan khoa
						</p>
						<p
							style={{
								fontSize: '1.5rem',
								fontWeight: 800,
								color: '#079341',
								margin: '2px 0',
							}}
						>
							{rows.length} khoa
						</p>
						<p style={{ fontSize: '.68rem', color: '#064e3b' }}>
							{khoaDu.length} đủ NL · {khoaThieu.length} thiếu NL
						</p>
					</div>
				</section>
			</div>

			{/* ── Row 3: Hệ Cận lâm sàng ── */}
			<h3
				className='hcard-title'
				style={{ margin: '4px 0 -4px' }}
			>
				🧪 Hệ Cận lâm sàng
			</h3>
			{clsRows.length === 0 ? (
				<section className='hcard'>
					<div
						style={{
							textAlign: 'center',
							padding: '20px',
							color: '#64748b',
							fontSize: '.82rem',
						}}
					>
						Chưa có khoa CLS nào nhập dữ liệu ngày này
					</div>
				</section>
			) : (
				<>
					<div className='ov-kpi-grid'>
						{[
							{
								icon: '🧪',
								val: clsRows.length,
								lbl: 'Khoa CLS đã nhập',
								sub: 'trên 10 khoa',
								col: '#2563eb',
								bg: '#eff6ff',
							},
							{
								icon: '📊',
								val: clsStats.totalKhoiLuong,
								lbl: 'Tổng khối lượng CV',
								sub: `${clsStats.totalNL} tổng nhân lực`,
								col: '#079341',
								bg: '#f0faf4',
							},
							{
								icon: '✅',
								val: clsStats.totalDiLam,
								lbl: 'Nhân lực đi làm',
								sub: `${clsStats.rateDiLam}% / khối lượng CV`,
								col: '#7c3aed',
								bg: '#f5f3ff',
							},
							{
								icon: '⚠️',
								val: clsStats.khoaThieu.length,
								lbl: 'Khoa CLS thiếu NL',
								sub: `thiếu ${clsStats.tongThieu} người so khuyến cáo`,
								col: '#dc2626',
								bg: '#fef2f2',
							},
						].map((c) => (
							<StatCard
								key={c.lbl}
								className='ov-kpi'
								label={c.lbl}
								value={c.val}
								icon={c.icon}
								subText={c.sub}
								textColor={c.col}
								bgColor={c.bg}
							/>
						))}
					</div>

					{clsStats.khoaThieu.length > 0 && (
						<section className='hcard ov-card'>
							<h3 className='hcard-title'>⚠️ Khoa CLS thiếu nhân lực</h3>
							<div className='hcard-list'>
								{clsStats.khoaThieu.map((r) => (
									<div
										key={r.tt}
										className='hcard-row ov-thieu-row'
									>
										<div className='hcard-info'>
											<p
												className='hcard-name'
												style={{ fontSize: '.8rem' }}
											>
												{r.ten}
											</p>
											<div
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: 6,
													marginTop: 2,
												}}
											>
												<MiniBar
													val={r.diLam ?? 0}
													max={r.khuyenCao ?? 1}
													color='#079341'
												/>
												<span
													style={{
														fontSize: '.65rem',
														color: '#64748b',
														whiteSpace: 'nowrap',
													}}
												>
													{r.diLam}/{r.khuyenCao} khuyến cáo
												</span>
											</div>
										</div>
										<div style={{ textAlign: 'right', flexShrink: 0 }}>
											<span
												style={{
													fontSize: '.85rem',
													fontWeight: 800,
													color: '#dc2626',
												}}
											>
												+{Math.abs(r.chenhLech ?? 0)}
											</span>
											<p style={{ fontSize: '.6rem', color: '#94a3b8' }}>
												cần bổ sung
											</p>
										</div>
									</div>
								))}
							</div>
						</section>
					)}
				</>
			)}
		</div>
	);
}
