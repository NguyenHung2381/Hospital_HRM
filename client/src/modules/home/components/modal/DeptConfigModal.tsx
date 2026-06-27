import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { FormulaType } from '@/types/commonType';
import type { DeptConfig } from '@/types/staffingType';
import { useEffect, useState } from 'react';

// ── Kiểu dữ liệu cho Recommended Config ─────────────────────────
type RecFormulaType =
	| 'coef'
	| 'coef_with_total'
	| 'total_ratio'
	| 'outpatient_count';

interface HeSoRec {
	coefL1: number;
	coefL2: number;
	coefL3: number;
	outpatientRatio: number | null;
	fixedAdd: number;
	note: string;
}

export interface DeptConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	activeKhoaId: number;
	initialDept: DeptConfig;
	onSaveSuccess: (updatedDept: DeptConfig) => void;
}

type TabKey = 'tt03' | 'rec';

const REC_FORMULA_OPTIONS: { value: RecFormulaType; label: string }[] = [
	{ value: 'coef', label: 'Hệ số theo cấp độ NB' },
	{ value: 'coef_with_total', label: 'Hệ số cấp độ + Tổng NB' },
	{ value: 'total_ratio', label: 'Tỉ lệ tổng NB (cấp cứu)' },
	{ value: 'outpatient_count', label: 'Lượt khám ngoại trú' },
];

const DEFAULT_HE_SO_REC: HeSoRec = {
	coefL1: 0.5,
	coefL2: 0.104,
	coefL3: 0.104,
	outpatientRatio: null,
	fixedAdd: 0,
	note: '',
};

export default function DeptConfigModal({
	isOpen,
	onClose,
	activeKhoaId,
	initialDept,
	onSaveSuccess,
}: DeptConfigModalProps) {
	const [activeTab, setActiveTab] = useState<TabKey>('tt03');

	// ── Draft TT03 ──────────────────────────────────────────────
	const [deptDraft, setDeptDraft] = useState<DeptConfig>(initialDept);

	// ── Draft Recommended Config ────────────────────────────────
	const [recFormula, setRecFormula] = useState<RecFormulaType>(
		(initialDept.recFormulaType as RecFormulaType) ?? 'coef',
	);
	const [recHeSo, setRecHeSo] = useState<HeSoRec>({
		coefL1: initialDept.heSoRec?.coefL1 ?? DEFAULT_HE_SO_REC.coefL1,
		coefL2: initialDept.heSoRec?.coefL2 ?? DEFAULT_HE_SO_REC.coefL2,
		coefL3: initialDept.heSoRec?.coefL3 ?? DEFAULT_HE_SO_REC.coefL3,
		outpatientRatio:
			initialDept.heSoRec?.outpatientRatio ?? DEFAULT_HE_SO_REC.outpatientRatio,
		fixedAdd: initialDept.heSoRec?.fixedAdd ?? DEFAULT_HE_SO_REC.fixedAdd,
		note: initialDept.heSoRec?.note ?? DEFAULT_HE_SO_REC.note,
	});

	const [saving, setSaving] = useState(false);
	const [apiError, setApiError] = useState('');

	// Reset khi mở modal
	useEffect(() => {
		if (isOpen) {
			setDeptDraft({ ...initialDept });
			setRecFormula((initialDept.recFormulaType as RecFormulaType) ?? 'coef');
			setRecHeSo({
				coefL1: initialDept.heSoRec?.coefL1 ?? DEFAULT_HE_SO_REC.coefL1,
				coefL2: initialDept.heSoRec?.coefL2 ?? DEFAULT_HE_SO_REC.coefL2,
				coefL3: initialDept.heSoRec?.coefL3 ?? DEFAULT_HE_SO_REC.coefL3,
				outpatientRatio:
					initialDept.heSoRec?.outpatientRatio ??
					DEFAULT_HE_SO_REC.outpatientRatio,
				fixedAdd: initialDept.heSoRec?.fixedAdd ?? DEFAULT_HE_SO_REC.fixedAdd,
				note: initialDept.heSoRec?.note ?? DEFAULT_HE_SO_REC.note,
			});
			setApiError('');
			setActiveTab('tt03');
		}
	}, [isOpen, initialDept]);

	if (!isOpen) return null;

	// ── Lưu toàn bộ (song song 2 + 1 API) ──────────────────────
	const handleSave = async () => {
		setSaving(true);
		setApiError('');

		try {
			// 1️⃣  PUT /api/tt03/config/:deptId
			const tt03Res = await fetch(`/api/tt03/config/${activeKhoaId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					formula_type: deptDraft.formulaType,
					patient_ratio: deptDraft.heSo.patientRatio ?? 0.6,
					shift_divisor: deptDraft.heSo.shiftDivisor ?? 3,
					shift_multiplier: deptDraft.heSo.shiftMultiplier ?? 2,
					fixed_add: deptDraft.heSo.fixedAdd ?? 0,
					note: deptDraft.tt03Note ?? null,
				}),
			});
			if (!tt03Res.ok) {
				const body = (await tt03Res.json().catch(() => ({}))) as {
					message?: string;
				};
				setApiError(body.message ?? 'Lỗi khi lưu cấu hình TT03');
				return;
			}

			// 2️⃣  PUT /api/tt03/recommended-config/:deptId
			const recRes = await fetch(
				`/api/tt03/recommended-config/${activeKhoaId}`,
				{
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						formula_type: recFormula,
						coef_l1: recHeSo.coefL1,
						coef_l2: recHeSo.coefL2,
						coef_l3: recHeSo.coefL3,
						outpatient_ratio: recHeSo.outpatientRatio,
						fixed_add: recHeSo.fixedAdd,
						note: recHeSo.note || null,
					}),
				},
			);
			if (!recRes.ok) {
				const body = (await recRes.json().catch(() => ({}))) as {
					message?: string;
				};
				setApiError(body.message ?? 'Lỗi khi lưu cấu hình khuyến nghị');
				return;
			}

			// 3️⃣  PUT /api/departments/:id
			// Chỉ gửi các field mà API nhận: name, bed_count, coef_*
			const deptBody: Record<string, unknown> = {
				name: deptDraft.ten || initialDept.ten,
				bed_count: deptDraft.giuongMay,
				// Giữ nguyên các giá trị coef từ initialDept (không thay đổi trừ custom_coef)
				coef_level_1: initialDept.heSo.cap1,
				coef_level_2: initialDept.heSo.cap2,
				coef_level_3: initialDept.heSo.cap3,
				coef_total: initialDept.heSo.tong,
			};
			// Nếu là custom_coef thì cập nhật hệ số từ draft
			if (deptDraft.formulaType === 'custom_coef') {
				deptBody.coef_level_1 = deptDraft.heSo.cap1;
				deptBody.coef_level_2 = deptDraft.heSo.cap2;
				deptBody.coef_level_3 = deptDraft.heSo.cap3;
				deptBody.coef_total = deptDraft.heSo.tong;
			}

			const deptRes = await fetch(`/api/departments/${activeKhoaId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(deptBody),
			});
			if (!deptRes.ok) {
				const body = (await deptRes.json().catch(() => ({}))) as {
					message?: string;
				};
				setApiError(body.message ?? 'Lỗi khi cập nhật thông tin khoa');
				return;
			}

			// Cập nhật state trả về cho parent
			onSaveSuccess({
				...deptDraft,
				recFormulaType: recFormula,
				heSoRec: { ...recHeSo },
			});
		} finally {
			setSaving(false);
		}
	};

	// ── Render ──────────────────────────────────────────────────
	return (
		<ModalForm
			title='⚙️ Cấu hình khoa'
			onClose={onClose}
			size='lg'
		>
			<div className='mform'>
				{/* Tên khoa */}
				<div className='msec'>
					<div className='dept-modal-name-row'>
						<div className='dept-modal-name-icon'>🏥</div>
						<div>
							<p className='dept-modal-name-label'>Khoa đang cấu hình</p>
							<p className='dept-modal-name-val'>{initialDept.ten}</p>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div className='tab-bar'>
					<button
						className={`tab-btn${activeTab === 'tt03' ? ' tab-btn--active' : ''}`}
						onClick={() => setActiveTab('tt03')}
					>
						📋 Cấu hình TT 03
					</button>
					<button
						className={`tab-btn${activeTab === 'rec' ? ' tab-btn--active' : ''}`}
						onClick={() => setActiveTab('rec')}
					>
						🏅 Cấu hình Khuyến nghị
					</button>
				</div>

				{/* ══ Tab TT03 ══════════════════════════════════════════ */}
				{activeTab === 'tt03' && (
					<>
						<div className='msec'>
							<p className='msec-title'>📋 Loại công thức TT 03</p>
							<div className='mrow2'>
								<label className='fi'>
									<span className='fi-label'>Loại công thức</span>
									<select
										className='fi-input'
										value={deptDraft.formulaType}
										onChange={(e) =>
											setDeptDraft((p) => ({
												...p,
												formulaType: e.target.value as FormulaType,
											}))
										}
									>
										<option value='custom_coef'>Hệ số theo cấp độ NB</option>
										<option value='standard'>Nội trú thông thường</option>
										<option value='icu'>Hồi sức tích cực (ICU)</option>
										<option value='surgery'>Gây mê / Phẫu thuật</option>
									</select>
								</label>
								<label className='fi'>
									<span className='fi-label'>Số giường / máy / bàn</span>
									<input
										type='number'
										className='fi-input'
										value={deptDraft.giuongMay ?? ''}
										onChange={(e) =>
											setDeptDraft((p) => ({
												...p,
												giuongMay:
													e.target.value === '' ? null : Number(e.target.value),
											}))
										}
									/>
								</label>
							</div>
						</div>

						{/* custom_coef: hệ số theo cấp */}
						{deptDraft.formulaType === 'custom_coef' && (
							<div className='msec'>
								<p className='msec-title'>📐 Hệ số theo cấp độ NB</p>
								<p className='msec-hint'>
									= (CSC1 × cap1) + (CSC2 × cap2) + (CSC3 × cap3) + (Tổng ×
									tong)
								</p>
								<div className='mrow2'>
									<NumberInput
										label='Hệ số Cấp 1 (CSC1)'
										value={deptDraft.heSo.cap1}
										step={0.001}
										onChange={(v) =>
											setDeptDraft((p) => ({
												...p,
												heSo: { ...p.heSo, cap1: v ?? 0 },
											}))
										}
									/>
									<NumberInput
										label='Hệ số Cấp 2 (CSC2)'
										value={deptDraft.heSo.cap2}
										step={0.001}
										onChange={(v) =>
											setDeptDraft((p) => ({
												...p,
												heSo: { ...p.heSo, cap2: v ?? 0 },
											}))
										}
									/>
								</div>
								<div className='mrow2'>
									<NumberInput
										label='Hệ số Cấp 3 (CSC3)'
										value={deptDraft.heSo.cap3}
										step={0.001}
										onChange={(v) =>
											setDeptDraft((p) => ({
												...p,
												heSo: { ...p.heSo, cap3: v ?? 0 },
											}))
										}
									/>
									<NumberInput
										label='Hệ số Tổng NB'
										value={deptDraft.heSo.tong}
										step={0.001}
										onChange={(v) =>
											setDeptDraft((p) => ({
												...p,
												heSo: { ...p.heSo, tong: v ?? 0 },
											}))
										}
									/>
								</div>
							</div>
						)}

						{/* standard / icu / surgery: tham số công thức */}
						{deptDraft.formulaType !== 'custom_coef' && (
							<div className='msec'>
								<p className='msec-title'>📐 Tham số công thức</p>
								<div className='mrow3'>
									<NumberInput
										label='Tỉ lệ NB / điều dưỡng'
										value={deptDraft.heSo.patientRatio}
										step={0.001}
										onChange={(v) =>
											setDeptDraft((p) => ({
												...p,
												heSo: { ...p.heSo, patientRatio: v ?? 0.6 },
											}))
										}
									/>
									<NumberInput
										label='Số ca / ngày'
										value={deptDraft.heSo.shiftDivisor ?? 3}
										step={1}
										onChange={(v) =>
											setDeptDraft((p) => ({
												...p,
												heSo: { ...p.heSo, shiftDivisor: v ?? 3 },
											}))
										}
									/>
									<NumberInput
										label='Hệ số luân phiên'
										value={deptDraft.heSo.shiftMultiplier ?? 2}
										step={0.1}
										onChange={(v) =>
											setDeptDraft((p) => ({
												...p,
												heSo: { ...p.heSo, shiftMultiplier: v ?? 2 },
											}))
										}
									/>
								</div>
								{deptDraft.formulaType === 'standard' && (
									<div className='mrow2'>
										<NumberInput
											label='Cộng thêm cố định'
											value={deptDraft.heSo.fixedAdd ?? 0}
											step={0.5}
											onChange={(v) =>
												setDeptDraft((p) => ({
													...p,
													heSo: { ...p.heSo, fixedAdd: v ?? 0 },
												}))
											}
										/>
									</div>
								)}
							</div>
						)}

						<div className='msec'>
							<p className='msec-title'>📝 Ghi chú cấu hình TT03</p>
							<label className='fi'>
								<textarea
									className='fi-input fi-ta'
									rows={2}
									placeholder='VD: Áp dụng từ tháng 01/2024...'
									value={deptDraft.tt03Note ?? ''}
									onChange={(e) =>
										setDeptDraft((p) => ({ ...p, tt03Note: e.target.value }))
									}
								/>
							</label>
						</div>
					</>
				)}

				{/* ══ Tab Khuyến nghị ═══════════════════════════════════ */}
				{activeTab === 'rec' && (
					<>
						<div className='msec'>
							<p className='msec-title'>📋 Loại công thức khuyến nghị</p>
							<label className='fi'>
								<span className='fi-label'>Loại công thức</span>
								<select
									className='fi-input'
									value={recFormula}
									onChange={(e) =>
										setRecFormula(e.target.value as RecFormulaType)
									}
								>
									{REC_FORMULA_OPTIONS.map((o) => (
										<option
											key={o.value}
											value={o.value}
										>
											{o.label}
										</option>
									))}
								</select>
							</label>
						</div>

						{/* coef: hệ số L1/L2/L3 + cộng thêm */}
						{recFormula === 'coef' && (
							<div className='msec'>
								<p className='msec-title'>📐 Hệ số theo cấp độ NB</p>
								<p className='msec-hint'>
									= (L1 × coef_l1) + (L2 × coef_l2) + (L3 × coef_l3) + fixed_add
								</p>
								<div className='mrow3'>
									<NumberInput
										label='Hệ số L1'
										value={recHeSo.coefL1}
										step={0.001}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, coefL1: v ?? 0.5 }))
										}
									/>
									<NumberInput
										label='Hệ số L2'
										value={recHeSo.coefL2}
										step={0.001}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, coefL2: v ?? 0.104 }))
										}
									/>
									<NumberInput
										label='Hệ số L3'
										value={recHeSo.coefL3}
										step={0.001}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, coefL3: v ?? 0.104 }))
										}
									/>
								</div>
								<div className='mrow2'>
									<NumberInput
										label='Cộng thêm cố định'
										value={recHeSo.fixedAdd}
										step={0.5}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, fixedAdd: v ?? 0 }))
										}
									/>
								</div>
							</div>
						)}

						{/* coef_with_total: hệ số L1/L2/L3 + tỉ lệ tổng NB + cộng thêm */}
						{recFormula === 'coef_with_total' && (
							<div className='msec'>
								<p className='msec-title'>📐 Hệ số cấp độ + Tổng NB</p>
								<p className='msec-hint'>
									= (L1 × coef_l1) + (L2 × coef_l2) + (L3 × coef_l3) + (Tổng NB
									× outpatient_ratio) + fixed_add
								</p>
								<div className='mrow3'>
									<NumberInput
										label='Hệ số L1'
										value={recHeSo.coefL1}
										step={0.001}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, coefL1: v ?? 0.5 }))
										}
									/>
									<NumberInput
										label='Hệ số L2'
										value={recHeSo.coefL2}
										step={0.001}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, coefL2: v ?? 0.104 }))
										}
									/>
									<NumberInput
										label='Hệ số L3'
										value={recHeSo.coefL3}
										step={0.001}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, coefL3: v ?? 0.104 }))
										}
									/>
								</div>
								<div className='mrow2'>
									<NumberInput
										label='Tỉ lệ Tổng NB (outpatient_ratio)'
										value={recHeSo.outpatientRatio ?? 0}
										step={0.001}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, outpatientRatio: v ?? 0 }))
										}
									/>
									<NumberInput
										label='Cộng thêm cố định'
										value={recHeSo.fixedAdd}
										step={0.5}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, fixedAdd: v ?? 0 }))
										}
									/>
								</div>
							</div>
						)}

						{/* total_ratio / outpatient_count */}
						{(recFormula === 'total_ratio' ||
							recFormula === 'outpatient_count') && (
							<div className='msec'>
								<p className='msec-title'>📐 Tham số công thức</p>
								<p className='msec-hint'>
									{recFormula === 'total_ratio'
										? '= (L1 + L2 + L3) × outpatient_ratio + fixed_add'
										: '= outpatient_cnt × outpatient_ratio + fixed_add'}
								</p>
								<div className='mrow2'>
									<NumberInput
										label='Tỉ lệ (outpatient_ratio)'
										value={recHeSo.outpatientRatio ?? 0}
										step={0.001}
										onChange={(v) =>
											setRecHeSo((p) => ({
												...p,
												outpatientRatio: v ?? 0,
											}))
										}
									/>
									<NumberInput
										label='Cộng thêm cố định'
										value={recHeSo.fixedAdd}
										step={0.5}
										onChange={(v) =>
											setRecHeSo((p) => ({ ...p, fixedAdd: v ?? 0 }))
										}
									/>
								</div>
							</div>
						)}

						<div className='msec'>
							<p className='msec-title'>📝 Ghi chú cấu hình khuyến nghị</p>
							<label className='fi'>
								<textarea
									className='fi-input fi-ta'
									rows={2}
									placeholder='VD: Theo khuyến nghị Bộ Y tế...'
									value={recHeSo.note}
									onChange={(e) =>
										setRecHeSo((p) => ({ ...p, note: e.target.value }))
									}
								/>
							</label>
						</div>
					</>
				)}

				{apiError && <p className='login-error'>⚠️ {apiError}</p>}

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
						{saving ? '⏳ Đang lưu...' : '💾 Lưu cấu hình'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
