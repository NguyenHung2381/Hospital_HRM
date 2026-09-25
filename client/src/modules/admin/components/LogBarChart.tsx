import { useState } from 'react';

export interface BarDatum {
	key: string;
	/** Nhãn trục X (ngắn) */
	label: string;
	/** Nhãn đầy đủ trong tooltip / bảng */
	fullLabel: string;
	value: number;
	/** Dòng phụ trong tooltip, vd "12 lỗi" */
	extra?: string;
}

interface LogBarChartProps {
	title: string;
	data: BarDatum[];
	unit: string;
	/** Chỉ hiện nhãn trục X mỗi N cột khi nhiều cột */
	labelEvery?: number;
}

function niceMax(n: number): number {
	if (n <= 5) return 5;
	const p = 10 ** Math.floor(Math.log10(n));
	const m = n / p;
	return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// Biểu đồ cột 1 chuỗi số liệu (1 màu thương hiệu) — cột mảnh, đầu bo 4px,
// lưới mờ, tooltip khi rê chuột/focus từng cột, kèm bảng số liệu thay thế.
export default function LogBarChart({ title, data, unit, labelEvery = 1 }: LogBarChartProps) {
	const [active, setActive] = useState<number | null>(null);
	const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
	const ticks = [max, max / 2, 0];
	const cur = active != null ? data[active] : null;

	return (
		<figure className='lg-chart'>
			<figcaption className='lg-chart-title'>{title}</figcaption>
			<div className='lg-chart-body'>
				<div
					className='lg-chart-yaxis'
					aria-hidden
				>
					{ticks.map((t) => (
						<span key={t}>{t.toLocaleString('vi-VN')}</span>
					))}
				</div>
				<div
					className='lg-chart-plot'
					onMouseLeave={() => setActive(null)}
				>
					{ticks.map((t) => (
						<div
							key={t}
							className='lg-chart-grid'
							style={{ bottom: `${(t / max) * 100}%` }}
						/>
					))}
					<div className='lg-chart-bars'>
						{data.map((d, i) => (
							<button
								type='button'
								key={d.key}
								className={`lg-bar-hit${active === i ? ' is-active' : ''}`}
								onMouseEnter={() => setActive(i)}
								onFocus={() => setActive(i)}
								onBlur={() => setActive(null)}
								aria-label={`${d.fullLabel}: ${d.value} ${unit}${d.extra ? `, ${d.extra}` : ''}`}
							>
								<span
									className='lg-bar'
									style={{ height: d.value ? `max(2px, ${(d.value / max) * 100}%)` : 0 }}
								/>
							</button>
						))}
					</div>
					{cur && active != null && (
						<div
							className='lg-tooltip'
							style={{
								left: `${((active + 0.5) / data.length) * 100}%`,
								transform: `translateX(${active / data.length > 0.7 ? '-100%' : active / data.length < 0.3 ? '0' : '-50%'})`,
							}}
						>
							<div className='lg-tooltip-title'>{cur.fullLabel}</div>
							<div>
								<strong>{cur.value.toLocaleString('vi-VN')}</strong> {unit}
							</div>
							{cur.extra && <div className='lg-tooltip-sub'>{cur.extra}</div>}
						</div>
					)}
				</div>
			</div>
			<div
				className='lg-chart-xaxis'
				aria-hidden
			>
				{data.map((d, i) => (
					<span key={d.key}>{i % labelEvery === 0 || i === data.length - 1 ? d.label : ''}</span>
				))}
			</div>
			<details className='lg-chart-table'>
				<summary>Xem dạng bảng</summary>
				<table>
					<tbody>
						{data.map((d) => (
							<tr key={d.key}>
								<td>{d.fullLabel}</td>
								<td>{d.value.toLocaleString('vi-VN')}</td>
								<td>{d.extra ?? ''}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</figure>
	);
}
