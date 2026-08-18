import NumberInput from '@/components/ui/NumberInput';
import type { FormulaType } from '@/types/commonType';
import type { DeptConfig } from '@/types/staffingType';

export interface Tt03ConfigTabProps {
	deptDraft: DeptConfig;
	setDeptDraft: React.Dispatch<React.SetStateAction<DeptConfig>>;
}

export default function Tt03ConfigTab({
	deptDraft,
	setDeptDraft,
}: Tt03ConfigTabProps) {
	return (
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
	);
}
