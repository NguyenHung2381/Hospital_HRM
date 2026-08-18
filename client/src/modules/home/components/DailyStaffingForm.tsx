import { useState } from 'react';
import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { DailyRecord } from '@/types/staffingType';
import { useDateValidation } from '@/hooks/useDateValidation';
import { useTt03Preview } from '@/hooks/useTt03Preview';
import DateField from './form/DateField';
import FormErrorBanner from './form/FormErrorBanner';
import Tt03PreviewPanel from './form/Tt03PreviewPanel';

export interface DailyStaffingFormProps {
	mode: 'add' | 'edit';
	initialDraft: DailyRecord;
	onSave: (record: DailyRecord) => void;
	onClose: () => void;
	fmtDisplay: (ds: string) => string;
	saving?: boolean;
	error?: string;
	deptId: number;
	existingDates?: string[];
}

export default function DailyStaffingForm({
	mode,
	initialDraft,
	onSave,
	onClose,
	fmtDisplay,
	saving = false,
	error = '',
	deptId,
	existingDates = [],
}: DailyStaffingFormProps) {
	const [draft, setDraft] = useState<DailyRecord>(initialDraft);
	const { dateError, setDateError, validateDate, todayStr } =
		useDateValidation(existingDates);

	const { tt03Preview, previewLoading } = useTt03Preview(deptId, {
		cap1: draft.nb.cap1,
		cap2: draft.nb.cap2,
		cap3: draft.nb.cap3,
		nbKhamPT: draft.nbKhamPT,
	});

	const title =
		mode === 'add'
			? '＋ Thêm bản ghi ngày mới'
			: `✏️ Sửa ngày ${fmtDisplay(draft.date)}`;

	const diLam =
		(draft.nl.tong ?? 0) -
		(draft.nl.nghiTruc ?? 0) -
		(draft.nl.nghiTren2Ngay ?? 0);

	return (
		<ModalForm
			title={title}
			onClose={onClose}
		>
			<div className='mform'>
				<FormErrorBanner error={error} />

				<DateField
					mode={mode}
					value={draft.date}
					dateError={dateError}
					todayStr={todayStr}
					onChange={(val) => {
						setDraft((p) => ({ ...p, date: val }));
						if (mode === 'add') setDateError(validateDate(val));
					}}
				/>

				{/* Người bệnh */}
				<div className='msec'>
					<p className='msec-title'>🏥 Số người bệnh theo cấp độ</p>
					<div className='cap-hint-row'>
						<span className='cap-hint cap-hint-red'>
							Cấp 1: Nặng / Nguy kịch (CSC1)
						</span>
						<span className='cap-hint cap-hint-yellow'>
							Cấp 2: Trung bình (CSC2)
						</span>
						<span className='cap-hint cap-hint-green'>
							Cấp 3: Nhẹ / Ổn định (CSC3)
						</span>
					</div>
					<div className='mrow3'>
						<NumberInput
							label='Cấp 1 (CSC1)'
							value={draft.nb.cap1}
							onChange={(v) =>
								setDraft((p) => ({ ...p, nb: { ...p.nb, cap1: v } }))
							}
						/>
						<NumberInput
							label='Cấp 2 (CSC2)'
							value={draft.nb.cap2}
							onChange={(v) =>
								setDraft((p) => ({ ...p, nb: { ...p.nb, cap2: v } }))
							}
						/>
						<NumberInput
							label='Cấp 3 (CSC3)'
							value={draft.nb.cap3}
							onChange={(v) =>
								setDraft((p) => ({ ...p, nb: { ...p.nb, cap3: v } }))
							}
						/>
					</div>
					<div className='mrow2'>
						<NumberInput
							label='NB khám / Phẫu thuật KH'
							value={draft.nbKhamPT}
							onChange={(v) => setDraft((p) => ({ ...p, nbKhamPT: v }))}
						/>
					</div>

					<Tt03PreviewPanel
						tt03Preview={tt03Preview}
						previewLoading={previewLoading}
						nb={draft.nb}
						diLam={diLam}
					/>
				</div>

				{/* Nhân lực */}
				<div className='msec'>
					<p className='msec-title'>👩‍⚕️ Nhân lực ĐD - Hộ sinh - KTV</p>
					<div className='mrow3'>
						<NumberInput
							label='Tổng nhân lực'
							value={draft.nl.tong}
							onChange={(v) =>
								setDraft((p) => ({ ...p, nl: { ...p.nl, tong: v } }))
							}
						/>
						<NumberInput
							label='Nghỉ trực'
							value={draft.nl.nghiTruc}
							onChange={(v) =>
								setDraft((p) => ({ ...p, nl: { ...p.nl, nghiTruc: v } }))
							}
						/>
						<NumberInput
							label='Nghỉ > 2 ngày'
							value={draft.nl.nghiTren2Ngay}
							onChange={(v) =>
								setDraft((p) => ({ ...p, nl: { ...p.nl, nghiTren2Ngay: v } }))
							}
						/>
					</div>
					<div className='auto-preview'>
						<span>🔢 Đi làm (tự tính) =</span>
						<span className='auto-val'>{diLam} người</span>
					</div>
				</div>

				{/* Ghi chú */}
				<div className='msec'>
					<p className='msec-title'>📝 Ghi chú</p>
					<label className='fi'>
						<textarea
							className='fi-input fi-ta'
							rows={2}
							value={draft.ghiChu}
							onChange={(e) =>
								setDraft((p) => ({ ...p, ghiChu: e.target.value }))
							}
						/>
					</label>
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
						onClick={() => {
							if (mode === 'add') {
								const err = validateDate(draft.date);
								if (err) {
									setDateError(err);
									return;
								}
							}
							onSave(draft);
						}}
						disabled={saving || (mode === 'add' && !!validateDate(draft.date))}
					>
						{saving ? '⏳ Đang lưu...' : '💾 Lưu bản ghi'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
