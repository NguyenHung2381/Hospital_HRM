import logo from '@/assets/images/logo.png';
import ArrowIcon from '@/assets/svg/AngleArrowIcon';
import EditIcon from '@/assets/svg/EditIcon';
import KeyIcon from '@/assets/svg/KeyIcon';
import LogoutIcon from '@/assets/svg/LogoutIcon';
import UserIcon from '@/assets/svg/UserIcon';
import { useAuth } from '@/context/useAuth';
import type { MainLayoutProps } from '@/types/homeType';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── MainLayout ────────────────────────────────────────────
export default function MainLayout({
	hospitalName = 'Bệnh viện Hữu Nghị Đa Khoa Nghệ An',
	deptName = '',
	giuongMay = null,
	currentUser: currentUserProp,
	onEditDept,
	// onReport,
	onChangePassword,
	children,
}: MainLayoutProps) {
	const { logout, user } = useAuth();
	// refresh();

	const currentUser = user! ?? currentUserProp;
	const navigate = useNavigate();
	const [userMenuOpen, setUserMenuOpen] = useState(false);

	const handleLogout = () => {
		setUserMenuOpen(false);
		logout();
		navigate('/', { replace: true });
	};

	const handleEditDept = () => {
		setUserMenuOpen(false);
		onEditDept?.();
	};

	// const handleReport = () => {
	// 	setUserMenuOpen(false);
	// 	onReport?.();
	// };

	const handleChangePassword = () => {
		setUserMenuOpen(false);
		onChangePassword?.();
	};

	return (
		<div className='page'>
			{/* ── Topbar ── */}
			<header className='topbar'>
				<div className='topbar-l'>
					<img
						src={logo}
						alt='Logo'
						className='logo'
					/>
					<div className='topbar-info'>
						<p className='topbar-hospital'>
							<span className='topbar-hospital-desktop'>{hospitalName}</span>
							<span className='topbar-hospital-mobile'>BV Hữu Nghị Đa Khoa Nghệ An</span>
						</p>
						<h1 className='topbar-dept'>Khoa {deptName}</h1>
						<p className='topbar-sub'>
							<span className='topbar-sub-desktop'>Theo dõi nhân lực ĐD - Hộ sinh - KTV</span>
							<span className='topbar-sub-mobile'>Theo dõi nhân lực ĐD-HS-KTV</span>
						</p>
					</div>
				</div>

				<div className='topbar-r'>
					{giuongMay != null && (
						<div className='meta-chip'>🛏️ {giuongMay} giường/máy</div>
					)}

					{/* User menu */}
					<div className='user-menu-wrap'>
						<button
							className='user-btn'
							onClick={() => setUserMenuOpen((o) => !o)}
						>
							<div className='user-avatar'>
								<UserIcon size={18} />
							</div>
							<div className='user-info'>
								<span className='user-name'>{currentUser.hoTen}</span>
								<span className='user-role'>{currentUser.chucVu}</span>
							</div>
							<ArrowIcon
								size={13}
								className={`user-chevron ${userMenuOpen ? 'user-chevron-open' : ''}`}
							/>
						</button>

						{userMenuOpen && (
							<div className='user-dropdown'>
								<div className='user-dropdown-header'>
									<div className='user-dd-avatar'>
										<UserIcon size={22} />
									</div>
									<div>
										<p className='user-dd-name'>{currentUser.hoTen}</p>
										<p className='user-dd-role'>
											{currentUser.chucVu} · {currentUser.khoa}
										</p>
									</div>
								</div>

								<div className='user-dd-divider' />

								<button
									className='user-dd-item'
									onClick={handleEditDept}
								>
									<EditIcon size={15} />
									Sửa thông tin khoa
								</button>

								{/* <button
									className='user-dd-item'
									onClick={handleReport}
								>
									<ReportIcon size={15} />
									Báo cáo dữ liệu
								</button> */}

								<button
									className='user-dd-item'
									onClick={handleChangePassword}
								>
									<KeyIcon size={15} />
									Đổi mật khẩu
								</button>

								<div className='user-dd-divider' />

								<button
									className='user-dd-item user-dd-logout'
									onClick={handleLogout}
								>
									<LogoutIcon
										size={15}
										color='red'
									/>
									Đăng xuất
								</button>
							</div>
						)}
					</div>
				</div>
			</header>

			{/* ── Page Body ── */}
			<div className='main-layout'>{children}</div>
		</div>
	);
}
