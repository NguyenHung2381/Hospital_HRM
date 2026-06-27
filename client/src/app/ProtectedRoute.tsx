import { DASHBOARD_ROLES } from '@/context/AuthRoles';
import { useAuth } from '@/context/useAuth';
import { Navigate, Outlet } from 'react-router-dom';

interface Props {
	requireDashboard?: boolean;
}

// requireDashboard=true  → chỉ cho admin/giam_doc/dieu_duong_truong vào
// requireDashboard=false → tất cả role đã đăng nhập đều vào được (Trang-chu)
export default function ProtectedRoute({ requireDashboard = false }: Props) {
	const { user } = useAuth();

	// Chưa đăng nhập → bắt đăng nhập
	if (!user)
		return (
			<Navigate
				to='/'
				replace
			/>
		);

	// Vào dashboard nhưng không đủ quyền → về Trang-chu
	if (requireDashboard && !DASHBOARD_ROLES.includes(user.vaiTro)) {
		return (
			<Navigate
				to='/home'
				replace
			/>
		);
	}

	return <Outlet />;
}
