import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { ApiDept, ApiReport } from '@/types/apiType';
import { useEffect, useState } from 'react';
import FormField from '../FormField';

interface AddRecordModalProps {
	reportId: number;
	selDate: string;
	existingDeptIds: Set<number>;
	userId: number | null | undefined;
	onAdded: (updatedReport: ApiReport, newDeptId: number) => void;
	onClose: () => void;
}

type AddDraft = {
	id_department: number | null;
	patient_level_1: number | null;
	patient_level_2: number | null;
	patient_level_3: number | null;
	outpatient_cnt: number | null;
	total_staff: number | null;
	staff_on_duty: number | null;
	staff_long_leave: number | null;
	note: string;
};

const BLANK_ADD_DRAFT: AddDraft = {
	id_department: null,
	patient_level_1: null,
	patient_level_2: null,
	patient_level_3: null,
	outpatient_cnt: null,
	total_staff: null,
	staff_on_duty: null,
	staff_long_leave: null,
	note: '',
};

/**
 * Modal thêm 1 bản ghi khoa vào báo cáo đã có.
 * Chỉ hiển thị các khoa chưa có trong báo cáo (lọc bởi existingDeptIds).
 * Sau khi POST thành công, refetch báo cáo và trả qua onAdded (kèm id khoa
 * vừa thêm để DataPage cấp localPerms đầy đủ cho khoa đó).
 */
export default function AddRecordModal({
	reportId,
	selDate,
	existingDeptIds,
	userId,
	onAdded,
	onClose,
}: AddRecordModalProps) {
	const [addDepts, setAddDepts] = useState<ApiDept[]>([]);
	const [draft, setDraft] = useState<AddDraft>({
		...BLANK_ADD_DRAFT,
		id_department: null,
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	// Fetch danh sách khoa chưa có trong báo cáo
	useEffect(() => {
		async function load() {
			try {
<<<<<<< HEAD
				const res = await fetch(`/api/departments?status=active`);
=======
				const res = await fetch(`/api/departments?status=active&group=ward`);
>>>>>>> df09166 (feat: implement user management API with CRUD operations)
				const data = (await res.json()) as {
					success: boolean;
					data: ApiDept[];
				};
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
		(draft.total_staff ?? 0) -
		(draft.staff_on_duty ?? 0) -
		(draft.staff_long_leave ?? 0);

	const handleSave = async () => {
		if (!draft.id_department) {
			setError('Vui lòng chọn khoa');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const res = await fetch(`/api/reports/${reportId}/records`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...draft, created_by: userId ?? null }),
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi thêm');
				return;
			}
			const rRes = await fetch(`/api/reports/date/${selDate}`);
			const rData = (await rRes.json()) as {
				success: boolean;
				data: ApiReport;
			};
			if (rData.success) onAdded(rData.data, draft.id_department);
			onClose();
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<ModalForm
			title='＋ Thêm bản ghi khoa'
			onClose={onClose}
			size='md'
		>
			<div className='mform'>
				{error && <p className='login-error'>⚠️ {error}</p>}

				<FormField label='Chọn khoa *'>
					<select
						className='fi-input'
						value={draft.id_department ?? ''}
						onChange={(e) =>
							setDraft((p) => ({
								...p,
								id_department:
									e.target.value === '' ? null : Number(e.target.value),
							}))
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
					<p className='msec-title'>🏥 Số người bệnh</p>
					<div className='mrow3'>
						<NumberInput
							label='Cấp 1 (CSC1)'
							value={draft.patient_level_1}
							onChange={(v) => setDraft((p) => ({ ...p, patient_level_1: v }))}
						/>
						<NumberInput
							label='Cấp 2 (CSC2)'
							value={draft.patient_level_2}
							onChange={(v) => setDraft((p) => ({ ...p, patient_level_2: v }))}
						/>
						<NumberInput
							label='Cấp 3 (CSC3)'
							value={draft.patient_level_3}
							onChange={(v) => setDraft((p) => ({ ...p, patient_level_3: v }))}
						/>
					</div>
					<div className='mrow2'>
						<NumberInput
							label='NB khám / PT KH'
							value={draft.outpatient_cnt}
							onChange={(v) => setDraft((p) => ({ ...p, outpatient_cnt: v }))}
						/>
					</div>
				</div>

				<div className='msec'>
					<p className='msec-title'>👩‍⚕️ Nhân lực</p>
					<div className='mrow3'>
						<NumberInput
							label='Tổng nhân lực'
							value={draft.total_staff}
							onChange={(v) => setDraft((p) => ({ ...p, total_staff: v }))}
						/>
						<NumberInput
							label='Nghỉ trực'
							value={draft.staff_on_duty}
							onChange={(v) => setDraft((p) => ({ ...p, staff_on_duty: v }))}
						/>
						<NumberInput
							label='Nghỉ > 2 ngày'
							value={draft.staff_long_leave}
							onChange={(v) => setDraft((p) => ({ ...p, staff_long_leave: v }))}
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
						onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
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
