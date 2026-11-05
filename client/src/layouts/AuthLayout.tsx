import { CalendarCheck2, ChartColumn, ShieldCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import logo from '@/assets/images/logo.png';

interface AuthLayoutProps {
	children: ReactNode;
	title?: string;
	subtitle?: string;
}

const features = [
	{ Icon: Users, text: 'Quản lý hồ sơ Điều dưỡng, Hộ sinh, Kỹ thuật viên' },
	{ Icon: CalendarCheck2, text: 'Theo dõi điều phối nhân lực giữa các khoa' },
	{ Icon: ChartColumn, text: 'Báo cáo & thống kê nhân sự trực quan' },
	{ Icon: ShieldCheck, text: 'Phân quyền linh hoạt theo vai trò' },
];

const lines = (text: string) =>
	text.split('\n').map((line, i, arr) => (
		<span key={i}>
			{line}
			{/* Khoảng trắng trước <br>: khi màn hẹp ẩn <br>, hai dòng không dính nhau */}
			{i < arr.length - 1 && (
				<>
					{' '}
					<br />
				</>
			)}
		</span>
	));

export default function AuthLayout({
	children,
	title = 'Bệnh viện\nHữu Nghị Đa khoa Nghệ An',
	subtitle = 'Hệ thống quản lý nhân lực\nĐiều dưỡng – Hộ sinh – Kỹ thuật viên',
}: AuthLayoutProps) {
	return (
		<div className='auth-wrapper'>
			{/* Panel trái - Branding */}
			<div className='auth-panel-left'>
				{/* Nền trang trí: quầng sáng trôi chậm, lưới chấm, đường nhịp tim */}
				<div
					className='auth-bg'
					aria-hidden='true'
				>
					<span className='auth-glow auth-glow--a' />
					<span className='auth-glow auth-glow--b' />
					<span className='auth-dots' />
					<svg
						className='auth-ecg'
						viewBox='0 0 600 120'
						preserveAspectRatio='none'
					>
						<path
							className='auth-ecg-base'
							pathLength={1000}
							d='M0 60 H170 L185 60 L195 40 L205 60 L220 60 L232 92 L248 14 L262 104 L274 60 L300 60 L312 50 L324 60 H600'
						/>
						<path
							className='auth-ecg-pulse'
							pathLength={1000}
							d='M0 60 H170 L185 60 L195 40 L205 60 L220 60 L232 92 L248 14 L262 104 L274 60 L300 60 L312 50 L324 60 H600'
						/>
					</svg>
				</div>

				<div className='auth-panel-content'>
					<div className='auth-panel-logo auth-enter'>
						<img
							src={logo}
							alt='Logo Bệnh viện Hữu Nghị Đa Khoa Nghệ An'
						/>
					</div>

					<div className='auth-panel-hero'>
						<p className='auth-panel-chip auth-enter'>
							<span className='auth-live-dot' />
							Hệ thống quản lý nhân lực
						</p>
						<h1 className='auth-panel-title auth-enter'>{lines(title)}</h1>
						<p className='auth-panel-subtitle auth-enter'>{lines(subtitle)}</p>
					</div>

					<ul className='auth-panel-features'>
						{features.map(({ Icon, text }) => (
							<li
								key={text}
								className='auth-feature-item auth-enter'
							>
								<span className='auth-feature-check'>
									<Icon
										size={16}
										strokeWidth={1.75}
									/>
								</span>
								{text}
							</li>
						))}
					</ul>
				</div>
			</div>

			{/* Panel phải - Nội dung (form) */}
			<div className='auth-panel-right'>
				<div className='auth-form-wrapper'>{children}</div>

				<div className='auth-footer'>
					© {new Date().getFullYear()} Bệnh viện Hữu Nghị Đa Khoa Nghệ An — Phòng CNTT
				</div>
			</div>
		</div>
	);
}
