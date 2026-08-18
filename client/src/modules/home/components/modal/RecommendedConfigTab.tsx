import NumberInput from '@/components/ui/NumberInput';
import { REC_FORMULA_OPTIONS, type HeSoRec, type RecFormulaType } from './deptConfigTypes';

export interface RecommendedConfigTabProps {
	recFormula: RecFormulaType;
	setRecFormula: React.Dispatch<React.SetStateAction<RecFormulaType>>;
	recHeSo: HeSoRec;
	setRecHeSo: React.Dispatch<React.SetStateAction<HeSoRec>>;
}

export default function RecommendedConfigTab({
	recFormula,
	setRecFormula,
	recHeSo,
	setRecHeSo,
}: RecommendedConfigTabProps) {
	return (
		<>
			<div className='msec'>
				<p className='msec-title'>📋 Loại công thức khuyến nghị</p>
				<label className='fi'>
					<span className='fi-label'>Loại công thức</span>
					<select
						className='fi-input'
						value={recFormula}
						onChange={(e) => setRecFormula(e.target.value as RecFormulaType)}
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
							onChange={(v) => setRecHeSo((p) => ({ ...p, coefL1: v ?? 0.5 }))}
						/>
						<NumberInput
							label='Hệ số L2'
							value={recHeSo.coefL2}
							step={0.001}
							onChange={(v) => setRecHeSo((p) => ({ ...p, coefL2: v ?? 0.104 }))}
						/>
						<NumberInput
							label='Hệ số L3'
							value={recHeSo.coefL3}
							step={0.001}
							onChange={(v) => setRecHeSo((p) => ({ ...p, coefL3: v ?? 0.104 }))}
						/>
					</div>
					<div className='mrow2'>
						<NumberInput
							label='Cộng thêm cố định'
							value={recHeSo.fixedAdd}
							step={0.5}
							onChange={(v) => setRecHeSo((p) => ({ ...p, fixedAdd: v ?? 0 }))}
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
							onChange={(v) => setRecHeSo((p) => ({ ...p, coefL1: v ?? 0.5 }))}
						/>
						<NumberInput
							label='Hệ số L2'
							value={recHeSo.coefL2}
							step={0.001}
							onChange={(v) => setRecHeSo((p) => ({ ...p, coefL2: v ?? 0.104 }))}
						/>
						<NumberInput
							label='Hệ số L3'
							value={recHeSo.coefL3}
							step={0.001}
							onChange={(v) => setRecHeSo((p) => ({ ...p, coefL3: v ?? 0.104 }))}
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
							onChange={(v) => setRecHeSo((p) => ({ ...p, fixedAdd: v ?? 0 }))}
						/>
					</div>
				</div>
			)}

			{/* total_ratio / outpatient_count */}
			{(recFormula === 'total_ratio' || recFormula === 'outpatient_count') && (
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
							onChange={(v) => setRecHeSo((p) => ({ ...p, fixedAdd: v ?? 0 }))}
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
						onChange={(e) => setRecHeSo((p) => ({ ...p, note: e.target.value }))}
					/>
				</label>
			</div>
		</>
	);
}
