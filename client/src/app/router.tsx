import DashboardLayout from '@/layouts/DashboardLayout';
import AccountPage from '@/modules/admin/pages/AccountPage';
import DataPage from '@/modules/admin/pages/DataPage';
import DepartmentPage from '@/modules/admin/pages/DepartmentPage';
import PermissionPage from '@/modules/admin/pages/PermissionPage';
import ReportPage from '@/modules/admin/pages/ReportPage';
import LoginPage from '@/modules/auth/pages/LoginPage';
import HomePage from '@/modules/home/pages/HomePage';
import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import DashboardPage from '@/modules/admin/pages/DashboardPage';

export const router = createBrowserRouter([
	{
		path: '/',
		element: <LoginPage />,
		handle: { title: 'Đăng nhập' },
	},

	// Trang-chu: tất cả role đăng nhập được vào
	{
		element: <ProtectedRoute requireDashboard={false} />,
		children: [
			{
				path: '/home',
				element: <HomePage />,
				handle: { title: 'Trang chủ' },
			},
		],
	},

	// Dashboard: chỉ admin / giam_doc / dieu_duong_truong
	{
		element: <ProtectedRoute requireDashboard={true} />,
		children: [
			{
				path: '/dashboard',
				element: <DashboardLayout />,
				children: [
					{ index: true, element: <DashboardPage /> },
					{ path: 'accounts', element: <AccountPage /> },
					{ path: 'permissions', element: <PermissionPage /> },
					{ path: 'departments', element: <DepartmentPage /> },
					{ path: 'reports', element: <ReportPage /> },
					{ path: 'data', element: <DataPage /> },
				],
			},
		],
	},
]);
