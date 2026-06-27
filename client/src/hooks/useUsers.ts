import { useAppSSE } from '@/hooks/useAppSSE';
import type { ApiUser } from '@/types/apiType';
import { useCallback, useEffect, useState } from 'react';

export default function useUsers() {
	const [users, setUsers] = useState<ApiUser[]>([]);
	const [loadingUsers, setLoadingUsers] = useState(true);
	const [errorUsers, setErrorUsers] = useState('');

	const fetchUsers = useCallback(async () => {
		setLoadingUsers(true);
		setErrorUsers('');
		try {
			const res = await fetch('/api/users');
			const data = (await res.json()) as { success: boolean; data: ApiUser[] };
			if (data.success) {
				setUsers(data.data);
			} else {
				setErrorUsers('Lỗi tải danh sách tài khoản.');
			}
		} catch {
			setErrorUsers('Lỗi kết nối server khi tải tài khoản.');
		} finally {
			setLoadingUsers(false);
		}
	}, []);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	// Tự cập nhật khi users thay đổi trên server
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'users') {
					fetchUsers();
				}
			},
			[fetchUsers],
		),
	);

	return {
		users,
		loadingUsers,
		errorUsers,
		refetchUsers: fetchUsers,
		setUsers,
	};
}
