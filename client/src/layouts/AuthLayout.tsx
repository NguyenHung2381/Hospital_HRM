import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import logo from '@/assets/images/logo.png';

interface AuthLayoutProps {
	children: ReactNode;
	title?: string;
	subtitle?: string;
}

const features = [
	'Quản lý hồ sơ Điều dưỡng, Hộ sinh, Kỹ thuật viên',
	'Theo dõi điều phối nhân lực giữa các khoa',
	'Báo cáo & thống kê nhân sự trực quan',
	'Phân quyền linh hoạt theo vai trò',
];

export default function AuthLayout({
	children,
	title = 'Bệnh viện Hữu Nghị\nĐa khoa Nghệ An',
	subtitle = 'Hệ thống quản lý nhân lực\nĐiều dưỡng – Hộ sinh – Kỹ thuật viên',
}: AuthLayoutProps) {
	return (
		<div className='auth-wrapper'>
			{/* Panel trái - Branding */}
			<div className='auth-panel-left'>
				<div className='auth-panel-content'>
					<div className='auth-panel-logo'>
						<img
							src={logo}
							alt='Logo Bệnh viện Hữu Nghị Đa Khoa Nghệ An'
						/>
					</div>

					<div>
						<h1 className='auth-panel-title'>
							{title.split('\n').map((line, i, arr) => (
								<span key={i}>
									{line}
									{i < arr.length - 1 && <br />}
								</span>
							))}
						</h1>
						<p className='auth-panel-subtitle'>
							{subtitle.split('\n').map((line, i, arr) => (
								<span key={i}>
									{line}
									{i < arr.length - 1 && <br />}
								</span>
							))}
						</p>
					</div>

					<ul className='auth-panel-features'>
						{features.map((f) => (
							<li
								key={f}
								className='auth-feature-item'
							>
								<span className='auth-feature-check'>
									<Check size={12} strokeWidth={3} />
								</span>
								{f}
							</li>
						))}
					</ul>

				</div>
			</div>

			{/* Panel phải - Nội dung (form) */}
			<div className='auth-panel-right'>

				<div className='auth-form-wrapper'>{children}</div>

				<div className='auth-footer'>
					© {new Date().getFullYear()} Bệnh viện Hữu Nghị Đa Khoa Nghệ An —
					Phòng CNTT
				</div>
			</div>
		</div>
	);
}
