import { useAppSSE } from '@/hooks/useAppSSE';
import type { ApiDept } from '@/types/apiType';
import type { KhoaItem } from '@/types/staffingType';
import { useCallback, useEffect, useState } from 'react';

// Map ApiDept → KhoaItem
function deptToKhoaItem(d: ApiDept): KhoaItem {
	return {
		id: d.id_department,
		ten: d.name_department,
		giuong: d.bed_count,
		formulaType: d.formula_type ?? 'custom_coef',
		heSo: {
			cap1: d.coef_level_1,
			cap2: d.coef_level_2,
			cap3: d.coef_level_3,
			tong: d.coef_total,
			patientRatio: d.patient_ratio ?? 0.6,
			shiftDivisor: d.shift_divisor ?? 3,
			shiftMultiplier: d.shift_multiplier ?? 2,
			fixedAdd: d.fixed_add ?? 0,
		},
	};
}

export default function useDepartments(status?: 'active' | 'inactive') {
	const [depts, setDepts] = useState<ApiDept[]>([]);
	const [khoaItems, setKhoaItems] = useState<KhoaItem[]>([]);
	const [loadingDepts, setLoadingDepts] = useState(true);
	const [errorDepts, setErrorDepts] = useState('');

	const fetchDepts = useCallback(async () => {
		setLoadingDepts(true);
		setErrorDepts('');
		try {
			const url = status
				? `/api/departments?status=${status}`
				: '/api/departments';
			const res = await fetch(url);
			const data = (await res.json()) as { success: boolean; data: ApiDept[] };

			if (data.success) {
				setDepts(data.data);
				setKhoaItems(data.data.map(deptToKhoaItem));
			} else {
				setErrorDepts('Lỗi tải danh sách khoa phòng.');
			}
		} catch {
			setErrorDepts('Lỗi kết nối server khi tải khoa phòng.');
		} finally {
			setLoadingDepts(false);
		}
	}, [status]);

	useEffect(() => {
		fetchDepts();
	}, [fetchDepts]);

	// ── Realtime: tự cập nhật khi dept thay đổi trên server ─────────────
	useAppSSE(
		useCallback(
			(payload) => {
				if (payload.resource === 'departments') {
					fetchDepts();
				}
			},
			[fetchDepts],
		),
	);

	return {
		depts,
		khoaItems,
		loadingDepts,
		errorDepts,
		refetchDepts: fetchDepts,
		setDepts,
	};
}
