import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { ApiClsRecord, ApiReport } from '@/types/apiType';
import { formatDateToVN } from '@/utils/dateUtils';
import { useState } from 'react';
import FormField from '../FormField';

interface EditClsRecordModalProps {
	record: ApiClsRecord;
	report: ApiReport;
	selDate: string;
	onSaved: (updatedReport: ApiReport) => void;
	onClose: () => void;
}

type EditClsDraft = Omit<
	ApiClsRecord,
	| 'id'
	| 'id_report'
	| 'id_department'
	| 'department_name'
	| 'sort_order'
	| 'staff_working'
	| 'work_ratio'
	| 'recommended_staff'
	| 'coordination'
	| 'rec_formula_type'
	| 'rec_fixed_add'
	| 'rec_note'
	| 'created_at'
	| 'updated_at'
> & { note: string };

function toDraft(r: ApiClsRecord): EditClsDraft {
	return {
		sample_or_visit_cnt: r.sample_or_visit_cnt,
		xray_us_cnt: r.xray_us_cnt,
		ct_endoscopy_cnt: r.ct_endoscopy_cnt,
		mri_bonedensity_cnt: r.mri_bonedensity_cnt,
		ecg_intervention_cnt: r.ecg_intervention_cnt,
		linen_media_cnt: r.linen_media_cnt,
		tool_metal_cnt: r.tool_metal_cnt,
		tool_plastic_cnt: r.tool_plastic_cnt,
		supervised_dept_cnt: r.supervised_dept_cnt,
		pending_sample_or_visit_cnt: r.pending_sample_or_visit_cnt,
		pending_xray_us_cnt: r.pending_xray_us_cnt,
		pending_ct_endoscopy_cnt: r.pending_ct_endoscopy_cnt,
		pending_mri_bonedensity_cnt: r.pending_mri_bonedensity_cnt,
		pending_ecg_intervention_cnt: r.pending_ecg_intervention_cnt,
		pending_linen_cnt: r.pending_linen_cnt,
		pending_tool_metal_cnt: r.pending_tool_metal_cnt,
		pending_tool_plastic_cnt: r.pending_tool_plastic_cnt,
		total_staff: r.total_staff,
		staff_on_duty: r.staff_on_duty,
		staff_long_leave: r.staff_long_leave,
		note: r.note ?? '',
	};
}

/** Modal sửa dữ liệu 1 bản ghi khoa CLS trong báo cáo (dùng ở admin DataPage). */
export default function EditClsRecordModal({
	record,
	report,
	selDate,
	onSaved,
	onClose,
}: EditClsRecordModalProps) {
	const [draft, setDraft] = useState<EditClsDraft>(() => toDraft(record));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const diLam =
		(draft.total_staff ?? 0) - (draft.staff_on_duty ?? 0) - (draft.staff_long_leave ?? 0);

	const setField = <K extends keyof EditClsDraft>(key: K, val: EditClsDraft[K]) =>
		setDraft((p) => ({ ...p, [key]: val }));

	const handleSave = async () => {
		setSaving(true);
		setError('');
		try {
			const res = await fetch(
				`/api/reports/${report.id_report}/cls-records/${record.id}`,
				{
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(draft),
				},
			);
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi lưu');
				return;
			}
			const rRes = await fetch(`/api/reports/date/${selDate}`);
			const rData = (await rRes.json()) as { success: boolean; data: ApiReport };
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
			title={`✏️ Sửa dữ liệu CLS — ${record.department_name} · ${formatDateToVN(selDate)}`}
			onClose={onClose}
			size='lg'
		>
			<div className='mform'>
				{error && <p className='login-error'>⚠️ {error}</p>}

				<div className='msec'>
					<p className='msec-title'>📊 Khối lượng công việc đã thực hiện</p>
					<div className='mrow3'>
						<NumberInput
							label='Mẫu BP / Tiêu bản / NB khám / tư vấn'
							value={draft.sample_or_visit_cnt}
							onChange={(v) => setField('sample_or_visit_cnt', v)}
						/>
						<NumberInput
							label='X-quang hoặc siêu âm'
							value={draft.xray_us_cnt}
							onChange={(v) => setField('xray_us_cnt', v)}
						/>
						<NumberInput
							label='CT / Nội soi'
							value={draft.ct_endoscopy_cnt}
							onChange={(v) => setField('ct_endoscopy_cnt', v)}
						/>
					</div>
					<div className='mrow3'>
						<NumberInput
							label='MRI / Loãng xương'
							value={draft.mri_bonedensity_cnt}
							onChange={(v) => setField('mri_bonedensity_cnt', v)}
						/>
						<NumberInput
							label='Điện tim hoặc can thiệp'
							value={draft.ecg_intervention_cnt}
							onChange={(v) => setField('ecg_intervention_cnt', v)}
						/>
						<NumberInput
							label='Đồ vải (Kg) / Truyền thông'
							value={draft.linen_media_cnt}
							onChange={(v) => setField('linen_media_cnt', v)}
						/>
					</div>
					<div className='mrow3'>
						<NumberInput
							label='Xử lý dụng cụ sắt (Bộ)'
							value={draft.tool_metal_cnt}
							onChange={(v) => setField('tool_metal_cnt', v)}
						/>
						<NumberInput
							label='Xử lý dụng cụ nhựa (Cái)'
							value={draft.tool_plastic_cnt}
							onChange={(v) => setField('tool_plastic_cnt', v)}
						/>
						<NumberInput
							label='Khoa giám sát (số khoa)'
							value={draft.supervised_dept_cnt}
							onChange={(v) => setField('supervised_dept_cnt', v)}
						/>
					</div>
				</div>

				<div className='msec'>
					<p className='msec-title'>⏳ Số lượng tồn / chờ</p>
					<div className='mrow3'>
						<NumberInput
							label='Mẫu BP / Tiêu bản / NB khám / tư vấn'
							value={draft.pending_sample_or_visit_cnt}
							onChange={(v) => setField('pending_sample_or_visit_cnt', v)}
						/>
						<NumberInput
							label='X-quang hoặc siêu âm'
							value={draft.pending_xray_us_cnt}
							onChange={(v) => setField('pending_xray_us_cnt', v)}
						/>
						<NumberInput
							label='CT / Nội soi'
							value={draft.pending_ct_endoscopy_cnt}
							onChange={(v) => setField('pending_ct_endoscopy_cnt', v)}
						/>
					</div>
					<div className='mrow3'>
						<NumberInput
							label='MRI / Loãng xương'
							value={draft.pending_mri_bonedensity_cnt}
							onChange={(v) => setField('pending_mri_bonedensity_cnt', v)}
						/>
						<NumberInput
							label='Điện tim hoặc Can thiệp'
							value={draft.pending_ecg_intervention_cnt}
							onChange={(v) => setField('pending_ecg_intervention_cnt', v)}
						/>
						<NumberInput
							label='Đồ vải (Kg)'
							value={draft.pending_linen_cnt}
							onChange={(v) => setField('pending_linen_cnt', v)}
						/>
					</div>
					<div className='mrow2'>
						<NumberInput
							label='Xử lý dụng cụ sắt (Bộ)'
							value={draft.pending_tool_metal_cnt}
							onChange={(v) => setField('pending_tool_metal_cnt', v)}
						/>
						<NumberInput
							label='Xử lý dụng cụ nhựa (Cái)'
							value={draft.pending_tool_plastic_cnt}
							onChange={(v) => setField('pending_tool_plastic_cnt', v)}
						/>
					</div>
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
							onChange={(e) => setField('note', e.target.value)}
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
