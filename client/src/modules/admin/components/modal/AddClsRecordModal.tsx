import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { ApiDept, ApiReport } from '@/types/apiType';
import { getClsFields } from '@/utils/clsFieldConfig';
import { useEffect, useMemo, useState } from 'react';
import FormField from '../FormField';

const chunk3 = <T,>(items: T[]): T[][] => {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
	return rows;
};

interface AddClsRecordModalProps {
	reportId: number;
	selDate: string;
	existingDeptIds: Set<number>;
	userId: number | null | undefined;
	onAdded: (updatedReport: ApiReport, newDeptId: number) => void;
	onClose: () => void;
}

type AddClsDraft = {
	id_department: number | null;
	sample_or_visit_cnt: number | null;
	xray_us_cnt: number | null;
	ct_endoscopy_cnt: number | null;
	mri_bonedensity_cnt: number | null;
	ecg_intervention_cnt: number | null;
	linen_media_cnt: number | null;
	tool_metal_cnt: number | null;
	tool_plastic_cnt: number | null;
	supervised_dept_cnt: number | null;
	pending_sample_or_visit_cnt: number | null;
	pending_xray_us_cnt: number | null;
	pending_ct_endoscopy_cnt: number | null;
	pending_mri_bonedensity_cnt: number | null;
	pending_ecg_intervention_cnt: number | null;
	pending_linen_cnt: number | null;
	pending_tool_metal_cnt: number | null;
	pending_tool_plastic_cnt: number | null;
	total_staff: number | null;
	staff_on_duty: number | null;
	staff_long_leave: number | null;
	note: string;
};

const BLANK_ADD_CLS_DRAFT: AddClsDraft = {
	id_department: null,
	sample_or_visit_cnt: null,
	xray_us_cnt: null,
	ct_endoscopy_cnt: null,
	mri_bonedensity_cnt: null,
	ecg_intervention_cnt: null,
	linen_media_cnt: null,
	tool_metal_cnt: null,
	tool_plastic_cnt: null,
	supervised_dept_cnt: null,
	pending_sample_or_visit_cnt: null,
	pending_xray_us_cnt: null,
	pending_ct_endoscopy_cnt: null,
	pending_mri_bonedensity_cnt: null,
	pending_ecg_intervention_cnt: null,
	pending_linen_cnt: null,
	pending_tool_metal_cnt: null,
	pending_tool_plastic_cnt: null,
	total_staff: null,
	staff_on_duty: null,
	staff_long_leave: null,
	note: '',
};

/**
 * Modal thêm 1 bản ghi khoa CLS vào báo cáo đã có (dùng ở admin DataPage).
 * Chỉ hiển thị các khoa hệ CLS chưa có trong báo cáo (lọc bởi existingDeptIds).
 */
export default function AddClsRecordModal({
	reportId,
	selDate,
	existingDeptIds,
	userId,
	onAdded,
	onClose,
}: AddClsRecordModalProps) {
	const [addDepts, setAddDepts] = useState<ApiDept[]>([]);
	const [draft, setDraft] = useState<AddClsDraft>({ ...BLANK_ADD_CLS_DRAFT });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		async function load() {
			try {
				const res = await fetch(`/api/departments?status=active&group=cls`);
				const data = (await res.json()) as { success: boolean; data: ApiDept[] };
				if (data.success)
					setAddDepts(
						data.data.filter((d) => !existingDeptIds.has(d.id_department)),
					);
			} catch {
				/* bỏ qua */
			}
		}
		load();
	}, [existingDeptIds]);

	const diLam =
		(draft.total_staff ?? 0) - (draft.staff_on_duty ?? 0) - (draft.staff_long_leave ?? 0);

	const selectedDept = addDepts.find((d) => d.id_department === draft.id_department);
	const clsFields = useMemo(
		() => getClsFields(selectedDept?.code_department),
		[selectedDept?.code_department],
	);

	const setField = <K extends keyof AddClsDraft>(key: K, val: AddClsDraft[K]) =>
		setDraft((p) => ({ ...p, [key]: val }));

	const handleSave = async () => {
		if (!draft.id_department) {
			setError('Vui lòng chọn khoa');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const { id_department, ...body } = draft;
			const res = await fetch(`/api/reports/${reportId}/cls-records`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id_department, ...body, created_by: userId ?? null }),
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi thêm');
				return;
			}
			const rRes = await fetch(`/api/reports/date/${selDate}`);
			const rData = (await rRes.json()) as { success: boolean; data: ApiReport };
			if (rData.success) onAdded(rData.data, id_department);
			onClose();
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<ModalForm
			title='＋ Thêm bản ghi khoa CLS'
			onClose={onClose}
			size='lg'
		>
			<div className='mform'>
				{error && <p className='login-error'>⚠️ {error}</p>}

				<FormField label='Chọn khoa *'>
					<select
						className='fi-input'
						value={draft.id_department ?? ''}
						onChange={(e) =>
							setField(
								'id_department',
								e.target.value === '' ? null : Number(e.target.value),
							)
						}
					>
						<option value=''>-- Chọn khoa --</option>
						{addDepts.map((d) => (
							<option
								key={d.id_department}
								value={d.id_department}
							>
								{d.name_department}
							</option>
						))}
					</select>
				</FormField>

				<div className='msec'>
					<p className='msec-title'>📊 Khối lượng công việc đã thực hiện</p>
					{chunk3(clsFields).map((row, i) => (
						<div
							key={i}
							className={row.length === 2 ? 'mrow2' : 'mrow3'}
						>
							{row.map((f) => (
								<NumberInput
									key={f.id}
									label={f.label}
									value={draft[f.apiDaLamKey as keyof AddClsDraft] as number | null}
									onChange={(v) => setField(f.apiDaLamKey as keyof AddClsDraft, v)}
								/>
							))}
						</div>
					))}
				</div>

				<div className='msec'>
					<p className='msec-title'>⏳ Số lượng tồn / chờ</p>
					{chunk3(clsFields.filter((f) => f.apiTonChoKey !== null)).map((row, i) => (
						<div
							key={i}
							className={row.length === 2 ? 'mrow2' : 'mrow3'}
						>
							{row.map((f) => (
								<NumberInput
									key={f.id}
									label={f.label}
									value={draft[f.apiTonChoKey as keyof AddClsDraft] as number | null}
									onChange={(v) => setField(f.apiTonChoKey as keyof AddClsDraft, v)}
								/>
							))}
						</div>
					))}
				</div>

				<div className='msec'>
					<p className='msec-title'>👩‍⚕️ Nhân lực</p>
					<div className='mrow3'>
						<NumberInput
							label='Tổng nhân lực'
							value={draft.total_staff}
							onChange={(v) => setField('total_staff', v)}
						/>
						<NumberInput
							label='Nghỉ trực'
							value={draft.staff_on_duty}
							onChange={(v) => setField('staff_on_duty', v)}
						/>
						<NumberInput
							label='Nghỉ ≥ 2 ngày'
							value={draft.staff_long_leave}
							onChange={(v) => setField('staff_long_leave', v)}
						/>
					</div>
					<div className='auto-preview'>
						<span>🔢 Đi làm =</span>
						<span className='auto-val'>{diLam} người</span>
					</div>
				</div>

				<FormField label='Ghi chú'>
					<textarea
						className='fi-input fi-ta'
						rows={2}
						value={draft.note}
						onChange={(e) => setField('note', e.target.value)}
					/>
				</FormField>

				<div className='mfooter'>
					<button
						className='btn-ghost'
						onClick={onClose}
						disabled={saving}
					>
						Huỷ
					</button>
					<button
						className='btn-primary'
						onClick={handleSave}
						disabled={saving}
					>
						{saving ? '⏳ Đang lưu...' : '💾 Thêm bản ghi'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
