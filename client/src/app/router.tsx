import DashboardLayout from '@/layouts/DashboardLayout';
import { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import {
	AccountPage,
	CoordinationPage,
	DashboardPage,
	DataPage,
	DepartmentPage,
	HomePage,
	LoginPage,
	PermissionPage,
	ReportPage,
} from './lazyPages';
import ProtectedRoute from './ProtectedRoute';

const withSuspense = (element: React.ReactNode) => (
	<Suspense
		fallback={
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
				Đang tải...
			</div>
		}
	>
		{element}
	</Suspense>
);

export const router = createBrowserRouter([
	{
		path: '/',
		element: withSuspense(<LoginPage />),
		handle: { title: 'Đăng nhập' },
	},

	// Trang-chu: tất cả role đăng nhập được vào
	{
		element: <ProtectedRoute requireDashboard={false} />,
		children: [
			{
				path: '/home',
				element: withSuspense(<HomePage />),
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
					{ index: true, element: withSuspense(<DashboardPage />) },
					{ path: 'accounts', element: withSuspense(<AccountPage />) },
					{ path: 'permissions', element: withSuspense(<PermissionPage />) },
					{ path: 'departments', element: withSuspense(<DepartmentPage />) },
					{ path: 'reports', element: withSuspense(<ReportPage />) },
					{ path: 'data', element: withSuspense(<DataPage />) },
					{ path: 'coordination', element: withSuspense(<CoordinationPage />) },
				],
			},
		],
	},
]);
