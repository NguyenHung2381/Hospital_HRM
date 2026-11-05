import {
	BedDouble,
	Building2,
	CircleCheck,
	TriangleAlert,
	UserCheck,
	type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateToVN } from '@/utils/dateUtils';

export interface DashboardBriefingProps {
	selDateStr: string; // YYYY-MM-DD
	isToday: boolean;
	khoaCount: number;
	totalNB: number;
	totalNBKham: number;
	totalNL: number;
	totalDiLam: number;
	khoaThieuCount: number;
	tongThieu: number;
}

interface Kpi {
	key: string;
	Icon: LucideIcon;
	value: number;
	of?: number; // "trên tổng" — hiện nhỏ sau số chính
	label: string;
	sub: string;
	tone?: 'warn' | 'ok';
	progress?: number; // 0–100, thanh mảnh dưới số
}

/** Đầu trang Tổng quan: ngày báo cáo + kết luận TT03, rồi 4 chỉ số chính đặt cạnh nhau. */
export default function DashboardBriefing({
	selDateStr,
	isToday,
	khoaCount,
	totalNB,
	totalNBKham,
	totalNL,
	totalDiLam,
	khoaThieuCount,
	tongThieu,
}: DashboardBriefingProps) {
	const ok = khoaThieuCount === 0;
	const rate = totalNL > 0 ? Math.round((totalDiLam / totalNL) * 100) : 0;

	const kpis: Kpi[] = [
		{
			key: 'khoa',
			Icon: Building2,
			value: khoaCount,
			label: 'Khoa đã báo cáo',
			sub: 'Khối nội trú',
		},
		{
			key: 'nb',
			Icon: BedDouble,
			value: totalNB,
			label: 'Người bệnh nội trú',
			sub:
				totalNBKham > 0
					? `Thêm ${totalNBKham} khám/PT kế hoạch`
					: 'Không có khám/PT kế hoạch',
		},
		{
			key: 'nl',
			Icon: UserCheck,
			value: totalDiLam,
			of: totalNL,
			label: 'Nhân lực đi làm',
			sub: `Tỉ lệ đi làm ${rate}%`,
			progress: rate,
		},
		{
			key: 'thieu',
			Icon: ok ? CircleCheck : TriangleAlert,
			value: khoaThieuCount,
			label: 'Khoa thiếu nhân lực',
			sub: ok ? 'Đủ theo TT03' : `Cần bổ sung ${tongThieu} người`,
			tone: ok ? 'ok' : 'warn',
		},
	];

	return (
		<section className='ov-hero'>
			<header className='ov-hero-head'>
				<p className='ov-hero-when'>
					{isToday && <span className='ov-hero-today'>Hôm nay</span>}
					Báo cáo ngày <b>{formatDateToVN(selDateStr)}</b>
				</p>

				<div className={`ov-status ${ok ? 'ov-status-ok' : 'ov-status-warn'}`}>
					{ok ? <CircleCheck size={16} /> : <TriangleAlert size={16} />}
					<span>
						{ok
							? 'Tất cả khoa đủ nhân lực theo TT03'
							: `${khoaThieuCount} khoa thiếu, cần bổ sung ${tongThieu} người`}
					</span>
					{!ok && (
						<Link
							to='/dashboard/coordination'
							className='ov-status-link'
						>
							Điều phối
						</Link>
					)}
				</div>
			</header>

			<dl className='ov-hero-kpis'>
				{kpis.map(({ key, Icon, value, of, label, sub, tone, progress }) => (
					<div
						key={key}
						className={`ov-hk${tone ? ` ov-hk-${tone}` : ''}`}
					>
						<dt className='ov-hk-label'>
							<span className='ov-hk-icon'>
								<Icon size={16} />
							</span>
							{label}
						</dt>
						<dd className='ov-hk-value'>
							{value}
							{of !== undefined && <span className='ov-hk-of'>/ {of}</span>}
						</dd>
						{progress !== undefined && (
							<dd
								className='ov-hk-progress'
								role='img'
								aria-label={`${progress}%`}
							>
								<span style={{ width: `${Math.min(100, progress)}%` }} />
							</dd>
						)}
						<dd className='ov-hk-sub'>{sub}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
