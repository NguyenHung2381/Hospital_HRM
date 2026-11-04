import { Stethoscope } from 'lucide-react';
import MiniBar from '@/components/ui/MiniBar';
import React from 'react';

export interface DashboardPatientStatsProps {
	totalCSC1: number;
	totalCSC2: number;
	totalCSC3: number;
	totalNBKham: number;
	totalNB: number;
}

export default function DashboardPatientStats({
	totalCSC1,
	totalCSC2,
	totalCSC3,
	totalNBKham,
	totalNB,
}: DashboardPatientStatsProps) {
	return (
		<section className='hcard ov-card'>
			<h3 className='hcard-title'>
				<Stethoscope size={16} /> Số người bệnh theo phân cấp
			</h3>
			<div className='ov-nb-grid'>
				{[
					{
						lbl: 'Cấp 1 (nặng)',
						val: totalCSC1,
						col: 'var(--color-error)',
						bg: 'var(--color-error-bg)',
					},
					{
						lbl: 'Cấp 2 (trung bình)',
						val: totalCSC2,
						col: 'var(--color-warning)',
						bg: 'var(--color-warning-bg)',
					},
					{
						lbl: 'Cấp 3 (nhẹ)',
						val: totalCSC3,
						col: 'var(--blue)',
						bg: 'var(--color-info-bg)',
					},
					{
						lbl: 'NB khám / PT KH',
						val: totalNBKham,
						col: 'var(--purple)',
						bg: 'var(--purple-l)',
					},
				].map((item) => (
					<div
						key={item.lbl}
						className='ov-nb-card'
						style={{ '--nc': item.col, '--nb': item.bg } as React.CSSProperties}
					>
						<span className='ov-nb-val'>{item.val}</span>
						<span className='ov-nb-lbl'>{item.lbl}</span>
						<div style={{ marginTop: 6, width: '100%' }}>
							<MiniBar
								val={item.val}
								max={totalNB}
								color={item.col}
							/>
							<span
								style={{
									fontSize: '.72rem',
									color: 'var(--color-gray-400)',
									marginTop: 2,
									display: 'block',
								}}
							>
								{totalNB > 0 ? Math.round((item.val / totalNB) * 100) : 0}% tổng
								NB
							</span>
						</div>
					</div>
				))}
			</div>
			<div className='ov-nb-total'>
				<span style={{ fontSize: '.78rem', color: 'var(--color-gray-500)', fontWeight: 600 }}>
					Tổng người bệnh
				</span>
				<span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--txt)' }}>
					{totalNB}
				</span>
			</div>
		</section>
	);
}
