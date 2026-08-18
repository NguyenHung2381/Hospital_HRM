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
						<span className='ov-nl-pct'>{Math.round(rateDiLam)}%</span>
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
						<span style={{ fontSize: '.65rem', color: '#64748b' }}>{t.lbl}</span>
					</div>
				))}
			</div>
		</section>
	);
}
