import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth phải dùng trong AuthProvider');
	return ctx;
}
