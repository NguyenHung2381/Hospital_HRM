import { useMemo, useState } from 'react';
import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { DailyClsRecord } from '@/types/clsType';
import { computeCls } from '@/utils/clsCalc';
import { getClsFields } from '@/utils/clsFieldConfig';
import { useDateValidation } from '@/hooks/useDateValidation';
import DateField from './form/DateField';
import FormErrorBanner from './form/FormErrorBanner';
import NumberGrid, { type NumberGridField } from './form/NumberGrid';

const chunk3 = (fields: NumberGridField[]): NumberGridField[][] => {
	const rows: NumberGridField[][] = [];
	for (let i = 0; i < fields.length; i += 3) rows.push(fields.slice(i, i + 3));
	return rows;
};

export interface CLSStaffingFormProps {
	mode: 'add' | 'edit';
	initialDraft: DailyClsRecord;
	onSave: (record: DailyClsRecord) => void;
	onClose: () => void;
	fmtDisplay: (ds: string) => string;
	saving?: boolean;
	error?: string;
	/** Nhân lực khuyến cáo cố định của khoa (Dept_Recommended_Config, formula_type='fixed') */
	recommendedStaff: number | null;
	/** code_department (vd. CLS01..CLS10) — quyết định trường nhập liệu áp dụng cho khoa */
	deptCode?: string | null;
	existingDates?: string[];
}

export default function CLSStaffingForm({
	mode,
	initialDraft,
	onSave,
	onClose,
	fmtDisplay,
	saving = false,
	error = '',
	recommendedStaff,
	deptCode = null,
	existingDates = [],
}: CLSStaffingFormProps) {
	const [draft, setDraft] = useState<DailyClsRecord>(initialDraft);
	const { dateError, setDateError, validateDate, todayStr } =
		useDateValidation(existingDates);
	const clsFields = useMemo(() => getClsFields(deptCode), [deptCode]);

	const title =
		mode === 'add'
			? '＋ Thêm bản ghi ngày mới'
			: `✏️ Sửa ngày ${fmtDisplay(draft.date)}`;

	const stats = useMemo(
		() => computeCls(draft, recommendedStaff),
		[draft, recommendedStaff],
	);

	const setDaLam = (key: keyof DailyClsRecord['daLam']) => (v: number | null) =>
		setDraft((p) => ({ ...p, daLam: { ...p.daLam, [key]: v } }));
	const setTonCho = (key: keyof DailyClsRecord['tonCho']) => (v: number | null) =>
		setDraft((p) => ({ ...p, tonCho: { ...p.tonCho, [key]: v } }));

	return (
		<ModalForm
			title={title}
			onClose={onClose}
			size='lg'
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

				{/* Khối lượng công việc đã thực hiện */}
				<div className='msec'>
					<p className='msec-title'>📊 Khối lượng công việc đã thực hiện</p>
					<NumberGrid
						rows={chunk3(
							clsFields.map((f) => ({
								label: f.label,
								value: draft.daLam[f.daLamKey],
								onChange: setDaLam(f.daLamKey),
							})),
						)}
					/>
				</div>

				{/* Số lượng tồn / chờ */}
				<div className='msec'>
					<p className='msec-title'>⏳ Số lượng tồn / chờ</p>
					<NumberGrid
						rows={chunk3(
							clsFields
								.filter((f) => f.tonChoKey !== null)
								.map((f) => ({
									label: f.label,
									value: draft.tonCho[f.tonChoKey as keyof typeof draft.tonCho],
									onChange: setTonCho(f.tonChoKey as keyof typeof draft.tonCho),
								})),
						)}
					/>
				</div>

				{/* Nhân lực */}
				<div className='msec'>
					<p className='msec-title'>👩‍⚕️ Nhân lực</p>
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
							label='Nghỉ ≥ 2 ngày'
							value={draft.nl.nghiTren2Ngay}
							onChange={(v) =>
								setDraft((p) => ({ ...p, nl: { ...p.nl, nghiTren2Ngay: v } }))
							}
						/>
					</div>

					{/* Preview tính toán */}
					<div className='tt03-preview'>
						<div className='tt03-preview-hdr'>
							<span>📋 Kết quả tính toán</span>
						</div>
						<div className='tt03-preview-body'>
							<div className='tt03-preview-col'>
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Tổng khối lượng CV</span>
									<span className='tt03-preview-val'>{stats.tongKhoiLuong}</span>
								</div>
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Nhân lực đi làm</span>
									<span className='tt03-preview-val'>{stats.diLam} người</span>
								</div>
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Tỷ lệ đi làm/KLCV</span>
									<span className='tt03-preview-val'>
										{stats.tyLe !== null ? `${(stats.tyLe * 100).toFixed(1)}%` : '—'}
									</span>
								</div>
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Nhân lực khuyến cáo</span>
									<span className='tt03-preview-val'>
										{stats.khuyenCao ?? '—'}
									</span>
								</div>
							</div>
							{stats.chenhLech !== null && (
								<div
									className={`tt03-preview-dp tt03-preview-dp-full ${
										stats.chenhLech > 0
											? 'dp-ok'
											: stats.chenhLech < 0
												? 'dp-warn'
												: 'dp-exact'
									}`}
								>
									{stats.chenhLech > 0
										? `✅ Dư +${stats.chenhLech} người`
										: stats.chenhLech < 0
											? `⚠️ Thiếu ${Math.abs(stats.chenhLech)} người`
											: `✔️ Đủ nhân lực`}
								</div>
							)}
						</div>
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
