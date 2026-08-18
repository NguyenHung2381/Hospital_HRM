import type { RecommendedFormulaType } from '@/types/commonType';
import FormField from '../components/FormField';
import { REC_FORMULA_OPTIONS, type DraftRec } from './departmentPageConstants';

export interface DeptRecTabProps {
	draftRec: DraftRec;
	setRecField: <K extends keyof DraftRec>(key: K, val: DraftRec[K]) => void;
}

export default function DeptRecTab({ draftRec, setRecField }: DeptRecTabProps) {
	const recOption = REC_FORMULA_OPTIONS.find(
		(o) => o.value === draftRec.formula_type,
	);

	return (
		<>
			<FormField label='Loại công thức khuyến nghị'>
				<select
					className='fi-input'
					value={draftRec.formula_type}
					onChange={(e) =>
						setRecField('formula_type', e.target.value as RecommendedFormulaType)
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
			</FormField>

			{recOption && <p className='msec-hint'>{recOption.hint}</p>}

			{/* coef: L1/L2/L3 + fixed_add */}
			{draftRec.formula_type === 'coef' && (
				<>
					<div className='mrow3'>
						<FormField
							label='Hệ số L1'
							hint='Nặng / Nguy kịch'
						>
							<input
								className='fi-input'
								type='number'
								step='0.001'
								min={0}
								value={draftRec.coef_l1}
								onChange={(e) => setRecField('coef_l1', Number(e.target.value))}
							/>
						</FormField>
						<FormField
							label='Hệ số L2'
							hint='Trung bình'
						>
							<input
								className='fi-input'
								type='number'
								step='0.001'
								min={0}
								value={draftRec.coef_l2}
								onChange={(e) => setRecField('coef_l2', Number(e.target.value))}
							/>
						</FormField>
						<FormField
							label='Hệ số L3'
							hint='Nhẹ / Ổn định'
						>
							<input
								className='fi-input'
								type='number'
								step='0.001'
								min={0}
								value={draftRec.coef_l3}
								onChange={(e) => setRecField('coef_l3', Number(e.target.value))}
							/>
						</FormField>
					</div>
					<div className='mrow2'>
						<FormField label='Cộng thêm cố định'>
							<input
								className='fi-input'
								type='number'
								step='0.1'
								min={0}
								value={draftRec.fixed_add}
								onChange={(e) => setRecField('fixed_add', Number(e.target.value))}
							/>
						</FormField>
					</div>
				</>
			)}

			{/* coef_with_total: L1/L2/L3 + outpatient_ratio + fixed_add */}
			{draftRec.formula_type === 'coef_with_total' && (
				<>
					<div className='mrow3'>
						<FormField
							label='Hệ số L1'
							hint='Nặng / Nguy kịch'
						>
							<input
								className='fi-input'
								type='number'
								step='0.001'
								min={0}
								value={draftRec.coef_l1}
								onChange={(e) => setRecField('coef_l1', Number(e.target.value))}
							/>
						</FormField>
						<FormField
							label='Hệ số L2'
							hint='Trung bình'
						>
							<input
								className='fi-input'
								type='number'
								step='0.001'
								min={0}
								value={draftRec.coef_l2}
								onChange={(e) => setRecField('coef_l2', Number(e.target.value))}
							/>
						</FormField>
						<FormField
							label='Hệ số L3'
							hint='Nhẹ / Ổn định'
						>
							<input
								className='fi-input'
								type='number'
								step='0.001'
								min={0}
								value={draftRec.coef_l3}
								onChange={(e) => setRecField('coef_l3', Number(e.target.value))}
							/>
						</FormField>
					</div>
					<div className='mrow2'>
						<FormField
							label='Tỉ lệ Tổng NB (outpatient_ratio)'
							hint='VD: 0.12'
						>
							<input
								className='fi-input'
								type='number'
								step='0.001'
								min={0}
								value={draftRec.outpatient_ratio ?? ''}
								placeholder='Nhập tỉ lệ...'
								onChange={(e) =>
									setRecField(
										'outpatient_ratio',
										e.target.value === '' ? null : Number(e.target.value),
									)
								}
							/>
						</FormField>
						<FormField label='Cộng thêm cố định'>
							<input
								className='fi-input'
								type='number'
								step='0.1'
								min={0}
								value={draftRec.fixed_add}
								onChange={(e) => setRecField('fixed_add', Number(e.target.value))}
							/>
						</FormField>
					</div>
				</>
			)}

			{/* total_ratio / outpatient_count: outpatient_ratio + fixed_add */}
			{(draftRec.formula_type === 'total_ratio' ||
				draftRec.formula_type === 'outpatient_count') && (
				<div className='mrow2'>
					<FormField
						label='Tỉ lệ (outpatient_ratio)'
						hint='VD: 0.15'
					>
						<input
							className='fi-input'
							type='number'
							step='0.001'
							min={0}
							value={draftRec.outpatient_ratio ?? ''}
							placeholder='Nhập tỉ lệ...'
							onChange={(e) =>
								setRecField(
									'outpatient_ratio',
									e.target.value === '' ? null : Number(e.target.value),
								)
							}
						/>
					</FormField>
					<FormField label='Cộng thêm cố định'>
						<input
							className='fi-input'
							type='number'
							step='0.1'
							min={0}
							value={draftRec.fixed_add}
							onChange={(e) => setRecField('fixed_add', Number(e.target.value))}
						/>
					</FormField>
				</div>
			)}

			{/* fixed: chỉ cần fixed_add */}
			{draftRec.formula_type === 'fixed' && (
				<div className='mrow2'>
					<FormField
						label='Nhân lực khuyến cáo'
						hint='Số cố định, VD: 32'
					>
						<input
							className='fi-input'
							type='number'
							step='0.1'
							min={0}
							value={draftRec.fixed_add}
							onChange={(e) => setRecField('fixed_add', Number(e.target.value))}
						/>
					</FormField>
				</div>
			)}

			<FormField
				label='Ghi chú'
				hint='Tuỳ chọn'
			>
				<input
					className='fi-input'
					value={draftRec.note}
					onChange={(e) => setRecField('note', e.target.value)}
					placeholder='VD: Theo khuyến nghị Bộ Y tế...'
				/>
			</FormField>
		</>
	);
}
