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
}

export default function DashboardTrendChart({
	trend7,
	maxTrendNB,
	maxTrendNL,
	selDateStr,
	allReports,
	setSelIdx,
	rows,
}: DashboardTrendChartProps) {
	return (
		<section
			className='hcard'
			style={{ flex: '1 1 320px' }}
		>
			<h3 className='hcard-title'>📈 Xu hướng 7 ngày gần nhất</h3>
			<div className='ov-trend'>
				{trend7.map((t) => {
					const isSel = t.date === selDateStr;
					return (
						<div
							key={t.date}
							className={`ov-trend-col${isSel ? ' ov-trend-col-sel' : ''}`}
							onClick={() => {
								const idx = allReports.findIndex(
									(r) => r.report_date.slice(0, 10) === t.date,
								);
								if (idx !== -1) setSelIdx(idx);
							}}
							title={formatDateToVN(t.date)}
							style={{ cursor: 'pointer' }}
						>
							<div className='ov-trend-bars'>
								<div
									title={`NB: ${t.nb}`}
									style={{
										height:
											maxTrendNB > 0
												? `${Math.max(4, (t.nb / maxTrendNB) * 52)}px`
												: '4px',
										background: '#3b82f6',
										borderRadius: '4px 4px 0 0',
										width: 10,
										transition: 'height .3s',
									}}
								/>
								<div
									title={`NL đi làm: ${t.nl}`}
									style={{
										height:
											maxTrendNL > 0
												? `${Math.max(4, (t.nl / maxTrendNL) * 52)}px`
												: '4px',
										background: '#079341',
										borderRadius: '4px 4px 0 0',
										width: 10,
										transition: 'height .3s',
										marginLeft: 2,
									}}
								/>
							</div>
							<span
								style={{
									fontSize: '.62rem',
									color: '#94a3b8',
									marginTop: 3,
									textAlign: 'center',
								}}
							>
								{formatShortDay(t.date)}
							</span>
							<span style={{ fontSize: '.6rem', color: '#cbd5e1' }}>{t.nb}</span>
						</div>
					);
				})}
			</div>
			<div
				style={{
					display: 'flex',
					gap: 12,
					marginTop: 8,
					justifyContent: 'center',
				}}
			>
				{[
					{ lbl: 'Người bệnh', col: '#3b82f6' },
					{ lbl: 'NL đi làm', col: '#079341' },
				].map((leg) => (
					<span
						key={leg.lbl}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 4,
							fontSize: '.68rem',
							color: '#64748b',
						}}
					>
						<span
							style={{
								width: 10,
								height: 10,
								borderRadius: 2,
								background: leg.col,
								display: 'inline-block',
							}}
						/>
						{leg.lbl}
					</span>
				))}
			</div>

			<div className='ov-dieuphoi-wrap'>
				<p
					style={{
						fontSize: '.72rem',
						fontWeight: 700,
						color: '#64748b',
						marginBottom: 6,
					}}
				>
					📋 Tình trạng điều phối
				</p>
				<div style={{ display: 'flex', gap: 8 }}>
					{[
						{
							lbl: 'Đề xuất giảm (-)',
							val: rows.filter((r) => r.dieuPhoi !== null && r.dieuPhoi > 0)
								.length,
							col: '#079341',
							bg: '#f0faf4',
						},
						{
							lbl: 'Cần điều phối (+)',
							val: rows.filter((r) => r.dieuPhoi !== null && r.dieuPhoi < 0)
								.length,
							col: '#dc2626',
							bg: '#fef2f2',
						},
						{
							lbl: 'Không điều phối',
							val: rows.filter((r) => r.dieuPhoi === 0 || r.dieuPhoi === null)
								.length,
							col: '#94a3b8',
							bg: '#f8fafc',
						},
					].map((d) => (
						<div
							key={d.lbl}
							style={{
								flex: 1,
								background: d.bg,
								borderRadius: 8,
								padding: '8px 6px',
								textAlign: 'center',
							}}
						>
							<p
								style={{
									fontSize: '1.1rem',
									fontWeight: 800,
									color: d.col,
								}}
							>
								{d.val}
							</p>
							<p
								style={{
									fontSize: '.6rem',
									color: '#64748b',
									lineHeight: 1.3,
								}}
							>
								{d.lbl}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
