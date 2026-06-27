import AuthLayout from '@/layouts/AuthLayout';
import { DASHBOARD_ROLES } from '@/context/AuthRoles';
import { useAuth } from '@/context/useAuth';
import { Navigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
	const { user } = useAuth();

	if (user) {
		const to = DASHBOARD_ROLES.includes(user.vaiTro) ? '/dashboard' : '/home';
		return (
			<Navigate
				to={to}
				replace
			/>
		);
	}

	return (
		<AuthLayout>
			<LoginForm />
		</AuthLayout>
	);
}
