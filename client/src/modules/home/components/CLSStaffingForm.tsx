import { useMemo, useState } from 'react';
import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { DailyClsRecord } from '@/types/clsType';
import { computeCls } from '@/utils/clsCalc';
import { getTodayDateString } from '@/utils/dateUtils';

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
	existingDates = [],
}: CLSStaffingFormProps) {
	const [draft, setDraft] = useState<DailyClsRecord>(initialDraft);
	const [dateError, setDateError] = useState('');

	const existingDateSet = new Set(existingDates);
	const todayStr = getTodayDateString();

	const validateDate = (dateStr: string): string => {
		if (!dateStr) return 'Vui lòng chọn ngày';
		if (dateStr < todayStr)
			return 'Không thể thêm bản ghi cho ngày trong quá khứ';
		if (existingDateSet.has(dateStr))
			return 'Ngày này đã có bản ghi, vui lòng chọn ngày khác';
		return '';
	};

	const title =
		mode === 'add'
			? '＋ Thêm bản ghi ngày mới'
			: `✏️ Sửa ngày ${fmtDisplay(draft.date)}`;

	const stats = useMemo(
		() => computeCls(draft, recommendedStaff),
		[draft, recommendedStaff],
	);

	return (
		<ModalForm
			title={title}
			onClose={onClose}
			size='lg'
		>
			<div className='mform'>
				{error && (
					<p
						style={{
							color: '#dc2626',
							fontSize: '.82rem',
							marginBottom: 8,
							background: '#fef2f2',
							borderRadius: 6,
							padding: '6px 10px',
						}}
					>
						⚠️ {error}
					</p>
				)}

				{/* Ngày */}
				<div className='msec'>
					<p className='msec-title'>📅 Ngày</p>
					<label className='fi'>
						<span className='fi-label'>Chọn ngày</span>
						<input
							type='date'
							className={`fi-input${dateError ? ' fi-input-error' : ''}`}
							value={draft.date}
							disabled={mode === 'edit'}
							min={mode === 'add' ? todayStr : undefined}
							onChange={(e) => {
								const val = e.target.value;
								setDraft((p) => ({ ...p, date: val }));
								if (mode === 'add') setDateError(validateDate(val));
							}}
						/>
						{mode === 'add' && dateError && (
							<span className='fi-error'>{dateError}</span>
						)}
						{mode === 'add' && !dateError && draft.date && (
							<span className='fi-hint'>✅ Ngày hợp lệ — chưa có bản ghi</span>
						)}
					</label>
				</div>

				{/* Khối lượng công việc đã thực hiện */}
				<div className='msec'>
					<p className='msec-title'>📊 Khối lượng công việc đã thực hiện</p>
					<div className='mrow3'>
						<NumberInput
							label='Mẫu BP / Tiêu bản / NB khám / tư vấn'
							value={draft.daLam.sampleOrVisit}
							onChange={(v) =>
								setDraft((p) => ({ ...p, daLam: { ...p.daLam, sampleOrVisit: v } }))
							}
						/>
						<NumberInput
							label='X-quang hoặc siêu âm'
							value={draft.daLam.xrayUs}
							onChange={(v) =>
								setDraft((p) => ({ ...p, daLam: { ...p.daLam, xrayUs: v } }))
							}
						/>
						<NumberInput
							label='CT / Nội soi'
							value={draft.daLam.ctEndoscopy}
							onChange={(v) =>
								setDraft((p) => ({ ...p, daLam: { ...p.daLam, ctEndoscopy: v } }))
							}
						/>
					</div>
					<div className='mrow3'>
						<NumberInput
							label='MRI / Loãng xương'
							value={draft.daLam.mriBoneDensity}
							onChange={(v) =>
								setDraft((p) => ({
									...p,
									daLam: { ...p.daLam, mriBoneDensity: v },
								}))
							}
						/>
						<NumberInput
							label='Điện tim hoặc can thiệp'
							value={draft.daLam.ecgIntervention}
							onChange={(v) =>
								setDraft((p) => ({
									...p,
									daLam: { ...p.daLam, ecgIntervention: v },
								}))
							}
						/>
						<NumberInput
							label='Đồ vải (Kg) / Truyền thông'
							value={draft.daLam.linenMedia}
							onChange={(v) =>
								setDraft((p) => ({ ...p, daLam: { ...p.daLam, linenMedia: v } }))
							}
						/>
					</div>
					<div className='mrow3'>
						<NumberInput
							label='Xử lý dụng cụ sắt (Bộ)'
							value={draft.daLam.toolMetal}
							onChange={(v) =>
								setDraft((p) => ({ ...p, daLam: { ...p.daLam, toolMetal: v } }))
							}
						/>
						<NumberInput
							label='Xử lý dụng cụ nhựa (Cái)'
							value={draft.daLam.toolPlastic}
							onChange={(v) =>
								setDraft((p) => ({ ...p, daLam: { ...p.daLam, toolPlastic: v } }))
							}
						/>
						<NumberInput
							label='Khoa giám sát (số khoa)'
							value={draft.daLam.supervisedDept}
							onChange={(v) =>
								setDraft((p) => ({
									...p,
									daLam: { ...p.daLam, supervisedDept: v },
								}))
							}
						/>
					</div>
				</div>

				{/* Số lượng tồn / chờ */}
				<div className='msec'>
					<p className='msec-title'>⏳ Số lượng tồn / chờ</p>
					<div className='mrow3'>
						<NumberInput
							label='Mẫu BP / Tiêu bản / NB khám / tư vấn'
							value={draft.tonCho.sampleOrVisit}
							onChange={(v) =>
								setDraft((p) => ({ ...p, tonCho: { ...p.tonCho, sampleOrVisit: v } }))
							}
						/>
						<NumberInput
							label='X-quang hoặc siêu âm'
							value={draft.tonCho.xrayUs}
							onChange={(v) =>
								setDraft((p) => ({ ...p, tonCho: { ...p.tonCho, xrayUs: v } }))
							}
						/>
						<NumberInput
							label='CT / Nội soi'
							value={draft.tonCho.ctEndoscopy}
							onChange={(v) =>
								setDraft((p) => ({ ...p, tonCho: { ...p.tonCho, ctEndoscopy: v } }))
							}
						/>
					</div>
					<div className='mrow3'>
						<NumberInput
							label='MRI / Loãng xương'
							value={draft.tonCho.mriBoneDensity}
							onChange={(v) =>
								setDraft((p) => ({
									...p,
									tonCho: { ...p.tonCho, mriBoneDensity: v },
								}))
							}
						/>
						<NumberInput
							label='Điện tim hoặc Can thiệp'
							value={draft.tonCho.ecgIntervention}
							onChange={(v) =>
								setDraft((p) => ({
									...p,
									tonCho: { ...p.tonCho, ecgIntervention: v },
								}))
							}
						/>
						<NumberInput
							label='Đồ vải (Kg)'
							value={draft.tonCho.linen}
							onChange={(v) =>
								setDraft((p) => ({ ...p, tonCho: { ...p.tonCho, linen: v } }))
							}
						/>
					</div>
					<div className='mrow2'>
						<NumberInput
							label='Xử lý dụng cụ sắt (Bộ)'
							value={draft.tonCho.toolMetal}
							onChange={(v) =>
								setDraft((p) => ({ ...p, tonCho: { ...p.tonCho, toolMetal: v } }))
							}
						/>
						<NumberInput
							label='Xử lý dụng cụ nhựa (Cái)'
							value={draft.tonCho.toolPlastic}
							onChange={(v) =>
								setDraft((p) => ({ ...p, tonCho: { ...p.tonCho, toolPlastic: v } }))
							}
						/>
					</div>
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
