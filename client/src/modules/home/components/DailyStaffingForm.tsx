import { useEffect, useState } from 'react';
import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { DailyRecord } from '@/types/staffingType';
import {
	getFormulaTypeName,
	getRecFormulaTypeName,
	getPreviewFormulaDetail,
	getPreviewRecDetail,
	type TT03Preview,
} from '@/utils/formulaHelperUtils';
import { getTodayDateString } from '@/utils/dateUtils';

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
	const [tt03Preview, setTT03Preview] = useState<TT03Preview | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
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

	// Tính preview TT03 + Khuyến nghị mỗi khi số NB thay đổi (debounce 400ms)
	useEffect(() => {
		if (!deptId) return;
		const { cap1, cap2, cap3 } = draft.nb;
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
						outpatient_cnt: draft.nbKhamPT ?? 0,
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
	}, [
		draft.nb.cap1,
		draft.nb.cap2,
		draft.nb.cap3,
		draft.nbKhamPT,
		deptId,
		draft.nb,
	]);

	const title =
		mode === 'add'
			? '＋ Thêm bản ghi ngày mới'
			: `✏️ Sửa ngày ${fmtDisplay(draft.date)}`;

	const diLam =
		(draft.nl.tong ?? 0) -
		(draft.nl.nghiTruc ?? 0) -
		(draft.nl.nghiTren2Ngay ?? 0);

	// Điều phối dựa trên Nhân lực khuyến nghị (ưu tiên) hoặc TT03
	const staffRef =
		tt03Preview?.recommended?.staff ?? tt03Preview?.tt03?.staff ?? null;
	const dieuPhoiPreview = staffRef !== null ? diLam - staffRef : null;

	const tt03Detail = getPreviewFormulaDetail(tt03Preview, draft.nb);
	const recDetail = getPreviewRecDetail(tt03Preview, draft.nb);
	const tt03TypeName = tt03Preview?.tt03
		? getFormulaTypeName(tt03Preview.tt03.formula_type)
		: '';
	const recTypeName = tt03Preview?.recommended
		? getRecFormulaTypeName(tt03Preview.recommended.formula_type)
		: '';

	return (
		<ModalForm
			title={title}
			onClose={onClose}
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

					{/* ── Preview TT03 + Khuyến nghị ── */}
					<div className='tt03-preview'>
						<div className='tt03-preview-hdr'>
							<span>📋 Nhân lực khuyến cáo</span>
							{previewLoading && (
								<span className='tt03-preview-loading'>⏳ đang tính...</span>
							)}
						</div>

						{tt03Preview ? (
							<div className='tt03-preview-body'>
								{/* ── Cột TT03 ── */}
								<div className='tt03-preview-col'>
									<div className='tt03-preview-col-hdr tt03-col-hdr-blue'>
										📑 Theo TT03
									</div>
									{tt03Preview.tt03 ? (
										<>
											<div className='tt03-preview-row'>
												<span className='tt03-preview-lbl'>Loại CT</span>
												<span className='tt03-preview-val tt03-formula-tag'>
													{tt03TypeName}
												</span>
											</div>
											{tt03Detail && (
												<div className='tt03-formula-detail'>
													<span className='tt03-preview-lbl'>Công thức</span>
													<code className='tt03-formula-expr'>
														{tt03Detail}
													</code>
												</div>
											)}
											<div className='tt03-preview-row'>
												<span className='tt03-preview-lbl'>Tổng NB</span>
												<span className='tt03-preview-val'>
													{tt03Preview.total_patients} người
												</span>
											</div>
											<div className='tt03-preview-row'>
												<span className='tt03-preview-lbl'>Kết quả (thô)</span>
												<span className='tt03-preview-val'>
													{tt03Preview.tt03.raw?.toFixed(2) ?? '—'}
												</span>
											</div>
											<div className='tt03-preview-row tt03-preview-main'>
												<span className='tt03-preview-lbl'>Khuyến cáo</span>
												<span className='tt03-preview-kc'>
													{tt03Preview.tt03.staff ?? '—'} người
												</span>
											</div>
										</>
									) : (
										<p className='tt03-preview-empty'>Chưa cấu hình TT03</p>
									)}
								</div>

								{/* ── Cột Khuyến nghị ── */}
								<div className='tt03-preview-col'>
									<div className='tt03-preview-col-hdr tt03-col-hdr-green'>
										💡 Khuyến nghị
									</div>
									{tt03Preview.recommended ? (
										<>
											<div className='tt03-preview-row'>
												<span className='tt03-preview-lbl'>Loại CT</span>
												<span className='tt03-preview-val tt03-formula-tag tt03-formula-tag-green'>
													{recTypeName}
												</span>
											</div>
											{recDetail && (
												<div className='tt03-formula-detail'>
													<span className='tt03-preview-lbl'>Công thức</span>
													<code className='tt03-formula-expr'>{recDetail}</code>
												</div>
											)}
											<div className='tt03-preview-row'>
												<span className='tt03-preview-lbl'>Kết quả (thô)</span>
												<span className='tt03-preview-val'>
													{tt03Preview.recommended.raw?.toFixed(2) ?? '—'}
												</span>
											</div>
											<div className='tt03-preview-row tt03-preview-main'>
												<span className='tt03-preview-lbl'>Khuyến nghị</span>
												<span className='tt03-preview-kc tt03-preview-kc-green'>
													{tt03Preview.recommended.staff ?? '—'} người
												</span>
											</div>
										</>
									) : (
										<p className='tt03-preview-empty'>
											Chưa cấu hình khuyến nghị
										</p>
									)}
								</div>

								{/* ── Điều phối (dựa trên khuyến nghị nếu có, fallback TT03) ── */}
								{dieuPhoiPreview !== null && (
									<div
										className={`tt03-preview-dp tt03-preview-dp-full ${
											dieuPhoiPreview > 0
												? 'dp-ok'
												: dieuPhoiPreview < 0
													? 'dp-warn'
													: 'dp-exact'
										}`}
									>
										{dieuPhoiPreview > 0
											? `✅ Dư +${dieuPhoiPreview} người`
											: dieuPhoiPreview < 0
												? `⚠️ Thiếu ${Math.abs(dieuPhoiPreview)} người`
												: `✔️ Đủ nhân lực`}
										<span className='dp-ref-note'>
											{tt03Preview.recommended
												? '(theo nhân lực khuyến nghị)'
												: '(theo TT03)'}
										</span>
									</div>
								)}
							</div>
						) : (
							<p className='tt03-preview-empty'>
								Nhập số NB để xem khuyến cáo TT03 và nhân lực khuyến nghị
							</p>
						)}
					</div>
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
