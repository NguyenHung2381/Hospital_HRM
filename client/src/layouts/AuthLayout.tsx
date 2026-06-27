import type { ReactNode } from 'react';
import logo from '@/assets/images/logo.png';

interface AuthLayoutProps {
	children: ReactNode;
	title?: string;
	subtitle?: string;
}

export default function AuthLayout({
	children,
	title = 'Bệnh viện Hữu Nghị\nĐa Khoa Nghệ An',
	subtitle = 'Hệ thống quản lý nhân sự\nĐiều dưỡng, Hộ Sinh, Kỹ thuật viên',
}: AuthLayoutProps) {
	return (
		<div className='auth-root'>
			{/* Background decorations */}
			<div className='bg-blob bg-blob-1' />
			<div className='bg-blob bg-blob-2' />
			<div className='bg-blob bg-blob-3' />

			<div className='auth-card'>
				{/* Left Panel — Hospital Info */}
				<div className='auth-left'>
					<div className='auth-left-inner'>
						<div className='logo-wrapper'>
							<img
								src={logo}
								alt='Logo Bệnh viện'
								className='logo-img'
							/>
							<div className='logo-ring' />
						</div>

						<div className='hospital-info'>
							{title.split('\n').map((line, i) => (
								<span
									key={i}
									className={
										i === 0 ? 'hospital-name-main' : 'hospital-name-sub'
									}
								>
									{line}
								</span>
							))}
						</div>

						<div className='divider' />

						<p className='hospital-subtitle'>
							{subtitle.split('\n').map((line, i) => (
								<span key={i}>
									{line}
									{i < subtitle.split('\n').length - 1 && <br />}
								</span>
							))}
						</p>

						<div className='feature-list'>
							{[
								{ icon: '❤️', text: 'Chăm sóc bệnh nhân tận tâm' },
								{ icon: '🩺', text: 'Đội ngũ y bác sĩ chuyên nghiệp' },
								{ icon: '🏨', text: 'Cơ sở vật chất hiện đại, đạt chuẩn' },
							].map((f, i) => (
								<div
									key={i}
									className='feature-item'
									style={{ animationDelay: `${i * 0.15}s` }}
								>
									<span className='feature-icon'>{f.icon}</span>
									<span className='feature-text'>{f.text}</span>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Right Panel — Login Form */}
				<div className='auth-right'>{children}</div>
			</div>
		</div>
	);
}
