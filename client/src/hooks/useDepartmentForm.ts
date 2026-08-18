import { useState } from 'react';
import type { ApiDept } from '@/types/apiType';
import type { FormulaType, RecommendedFormulaType } from '@/types/commonType';
import type { DraftDept } from '@/types/staffingType';
import {
	DRAFT_DEFAULT,
	REC_DEFAULT,
	type DraftRec,
	type FormTab,
} from '@/modules/admin/pages/departmentPageConstants';

/** State + handlers cho modal thêm/sửa/xoá khoa (DepartmentPage). */
export function useDepartmentForm(refetchDepts: () => Promise<void>) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [modal, setModal] = useState<'add' | 'edit' | 'del' | null>(null);
	const [formTab, setFormTab] = useState<FormTab>('info');
	const [draft, setDraft] = useState<DraftDept>(DRAFT_DEFAULT);
	const [draftRec, setDraftRec] = useState<DraftRec>(REC_DEFAULT);
	const [target, setTarget] = useState<ApiDept | null>(null);

	const openAdd = () => {
		setDraft({ ...DRAFT_DEFAULT });
		setDraftRec({ ...REC_DEFAULT });
		setFormTab('info');
		setError('');
		setModal('add');
	};

	const openEdit = (k: ApiDept) => {
		setDraft({
			name: k.name_department,
			code_department: k.code_department ?? '',
			bed_count: k.bed_count,
			coef_level_1: k.coef_level_1,
			coef_level_2: k.coef_level_2,
			coef_level_3: k.coef_level_3,
			coef_total: k.coef_total,
			total_staff: k.total_staff,
			status: k.status,
			formula_type: (k.formula_type as FormulaType) ?? 'custom_coef',
			patient_ratio: k.patient_ratio ?? 0.6,
			shift_divisor: k.shift_divisor ?? 3,
			shift_multiplier: k.shift_multiplier ?? 2,
			fixed_add: k.fixed_add ?? 0,
			tt03_note: k.tt03_note ?? '',
		});
		setDraftRec({
			formula_type: (k.rec_formula_type as RecommendedFormulaType) ?? 'coef',
			coef_l1: k.rec_coef_l1 ?? 0.5,
			coef_l2: k.rec_coef_l2 ?? 0.104,
			coef_l3: k.rec_coef_l3 ?? 0.104,
			outpatient_ratio: k.rec_outpatient_ratio ?? null,
			fixed_add: k.rec_fixed_add ?? 0,
			note: k.rec_note ?? '',
		});
		setTarget(k);
		setFormTab('info');
		setError('');
		setModal('edit');
	};

	const openDel = (k: ApiDept) => {
		setTarget(k);
		setError('');
		setModal('del');
	};

	const save = async () => {
		if (!draft.name.trim()) {
			setError('Tên khoa không được để trống.');
			setFormTab('info');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const isAdd = modal === 'add';

			// ── 1. POST/PUT /api/departments ─────────────────────────
			// Chú ý: PUT chỉ nhận name, code_department, bed_count,
			// coef_*, total_staff, status theo API departments.js
			const deptBody: Record<string, unknown> = {
				name: draft.name,
				code_department: draft.code_department || null,
				bed_count: draft.bed_count,
				coef_level_1: draft.coef_level_1,
				coef_level_2: draft.coef_level_2,
				coef_level_3: draft.coef_level_3,
				coef_total: draft.coef_total,
				total_staff: draft.total_staff,
				status: draft.status,
			};

			// POST còn nhận formula_type + fixed_add để tạo TT03 config luôn
			if (isAdd) {
				deptBody.formula_type = draft.formula_type;
				deptBody.fixed_add = draft.fixed_add;
			}

			const deptRes = await fetch(
				isAdd
					? `/api/departments`
					: `/api/departments/${target!.id_department}`,
				{
					method: isAdd ? 'POST' : 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(deptBody),
				},
			);
			const deptData = (await deptRes.json()) as {
				success: boolean;
				message?: string;
				data?: { id_department: number };
			};
			if (!deptData.success) {
				setError(deptData.message ?? 'Lỗi khi lưu thông tin khoa.');
				return;
			}

			const deptId = isAdd
				? deptData.data?.id_department
				: target!.id_department;
			if (!deptId) {
				setError('Không xác định được ID khoa.');
				return;
			}

			// ── 2. PUT /api/tt03/config/:deptId ─────────────────────
			const tt03Res = await fetch(`/api/tt03/config/${deptId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					formula_type: draft.formula_type,
					patient_ratio: draft.patient_ratio,
					shift_divisor: draft.shift_divisor,
					shift_multiplier: draft.shift_multiplier,
					fixed_add: draft.fixed_add,
					note: draft.tt03_note || null,
				}),
			});
			if (!tt03Res.ok) {
				const tt03Data = (await tt03Res.json().catch(() => ({}))) as {
					message?: string;
				};
				setError(tt03Data.message ?? 'Lỗi khi lưu cấu hình TT03.');
				return;
			}

			// ── 3. POST/PUT /api/departments/:id/recommended-config ─
			// POST khi tạo mới, PUT khi cập nhật (khớp với API tách biệt POST/PUT)
			const recRes = await fetch(
				`/api/departments/${deptId}/recommended-config`,
				{
					method: isAdd ? 'POST' : 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						formula_type: draftRec.formula_type,
						coef_l1: draftRec.coef_l1,
						coef_l2: draftRec.coef_l2,
						coef_l3: draftRec.coef_l3,
						outpatient_ratio: draftRec.outpatient_ratio,
						fixed_add: draftRec.fixed_add,
						note: draftRec.note || null,
					}),
				},
			);
			if (!recRes.ok) {
				const recData = (await recRes.json().catch(() => ({}))) as {
					message?: string;
				};
				setError(recData.message ?? 'Lỗi khi lưu cấu hình khuyến nghị.');
				return;
			}

			await refetchDepts();
			setModal(null);
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	const del = async () => {
		if (!target) return;
		setSaving(true);
		setError('');
		try {
			const res = await fetch(`/api/departments/${target.id_department}`, {
				method: 'DELETE',
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi xoá.');
				return;
			}
			await refetchDepts();
			setModal(null);
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	const setField = <K extends keyof DraftDept>(key: K, val: DraftDept[K]) =>
		setDraft((p) => ({ ...p, [key]: val }));

	const setRecField = <K extends keyof DraftRec>(key: K, val: DraftRec[K]) =>
		setDraftRec((p) => ({ ...p, [key]: val }));

	return {
		saving,
		error,
		modal,
		setModal,
		formTab,
		setFormTab,
		draft,
		draftRec,
		target,
		openAdd,
		openEdit,
		openDel,
		save,
		del,
		setField,
		setRecField,
	};
}
