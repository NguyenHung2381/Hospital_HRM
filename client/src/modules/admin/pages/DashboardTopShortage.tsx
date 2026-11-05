import { CircleCheck } from 'lucide-react';
import MiniBar from '@/components/ui/MiniBar';
import type { KhoaRecord } from '@/types/reportType';

export default function DashboardTopShortage({
	top5Thieu,
}: {
	top5Thieu: KhoaRecord[];
}) {
	return (
		<section className='hcard ov-card'>
			<h3 className='hcard-title'>Khoa thiếu nhân lực nhiều nhất</h3>
			{top5Thieu.length === 0 ? (
				<p className='ov-empty-ok'>
					<CircleCheck size={18} /> Không có khoa nào thiếu nhân lực theo TT03.
				</p>
			) : (
				<ol className='short-list'>
					{top5Thieu.map((r) => (
						<li
							key={r.tt}
							className='short-row'
						>
							<div className='short-info'>
								<p className='short-name'>{r.ten}</p>
								<div className='short-meter'>
									<MiniBar
										val={r.diLam ?? 0}
										max={r.nlTong ?? 1}
										color='var(--p)'
									/>
									<span>
										{r.diLam}/{r.nlTong} đi làm
									</span>
								</div>
							</div>
							<p className='short-need'>
								<b>+{Math.abs(r.dieuPhoi ?? 0)}</b>
								<span>cần bổ sung</span>
							</p>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
