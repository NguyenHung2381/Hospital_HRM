import { useEffect, useState } from 'react';
import type { TT03Preview } from '@/utils/formulaHelperUtils';

export interface Tt03PreviewInput {
	cap1: number | null;
	cap2: number | null;
	cap3: number | null;
	nbKhamPT: number | null;
}

/** Tính preview TT03 + Khuyến nghị mỗi khi số NB thay đổi (debounce 400ms). */
export function useTt03Preview(deptId: number, input: Tt03PreviewInput) {
	const [tt03Preview, setTT03Preview] = useState<TT03Preview | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const { cap1, cap2, cap3, nbKhamPT } = input;

	useEffect(() => {
		if (!deptId) return;
		if (cap1 === null && cap2 === null && cap3 === null) {
			setTT03Preview(null);
			return;
		}

		const timer = setTimeout(async () => {
			setPreviewLoading(true);
			try {
				const res = await fetch('/api/tt03/calculate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id_department: deptId,
						patient_level_1: cap1 ?? 0,
						patient_level_2: cap2 ?? 0,
						patient_level_3: cap3 ?? 0,
						outpatient_cnt: nbKhamPT ?? 0,
					}),
				});
				if (res.ok) {
					const json = (await res.json()) as { data: TT03Preview };
					setTT03Preview(json.data);
				}
			} catch {
				// Ignore preview errors
			} finally {
				setPreviewLoading(false);
			}
		}, 400);

		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cap1, cap2, cap3, nbKhamPT, deptId]);

	return { tt03Preview, previewLoading };
}
