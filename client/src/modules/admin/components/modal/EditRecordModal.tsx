import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { ApiRecord, ApiReport } from '@/types/apiType';
import type { RecordDraft } from '@/types/staffingType';
import { formatDateToVN } from '@/utils/dateUtils';
import { blankDraft } from '@/utils/recordHelperUtils';
import { useState } from 'react';
import FormField from '../FormField';

interface EditRecordModalProps {
	record: ApiRecord;
	report: ApiReport;
	selDate: string;
	userId: number | null | undefined;
	onSaved: (updatedReport: ApiReport) => void;
	onClose: () => void;
}

/**
 * Modal sửa dữ liệu 1 bản ghi khoa trong báo cáo.
 * Tự quản lý draft state và gọi API PUT trực tiếp.
 * Sau khi lưu xong, refetch báo cáo và trả ApiReport mới qua onSaved.
 */
export default function EditRecordModal({
	record,
	report,
	selDate,
	userId,
	onSaved,
	onClose,
}: EditRecordModalProps) {
	const [draft, setDraft] = useState<RecordDraft>(() => blankDraft(record));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const diLam =
		(draft.total_staff ?? 0) -
		(draft.staff_on_duty ?? 0) -
		(draft.staff_long_leave ?? 0);

	const handleSave = async () => {
		setSaving(true);
		setError('');
		try {
			const res = await fetch(
				`/api/reports/${report.id_report}/records/${(record as ApiRecord & { id: number }).id}`,
				{
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						patient_level_1: draft.patient_level_1,
						patient_level_2: draft.patient_level_2,
						patient_level_3: draft.patient_level_3,
						outpatient_cnt: draft.outpatient_cnt,
						total_staff: draft.total_staff,
						staff_on_duty: draft.staff_on_duty,
						staff_long_leave: draft.staff_long_leave,
						note: draft.note,
						created_by: userId ?? null,
					}),
				},
			);
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi lưu');
				return;
			}
			// Refetch báo cáo để cập nhật recommended_staff_calc mới
			const rRes = await fetch(`/api/reports/date/${selDate}`);
			const rData = (await rRes.json()) as {
				success: boolean;
				data: ApiReport;
			};
			if (rData.success) onSaved(rData.data);
			onClose();
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<ModalForm
			title={`✏️ Sửa dữ liệu — ${draft.department_name} · ${formatDateToVN(selDate)}`}
			onClose={onClose}
			size='lg'
		>
			<div className='mform'>
				{error && <p className='login-error'>⚠️ {error}</p>}

				<div className='msec'>
					<p className='msec-title'>🏥 Số người bệnh theo cấp độ</p>
					<div className='cap-hint-row'>
						<span className='cap-hint cap-hint-red'>
							Cấp 1: Nặng / Nguy kịch
						</span>
						<span className='cap-hint cap-hint-yellow'>Cấp 2: Trung bình</span>
						<span className='cap-hint cap-hint-green'>
							Cấp 3: Nhẹ / Ổn định
						</span>
					</div>
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
							label='NB khám / Phẫu thuật KH'
							value={draft.outpatient_cnt}
							onChange={(v) => setDraft((p) => ({ ...p, outpatient_cnt: v }))}
						/>
					</div>
				</div>

				<div className='msec'>
					<p className='msec-title'>👩‍⚕️ Nhân lực ĐD - Hộ sinh - KTV</p>
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
						<span>🔢 Đi làm (tự tính) =</span>
						<span className='auto-val'>{diLam} người</span>
					</div>
				</div>

				<div className='msec'>
					<p className='msec-title'>📝 Ghi chú</p>
					<FormField label=''>
						<textarea
							className='fi-input fi-ta'
							rows={2}
							value={draft.note}
							onChange={(e) =>
								setDraft((p) => ({ ...p, note: e.target.value }))
							}
						/>
					</FormField>
				</div>

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
						{saving ? '⏳ Đang lưu...' : '💾 Lưu'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
