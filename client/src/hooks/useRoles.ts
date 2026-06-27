import { useAppSSE } from '@/hooks/useAppSSE';
import type { ApiRole } from '@/types/apiType';
import { useCallback, useEffect, useState } from 'react';

export default function useRoles() {
	const [roles, setRoles] = useState<ApiRole[]>([]);
	const [loadingRoles, setLoadingRoles] = useState(true);
	const [errorRoles, setErrorRoles] = useState('');

	const fetchRoles = useCallback(async () => {
		setLoadingRoles(true);
		setErrorRoles('');
		try {
			const res = await fetch('/api/roles');
			const data = (await res.json()) as { success: boolean; data: ApiRole[] };
			if (data.success) {
				setRoles(data.data);
			} else {
				setErrorRoles('Lỗi tải danh sách vai trò.');
			}
		} catch {
			setErrorRoles('Lỗi kết nối server khi tải vai trò.');
		} finally {
			setLoadingRoles(false);
		}
	}, []);

	useEffect(() => {
		fetchRoles();
	}, [fetchRoles]);

	// Tự cập nhật khi roles thay đổi trên server
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'roles') {
					fetchRoles();
				}
			},
			[fetchRoles],
		),
	);

	return {
		roles,
		loadingRoles,
		errorRoles,
		refetchRoles: fetchRoles,
		setRoles,
	};
}
