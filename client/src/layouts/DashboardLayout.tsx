//STYLE
import '@/styles/dashboard.css';

import { useAuth } from '@/context/useAuth';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

// ASSETS
import LOGO from '@/assets/images/logo.png';
import AccountIcon from '@/assets/svg/AccountIcon';
import EditIcon from '@/assets/svg/EditIcon';
import GuardIcon from '@/assets/svg/GuardIcon';
import HomeIcon from '@/assets/svg/HomeIcon';
import LogoutIcon from '@/assets/svg/LogoutIcon';
import ReportIcon from '@/assets/svg/ReportIcon';
import TableIcon from '@/assets/svg/TableIcon';
import ValiIcon from '@/assets/svg/ValiIcon';
import MenuIcon from '@/assets/svg/MenuIcon';

// ── Nav groups ────────────────────────────────────────────
const NAV_GROUPS = [
	{
		label: 'Tổng quan',
		items: [
			{ path: '/dashboard', label: 'Tổng quan', icon: <HomeIcon size={18} /> },
		],
	},
	{
		label: 'Dữ liệu',
		items: [
			{
				path: '/dashboard/data',
				label: 'Thống kê chi tiết',
				icon: <TableIcon size={18} />,
			},
			{
				path: '/dashboard/reports',
				label: 'Báo cáo',
				icon: <ReportIcon size={18} />,
			},
		],
	},
	{
		label: 'Quản trị',
		items: [
			{
				path: '/dashboard/accounts',
				label: 'Tài khoản',
				icon: <AccountIcon size={18} />,
			},
			{
				path: '/dashboard/permissions',
				label: 'Phân quyền',
				icon: <GuardIcon size={18} />,
			},
			{
				path: '/dashboard/departments',
				label: 'Khoa / Phòng',
				icon: <ValiIcon size={18} />,
			},
		],
	},
];

export default function DashboardLayout() {
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(() => {
		const saved = localStorage.getItem('dashboard-sidebar-collapsed');
		if (saved !== null) {
			return saved === 'true';
		}
		return window.innerWidth < 768;
	});
	const navigate = useNavigate();
	const { logout, user } = useAuth();

	useEffect(() => {
		localStorage.setItem('dashboard-sidebar-collapsed', String(collapsed));
	}, [collapsed]);

	const ROLE_LABEL: Record<string, string> = {
		admin: 'Quản trị viên',
		giam_doc: 'Giám đốc',
		dieu_duong_truong: 'Điều dưỡng trưởng BV',
		ddt_khoa: 'Điều dưỡng trưởng khoa',
		nhan_vien: 'Nhân viên',
	};
	const avatarLetter = user?.hoTen?.charAt(0).toUpperCase() ?? '?';
	const displayName = user?.hoTen ?? '---';
	const displayRole = user?.vaiTro ? (ROLE_LABEL[user.vaiTro] ?? '') : '';
	const displayBadge = user?.chucVu || displayRole;

	const handleLogout = () => {
		setUserMenuOpen(false);
		logout();
		navigate('/', { replace: true });
	};

	return (
		<div className={`app${collapsed ? ' nav-collapsed' : ''}`}>
			{/* ── Mobile Nav Overlay ── */}
			{!collapsed && (
				<div
					className='mobile-nav-overlay'
					onClick={() => setCollapsed(true)}
				/>
			)}

			{/* ── Sidebar ── */}
			<aside className='nav'>
				<div className='nav-logo'>
					<img
						src={LOGO}
						alt='Logo'
						className='nav-logo-img'
					/>
					<div className='nav-logo-text' style={{ flex: 1 }}>
						<p className='nav-logo-name'>BVHN Đa Khoa</p>
						<p className='nav-logo-sub'>Nghệ An</p>
					</div>
					<button
						className='mobile-nav-close'
						onClick={() => setCollapsed(true)}
						title='Đóng menu'
					>
						✕
					</button>
				</div>

				<nav className='nav-list'>
					{NAV_GROUPS.map((group) => (
						<div
							key={group.label}
							className='nav-group'
						>
							<div className='nav-section-label'>{group.label}</div>
							{group.items.map((n) => (
								<NavLink
									key={n.path}
									to={n.path}
									end={n.path === '/dashboard'}
									className={({ isActive }) =>
										`nav-item${isActive ? ' nav-item-active' : ''}`
									}
									title={n.label}
								>
									{({ isActive }) => (
										<>
											<span className='nav-icon'>{n.icon}</span>
											<span className='nav-label'>{n.label}</span>
											{isActive && <span className='nav-indicator' />}
										</>
									)}
								</NavLink>
							))}
						</div>
					))}
				</nav>

				{/* User footer */}
				<div className='nav-footer'>
					<div
						className='nav-user'
						onClick={() => setUserMenuOpen((o) => !o)}
					>
						<div className='nav-user-av'>{avatarLetter}</div>
						<div className='nav-user-info'>
							<p className='nav-user-name'>{displayName}</p>
							<p className='nav-user-role'>
								{displayName === displayRole ? `@${user?.taiKhoan}` : displayRole}
							</p>
						</div>
						<svg
							width='13'
							height='13'
							viewBox='0 0 24 24'
							fill='none'
							stroke='white'
							strokeWidth='2.5'
							strokeLinecap='round'
							strokeLinejoin='round'
							style={{
								opacity: 0.7,
								flexShrink: 0,
								transform: userMenuOpen ? 'rotate(180deg)' : 'none',
								transition: 'transform 0.2s ease',
							}}
						>
							<polyline points='6 9 12 15 18 9' />
						</svg>
					</div>

					{userMenuOpen && (
						<div className='nav-user-dd'>
							<button
								className='nav-user-dd-item'
								onClick={() => setUserMenuOpen(false)}
							>
								<EditIcon size={14} />
								Đổi mật khẩu
							</button>
							<div
								style={{ height: 1, background: 'var(--bdr)', margin: '3px 0' }}
							/>
							<button
								className='nav-user-dd-item nav-user-dd-danger'
								onClick={handleLogout}
							>
								<LogoutIcon
									size={14}
									color={'red'}
								/>
								Đăng xuất
							</button>
						</div>
					)}
				</div>
			</aside>

			{/* ── Main ── */}
			<main className='main'>
				<header className='topbar'>
					<div className='topbar-l'>
						{/* Nút hamburger trong topbar – luôn hiển thị */}
						<button
							className='topbar-toggle-btn'
							onClick={() => setCollapsed((c) => !c)}
							title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
						>
							<MenuIcon size={20} />
						</button>
						<div>
							<p className='topbar-hospital'>
								<span className='topbar-hospital-desktop'>Bệnh viện Hữu Nghị Đa Khoa Nghệ An</span>
								<span className='topbar-hospital-mobile'>BV Hữu Nghị Đa Khoa Nghệ An</span>
							</p>
							<h1 className='topbar-title'>
								<span className='topbar-title-desktop'>Hệ thống quản lý nhân lực ĐD – HS – KTV</span>
								<span className='topbar-title-mobile'>QL Nhân Lực ĐD - HS - KTV</span>
							</h1>
						</div>
					</div>
					<div className='topbar-r'>
						<div className='topbar-badge'>{displayBadge}</div>
					</div>
				</header>

				<div className='main-inner'>
					<Outlet />
				</div>
			</main>
		</div>
	);
}
