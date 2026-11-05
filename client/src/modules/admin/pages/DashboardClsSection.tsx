import { FlaskConical } from 'lucide-react';
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
				<p className='ov-empty'>
					<FlaskConical size={18} /> Chưa có khoa Cận lâm sàng nào nhập dữ liệu ngày này.
				</p>
			</section>
		);
	}

	const kpiCards: KpiCardData[] = [
		{
			val: clsRowsCount,
			lbl: 'Khoa CLS đã nhập',
			sub: 'trên 10 khoa',
			col: 'var(--blue)',
			bg: 'var(--color-info-bg)',
		},
		{
			val: clsStats.totalKhoiLuong,
			lbl: 'Tổng khối lượng CV',
			sub: `${clsStats.totalNL} tổng nhân lực`,
			col: 'var(--p)',
			bg: 'var(--color-primary-pale)',
		},
		{
			val: clsStats.totalDiLam,
			lbl: 'Nhân lực đi làm',
			sub: `${clsStats.rateDiLam}% / khối lượng CV`,
			col: 'var(--purple)',
			bg: 'var(--purple-l)',
		},
		{
			val: clsStats.khoaThieu.length,
			lbl: 'Khoa CLS thiếu NL',
			sub: `thiếu ${clsStats.tongThieu} người so khuyến cáo`,
			col: 'var(--color-error)',
			bg: 'var(--color-error-bg)',
		},
	];

	return (
		<>
			<DashboardKpiRow cards={kpiCards} />

			{clsStats.khoaThieu.length > 0 && (
				<section className='hcard ov-card'>
					<h3 className='hcard-title'>Khoa CLS thiếu nhân lực</h3>
					<div className='hcard-list'>
						{clsStats.khoaThieu.map((r) => (
							<div
								key={r.tt}
								className='hcard-row ov-thieu-row'
							>
								<div className='hcard-info'>
									<p
										className='hcard-name'
										style={{ fontSize: 'var(--fs-sm)' }}
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
											color='var(--p)'
										/>
										<span
											style={{
												fontSize: 'var(--fs-xs)',
												color: 'var(--color-gray-500)',
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
											fontSize: 'var(--fs-md)',
											fontWeight: 600,
											color: 'var(--color-error)',
										}}
									>
										+{Math.abs(r.chenhLech ?? 0)}
									</span>
									<p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-gray-400)' }}>
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
