import MiniBar from '@/components/ui/MiniBar';
import type { KhoaRecord } from '@/types/reportType';

export default function DashboardTopShortage({
	top5Thieu,
}: {
	top5Thieu: KhoaRecord[];
}) {
	return (
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
									color: i === 0 ? '#dc2626' : i === 1 ? '#d97706' : '#94a3b8',
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
	);
}
