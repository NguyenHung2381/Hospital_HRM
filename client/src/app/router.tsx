import Loading from '@/components/common/Loading';
import DashboardLayout from '@/layouts/DashboardLayout';
import RouteErrorPage from '@/modules/errors/pages/RouteErrorPage';
import { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import {
	AccountPage,
	BadGatewayPage,
	CoordinationPage,
	DashboardPage,
	DataPage,
	DepartmentPage,
	HomePage,
	LoginPage,
	NotFoundPage,
	PermissionPage,
	ReportPage,
	ServiceUnavailablePage,
} from './lazyPages';
import ProtectedRoute from './ProtectedRoute';

const withSuspense = (element: React.ReactNode) => <Suspense fallback={<Loading />}>{element}</Suspense>;

export const router = createBrowserRouter([
	{
		path: '/',
		element: withSuspense(<LoginPage />),
		errorElement: <RouteErrorPage />,
		handle: { title: 'Đăng nhập' },
	},

	// Trang-chu: tất cả role đăng nhập được vào
	{
		element: <ProtectedRoute requireDashboard={false} />,
		errorElement: <RouteErrorPage />,
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
		errorElement: <RouteErrorPage />,
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

	// Trang lỗi hệ thống (502/503) — có thể điều hướng thủ công khi backend gặp sự cố
	{
		path: '/error/502',
		element: withSuspense(<BadGatewayPage />),
		handle: { title: 'Lỗi cổng kết nối' },
	},
	{
		path: '/error/503',
		element: withSuspense(<ServiceUnavailablePage />),
		handle: { title: 'Hệ thống đang bảo trì' },
	},

	// Catch-all: mọi đường dẫn không khớp
	{
		path: '*',
		element: withSuspense(<NotFoundPage />),
		handle: { title: 'Không tìm thấy trang' },
	},
]);
