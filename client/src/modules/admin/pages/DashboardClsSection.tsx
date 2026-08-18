import MiniBar from '@/components/ui/MiniBar';
import type { aggregateClsDashboardStats } from '@/utils/clsCalc';
import DashboardKpiRow, { type KpiCardData } from './DashboardKpiRow';

export interface DashboardClsSectionProps {
	clsRowsCount: number;
	clsStats: ReturnType<typeof aggregateClsDashboardStats>;
}

export default function DashboardClsSection({
	clsRowsCount,
	clsStats,
}: DashboardClsSectionProps) {
	if (clsRowsCount === 0) {
		return (
			<section className='hcard'>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 8,
						padding: '24px 20px',
						color: '#64748b',
						fontSize: '.85rem',
						background: '#f8fafc',
						borderRadius: 10,
						border: '1px dashed #cbd5e1',
					}}
				>
					<span style={{ fontSize: '1.1rem' }}>🧪</span>
					<span>Chưa có khoa CLS nào nhập dữ liệu ngày này</span>
				</div>
			</section>
		);
	}

	const kpiCards: KpiCardData[] = [
		{
			icon: '🧪',
			val: clsRowsCount,
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
	];

	return (
		<>
			<DashboardKpiRow cards={kpiCards} />

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
	);
}
