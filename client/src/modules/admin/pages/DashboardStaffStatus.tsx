import { Users } from 'lucide-react';
export interface DashboardStaffStatusProps {
	rateDiLam: number;
	totalNL: number;
	totalDiLam: number;
	totalNghiTruc: number;
	totalNghiDai: number;
	totalTT03: number;
	totalKC: number;
}

export default function DashboardStaffStatus({
	rateDiLam,
	totalNL,
	totalDiLam,
	totalNghiTruc,
	totalNghiDai,
	totalTT03,
	totalKC,
}: DashboardStaffStatusProps) {
	return (
		<section className='hcard ov-card'>
			<h3 className='hcard-title'>
				<Users size={16} /> Tình trạng nhân lực ĐD – HS – KTV
			</h3>
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
							stroke='var(--color-gray-100)'
							strokeWidth='10'
						/>
						<circle
							cx='40'
							cy='40'
							r='32'
							fill='none'
							stroke='var(--p)'
							strokeWidth='10'
							strokeDasharray={`${2 * Math.PI * 32 * rateDiLam} ${2 * Math.PI * 32 * (1 - rateDiLam)}`}
							strokeLinecap='round'
							transform='rotate(-90 40 40)'
							style={{ transition: 'stroke-dasharray .5s' }}
						/>
					</svg>
					<div className='ov-nl-ring-center'>
						<span className='ov-nl-pct'>{Math.round(rateDiLam)}%</span>
						<span className='ov-nl-pct-lbl'>đi làm</span>
					</div>
				</div>
				<div className='ov-nl-stats'>
					{[
						{ lbl: 'Tổng NL', val: totalNL, col: 'var(--color-gray-800)' },
						{ lbl: 'Đi làm', val: totalDiLam, col: 'var(--p)' },
						{ lbl: 'Nghỉ trực', val: totalNghiTruc, col: 'var(--color-warning)' },
						{ lbl: 'Nghỉ > 2 ngày', val: totalNghiDai, col: 'var(--color-error)' },
					].map((s) => (
						<div
							key={s.lbl}
							className='ov-nl-stat-row'
						>
							<span style={{ fontSize: '.72rem', color: 'var(--color-gray-500)' }}>
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
						col: 'var(--txt)',
					},
					{
						lbl: 'Khuyến nghị',
						val: totalKC > 0 ? totalKC.toFixed(1) : '—',
						col: 'var(--txt)',
					},
				].map((t) => (
					<div
						key={t.lbl}
						className='ov-tt03-card'
					>
						<span
							style={{
								fontSize: '1.1rem',
								fontWeight: 600,
								color: t.col,
							}}
						>
							{t.val}
						</span>
						<span style={{ fontSize: '.72rem', color: 'var(--color-gray-500)' }}>{t.lbl}</span>
					</div>
				))}
			</div>
		</section>
	);
}
