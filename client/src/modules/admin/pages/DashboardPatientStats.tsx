export interface DashboardPatientStatsProps {
	totalCSC1: number;
	totalCSC2: number;
	totalCSC3: number;
	totalNBKham: number;
	totalNB: number;
}

/** Cơ cấu người bệnh nội trú theo cấp chăm sóc: một thanh tỉ lệ thay cho 4 ô rời. */
export default function DashboardPatientStats({
	totalCSC1,
	totalCSC2,
	totalCSC3,
	totalNBKham,
	totalNB,
}: DashboardPatientStatsProps) {
	const levels = [
		{ key: 'c1', lbl: 'Cấp 1', note: 'nặng', val: totalCSC1 },
		{ key: 'c2', lbl: 'Cấp 2', note: 'trung bình', val: totalCSC2 },
		{ key: 'c3', lbl: 'Cấp 3', note: 'nhẹ', val: totalCSC3 },
	];
	const share = (v: number) => (totalNB > 0 ? Math.round((v / totalNB) * 100) : 0);

	return (
		<section className='hcard ov-card'>
			<h3 className='hcard-title'>Người bệnh nội trú theo cấp chăm sóc</h3>

			<p className='staff-figure'>
				<span className='staff-big'>{totalNB}</span> người bệnh nội trú
			</p>

			<div
				className='nb-bar'
				role='img'
				aria-label={levels.map((l) => `${l.lbl}: ${l.val}`).join(', ')}
			>
				{levels.map((l) =>
					l.val > 0 ? (
						<span
							key={l.key}
							className={`nb-seg nb-seg-${l.key}`}
							style={{ flexGrow: l.val }}
						/>
					) : null,
				)}
			</div>

			<dl className='nb-legend'>
				{levels.map((l) => (
					<div key={l.key}>
						<dt>
							<span className={`staff-swatch nb-seg-${l.key}`} />
							{l.lbl} <span className='nb-note'>{l.note}</span>
						</dt>
						<dd>
							{l.val}
							<span className='nb-share'>{share(l.val)}%</span>
						</dd>
					</div>
				))}
			</dl>

			<p className='staff-note'>
				Ngoài ra {totalNBKham} người bệnh khám/PT kế hoạch, không tính vào tổng nội trú.
			</p>
		</section>
	);
}
