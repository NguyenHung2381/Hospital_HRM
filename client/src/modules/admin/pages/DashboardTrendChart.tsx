import { ArrowLeftRight, TrendingUp } from 'lucide-react';
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
			<h3 className='hcard-title'>
				<TrendingUp size={16} /> Xu hướng 7 ngày gần nhất
			</h3>
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
										background: 'var(--blue)',
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
										background: 'var(--p)',
										borderRadius: '4px 4px 0 0',
										width: 10,
										transition: 'height .3s',
										marginLeft: 2,
									}}
								/>
							</div>
							<span
								style={{
									fontSize: '.72rem',
									color: 'var(--color-gray-400)',
									marginTop: 3,
									textAlign: 'center',
								}}
							>
								{formatShortDay(t.date)}
							</span>
							<span style={{ fontSize: '.7rem', color: 'var(--color-gray-300)' }}>{t.nb}</span>
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
					{ lbl: 'Người bệnh', col: 'var(--blue)' },
					{ lbl: 'NL đi làm', col: 'var(--p)' },
				].map((leg) => (
					<span
						key={leg.lbl}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 4,
							fontSize: '.72rem',
							color: 'var(--color-gray-500)',
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
						color: 'var(--color-gray-500)',
						marginBottom: 6,
					}}
				>
					<ArrowLeftRight size={14} /> Tình trạng điều phối
				</p>
				<div style={{ display: 'flex', gap: 8 }}>
					{[
						{
							lbl: 'Đề xuất giảm (-)',
							val: rows.filter((r) => r.dieuPhoi !== null && r.dieuPhoi > 0)
								.length,
							col: 'var(--p)',
							bg: 'var(--color-primary-pale)',
						},
						{
							lbl: 'Cần điều phối (+)',
							val: rows.filter((r) => r.dieuPhoi !== null && r.dieuPhoi < 0)
								.length,
							col: 'var(--color-error)',
							bg: 'var(--color-error-bg)',
						},
						{
							lbl: 'Không điều phối',
							val: rows.filter((r) => r.dieuPhoi === 0 || r.dieuPhoi === null)
								.length,
							col: 'var(--color-gray-400)',
							bg: 'var(--color-gray-50)',
						},
					].map((d) => (
						<div
							key={d.lbl}
							style={{
								flex: 1,
								background: 'var(--sur)',
								border: '1px solid var(--bdr)',
								borderRadius: 8,
								padding: '8px 6px',
								textAlign: 'center',
							}}
						>
							<p
								style={{
									fontSize: '1.1rem',
									fontWeight: 600,
									color: d.col,
								}}
							>
								{d.val}
							</p>
							<p
								style={{
									fontSize: '.7rem',
									color: 'var(--color-gray-500)',
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
