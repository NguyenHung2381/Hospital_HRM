import { CircleCheck, TriangleAlert } from 'lucide-react';
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
			<h3 className='hcard-title'>
				<TriangleAlert size={16} /> Top khoa thiếu nhân lực
			</h3>
			{top5Thieu.length === 0 ? (
				<div
					style={{
						textAlign: 'center',
						padding: '24px',
						color: 'var(--color-gray-500)',
						fontSize: '.82rem',
					}}
				>
					<CircleCheck size={16} /> Tất cả khoa đủ nhân lực theo TT03
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
										i === 0 ? 'var(--color-error-bg)' : i === 1 ? 'var(--color-warning-bg)' : 'var(--color-gray-100)',
									color: i === 0 ? 'var(--color-error)' : i === 1 ? 'var(--color-warning)' : 'var(--color-gray-400)',
									fontSize: '.7rem',
									fontWeight: 600,
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
										color='var(--p)'
									/>
									<span
										style={{
											fontSize: '.72rem',
											color: 'var(--color-gray-500)',
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
										fontWeight: 600,
										color: 'var(--color-error)',
									}}
								>
									+{Math.abs(r.dieuPhoi ?? 0)}
								</span>
								<p style={{ fontSize: '.7rem', color: 'var(--color-gray-400)' }}>
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
