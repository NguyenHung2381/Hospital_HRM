import type { ApiReport } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';
import { formatDateToVN, formatShortDay } from '@/utils/dateUtils';
import type { getTrendStats } from '@/utils/staffingCalc';

export interface DashboardTrendChartProps {
	trend7: ReturnType<typeof getTrendStats>['trend7'];
	maxTrendNB: number;
	maxTrendNL: number;
	selDateStr: string;
	allReports: ApiReport[];
	setSelIdx: (idx: number) => void;
	rows: KhoaRecord[];
	/** Chiếm cả hàng (khi không có khối khoa thiếu bên cạnh) */
	wide?: boolean;
}

// Mỗi chuỗi tự co theo giá trị lớn nhất của chính nó (2 đơn vị khác nhau),
// để lại khoảng trên cột cho nhãn số.
const barH = (v: number, max: number) => (max > 0 && v > 0 ? `${Math.max(4, (v / max) * 82)}%` : '0');

export default function DashboardTrendChart({
	trend7,
	maxTrendNB,
	maxTrendNL,
	selDateStr,
	allReports,
	setSelIdx,
	rows,
	wide = false,
}: DashboardTrendChartProps) {
	const canBoSung = rows.filter((r) => r.dieuPhoi !== null && r.dieuPhoi < 0).length;
	const dieuPhoi = [
		{
			lbl: 'khoa cần bổ sung',
			val: canBoSung,
			tone: canBoSung > 0 ? 'is-low' : '',
		},
		{
			lbl: 'khoa có thể giảm',
			val: rows.filter((r) => r.dieuPhoi !== null && r.dieuPhoi > 0).length,
			tone: '',
		},
		{
			lbl: 'khoa giữ nguyên',
			val: rows.filter((r) => r.dieuPhoi === 0 || r.dieuPhoi === null).length,
			tone: 'is-mute',
		},
	];

	return (
		<section className={`hcard ov-card${wide ? ' ov-trend-wide' : ''}`}>
			<div className='ov-card-head'>
				<h3 className='hcard-title'>Xu hướng {trend7.length} ngày gần nhất</h3>
				<div className='ov-trend-legend'>
					<span>
						<span className='staff-swatch ov-trend-bar-nb' /> Người bệnh
					</span>
					<span>
						<span className='staff-swatch ov-trend-bar-nl' /> Nhân lực đi làm
					</span>
				</div>
			</div>

			<div className='ov-trend'>
				{trend7.map((t) => {
					const isSel = t.date === selDateStr;
					const empty = t.nb === 0 && t.nl === 0;
					return (
						<button
							type='button'
							key={t.date}
							className={`ov-trend-col${isSel ? ' ov-trend-col-sel' : ''}`}
							aria-pressed={isSel}
							onClick={() => {
								const idx = allReports.findIndex((r) => r.report_date.slice(0, 10) === t.date);
								if (idx !== -1) setSelIdx(idx);
							}}
							title={`${formatDateToVN(t.date)}: ${t.nb} người bệnh, ${t.nl} nhân lực đi làm`}
						>
							<span className='ov-trend-plot'>
								{empty ? (
									<span className='ov-trend-none'>—</span>
								) : (
									<>
										<span className='ov-trend-stack'>
											<span className='ov-trend-val'>{t.nb}</span>
											<span
												className='ov-trend-bar ov-trend-bar-nb'
												style={{ height: barH(t.nb, maxTrendNB) }}
											/>
										</span>
										<span className='ov-trend-stack'>
											<span className='ov-trend-val'>{t.nl}</span>
											<span
												className='ov-trend-bar ov-trend-bar-nl'
												style={{ height: barH(t.nl, maxTrendNL) }}
											/>
										</span>
									</>
								)}
							</span>
							<span className='ov-trend-day'>{formatShortDay(t.date)}</span>
						</button>
					);
				})}
			</div>
			<p className='ov-trend-hint'>Chọn một cột để xem số liệu ngày đó.</p>

			<h4 className='ov-subtitle'>Điều phối theo TT03</h4>
			<dl className='ov-split'>
				{dieuPhoi.map((d) => (
					<div
						key={d.lbl}
						className={d.tone}
					>
						<dd>{d.val}</dd>
						<dt>{d.lbl}</dt>
					</div>
				))}
			</dl>
		</section>
	);
}
