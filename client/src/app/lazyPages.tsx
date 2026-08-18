import { lazy } from 'react';

export const AccountPage = lazy(() => import('@/modules/admin/pages/AccountPage'));
export const CoordinationPage = lazy(() => import('@/modules/admin/pages/CoordinationPage'));
export const DataPage = lazy(() => import('@/modules/admin/pages/DataPage'));
export const DepartmentPage = lazy(() => import('@/modules/admin/pages/DepartmentPage'));
export const PermissionPage = lazy(() => import('@/modules/admin/pages/PermissionPage'));
export const ReportPage = lazy(() => import('@/modules/admin/pages/ReportPage'));
export const DashboardPage = lazy(() => import('@/modules/admin/pages/DashboardPage'));
export const LoginPage = lazy(() => import('@/modules/auth/pages/LoginPage'));
export const HomePage = lazy(() => import('@/modules/home/pages/HomePage'));
