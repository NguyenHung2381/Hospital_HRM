import InfoIcon from '@/assets/svg/InfoIcon';
import type { FormulaType } from '@/types/commonType';
import type { DraftDept } from '@/types/staffingType';
import FormField from '../components/FormField';
import { COEF_FIELDS } from './departmentPageConstants';

export interface DeptTt03TabProps {
	draft: DraftDept;
	setField: <K extends keyof DraftDept>(key: K, val: DraftDept[K]) => void;
	formulaPreview: string;
}

export default function DeptTt03Tab({
	draft,
	setField,
	formulaPreview,
}: DeptTt03TabProps) {
	return (
		<div className='dept-heso-section'>
			<div className='dept-heso-hdr'>
				<p className='msec-title'>📐 Cấu hình TT 03/2023/TT-BYT</p>
				<span
					className='dept-heso-hint-icon'
					title='Chọn loại công thức phù hợp với đặc thù khoa'
				>
					<InfoIcon size={13} />
				</span>
			</div>

			<FormField label='Loại công thức'>
				<select
					className='fi-input'
					value={draft.formula_type}
					onChange={(e) => setField('formula_type', e.target.value as FormulaType)}
				>
					<option value='custom_coef'>
						Hệ số từng cấp (Y học cổ truyền, PHCN...)
					</option>
					<option value='standard'>Nội trú thông thường (hệ số 0.6)</option>
					<option value='icu'>Hồi sức / Chống độc (hệ số 2.0)</option>
					<option value='surgery'>Gây mê / Phẫu thuật (tính theo bàn mổ)</option>
				</select>
			</FormField>

			{draft.formula_type === 'custom_coef' && (
				<>
					<p className='msec-hint'>
						Công thức: (CSC1 × hs1) + (CSC2 × hs2) + (CSC3 × hs3) + (Tổng ×
						hst)
					</p>
					<div
						className='mrow2'
						style={{ marginTop: 8 }}
					>
						{COEF_FIELDS.map((h) => (
							<FormField
								key={h.key as string}
								label={h.label}
								hint={h.hint}
							>
								<input
									className='fi-input'
									type='number'
									step='0.001'
									min={0}
									value={draft[h.key] as number}
									onChange={(e) => setField(h.key, Number(e.target.value))}
								/>
							</FormField>
						))}
					</div>
				</>
			)}

			{draft.formula_type !== 'custom_coef' && (
				<>
					<p className='msec-hint'>
						Công thức: (Tổng NB × tỉ lệ) / số ca × nhân ca
						{draft.formula_type === 'surgery' ? ' — dùng số giường/bàn' : ''}
					</p>
					<div
						className='mrow3'
						style={{ marginTop: 8 }}
					>
						<FormField
							label='Tỉ lệ NB/ĐD'
							hint='VD: 0.6 hoặc 2.0'
						>
							<input
								className='fi-input'
								type='number'
								step='0.001'
								min={0}
								value={draft.patient_ratio}
								onChange={(e) => setField('patient_ratio', Number(e.target.value))}
							/>
						</FormField>
						<FormField
							label='Chia ca'
							hint='Thường là 3'
						>
							<input
								className='fi-input'
								type='number'
								min={1}
								value={draft.shift_divisor}
								onChange={(e) => setField('shift_divisor', Number(e.target.value))}
							/>
						</FormField>
						<FormField
							label='Nhân ca'
							hint='Thường là 2'
						>
							<input
								className='fi-input'
								type='number'
								min={1}
								value={draft.shift_multiplier}
								onChange={(e) =>
									setField('shift_multiplier', Number(e.target.value))
								}
							/>
						</FormField>
					</div>
					{draft.formula_type === 'standard' && (
						<div style={{ marginTop: 8 }}>
							<FormField
								label='Cộng thêm cố định'
								hint='VD: 9.2 cho máy lọc thận'
							>
								<input
									className='fi-input'
									type='number'
									step='0.1'
									min={0}
									value={draft.fixed_add}
									onChange={(e) => setField('fixed_add', Number(e.target.value))}
								/>
							</FormField>
						</div>
					)}
				</>
			)}

			<FormField
				label='Ghi chú công thức'
				hint='Tuỳ chọn'
			>
				<input
					className='fi-input'
					value={draft.tt03_note}
					onChange={(e) => setField('tt03_note', e.target.value)}
					placeholder='VD: 4 người/bàn mổ'
				/>
			</FormField>

			<div className='dept-heso-preview'>
				<span className='dept-heso-preview-label'>Công thức hiện tại:</span>
				<span className='dept-heso-preview-val'>{formulaPreview}</span>
			</div>
		</div>
	);
}
