import { ChartColumn, FlaskConical, TriangleAlert, UserCheck } from 'lucide-react';
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
						color: 'var(--color-gray-500)',
						fontSize: '.85rem',
						background: 'var(--color-gray-50)',
						borderRadius: 10,
						border: '1px dashed var(--color-gray-300)',
					}}
				>
					<FlaskConical size={18} />
					<span>Chưa có khoa CLS nào nhập dữ liệu ngày này</span>
				</div>
			</section>
		);
	}

	const kpiCards: KpiCardData[] = [
		{
			icon: <FlaskConical size={20} />,
			val: clsRowsCount,
			lbl: 'Khoa CLS đã nhập',
			sub: 'trên 10 khoa',
			col: 'var(--blue)',
			bg: 'var(--color-info-bg)',
		},
		{
			icon: <ChartColumn size={20} />,
			val: clsStats.totalKhoiLuong,
			lbl: 'Tổng khối lượng CV',
			sub: `${clsStats.totalNL} tổng nhân lực`,
			col: 'var(--p)',
			bg: 'var(--color-primary-pale)',
		},
		{
			icon: <UserCheck size={20} />,
			val: clsStats.totalDiLam,
			lbl: 'Nhân lực đi làm',
			sub: `${clsStats.rateDiLam}% / khối lượng CV`,
			col: 'var(--purple)',
			bg: 'var(--purple-l)',
		},
		{
			icon: <TriangleAlert size={20} />,
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
					<h3 className='hcard-title'>
						<TriangleAlert size={16} /> Khoa CLS thiếu nhân lực
					</h3>
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
											color='var(--p)'
										/>
										<span
											style={{
												fontSize: '.72rem',
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
											fontSize: '.85rem',
											fontWeight: 600,
											color: 'var(--color-error)',
										}}
									>
										+{Math.abs(r.chenhLech ?? 0)}
									</span>
									<p style={{ fontSize: '.7rem', color: 'var(--color-gray-400)' }}>
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
