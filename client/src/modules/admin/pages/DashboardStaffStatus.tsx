export interface DashboardStaffStatusProps {
	rateDiLam: number; // phần trăm 0–100
	totalNL: number;
	totalDiLam: number;
	totalNghiTruc: number;
	totalNghiDai: number;
	totalTT03: number;
	totalKC: number;
}

const pct = (v: number, max: number) => `${Math.min(100, (v / max) * 100)}%`;

/** Thanh nhân lực trên cùng một thang với mức TT03 yêu cầu: nhìn là biết đủ hay thiếu. */
export default function DashboardStaffStatus({
	rateDiLam,
	totalNL,
	totalDiLam,
	totalNghiTruc,
	totalNghiDai,
	totalTT03,
	totalKC,
}: DashboardStaffStatusProps) {
	// Không kết luận đủ/thiếu ở mức tổng: kết luận chính thức tính theo từng khoa
	// (điều phối) và nằm ở khối tóm tắt — ở đây chỉ đặt hai con số lên cùng thang.
	const scale = Math.max(totalNL, totalTT03, totalKC, 1);

	const parts = [
		{ key: 'on', lbl: 'Đi làm', val: totalDiLam },
		{ key: 'duty', lbl: 'Nghỉ trực', val: totalNghiTruc },
		{ key: 'long', lbl: 'Nghỉ > 2 ngày', val: totalNghiDai },
	];

	return (
		<section className='hcard ov-card'>
			<h3 className='hcard-title'>Nhân lực ĐD – HS – KTV so với TT03</h3>

			<p className='staff-figure'>
				<span className='staff-big'>{totalDiLam}</span> đi làm
				<span className='staff-sep'>/</span>
				<span className='staff-big'>{totalTT03.toFixed(1)}</span> theo TT03
			</p>

			<div
				className='staff-bar'
				role='img'
				aria-label={`${totalDiLam} trên ${totalNL} nhân lực đi làm (${rateDiLam}%), TT03 yêu cầu ${totalTT03.toFixed(1)}`}
			>
				<div
					className='staff-bar-total'
					style={{ width: pct(totalNL, scale) }}
				/>
				<div className='staff-bar-parts'>
					{parts.map((p) => (
						<span
							key={p.key}
							className={`staff-seg staff-seg-${p.key}`}
							style={{ width: pct(p.val, scale) }}
						/>
					))}
				</div>
				{totalTT03 > 0 && (
					<span
						className='staff-mark'
						style={{ left: pct(totalTT03, scale) }}
					>
						<span className='staff-mark-lbl'>TT03</span>
					</span>
				)}
			</div>

			<dl className='staff-legend'>
				{parts.map((p) => (
					<div key={p.key}>
						<dt>
							<span className={`staff-swatch staff-seg-${p.key}`} />
							{p.lbl}
						</dt>
						<dd>{p.val}</dd>
					</div>
				))}
				<div className='staff-legend-total'>
					<dt>Tổng nhân lực</dt>
					<dd>{totalNL}</dd>
				</div>
			</dl>

			<p className='staff-note'>
				Tỉ lệ đi làm {rateDiLam}%. Khuyến nghị: {totalKC > 0 ? totalKC.toFixed(1) : 'chưa cấu hình'}.
			</p>
		</section>
	);
}
