import NumberInput from '@/components/ui/NumberInput';
import type { ApiDept } from '@/types/apiType';
import type { RowInput } from '@/types/staffingType';

export interface CreateReportDeptFormProps {
	dept: ApiDept;
	row: RowInput;
	onFieldChange: (key: keyof RowInput, val: string) => void;
}

/** Panel nhập liệu 1 khoa trong CreateReportModal. */
export default function CreateReportDeptForm({
	dept,
	row: r,
	onFieldChange,
}: CreateReportDeptFormProps) {
	const diLam =
		(Number(r.nlTong) || 0) - (Number(r.nghiTruc) || 0) - (Number(r.nghiTren2) || 0);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 16,
			}}
		>
			<p
				style={{
					fontWeight: 700,
					fontSize: '.88rem',
					color: 'var(--p)',
					margin: 0,
					paddingBottom: 12,
					borderBottom: '1px solid var(--bdr)',
				}}
			>
				🏥 {dept.name_department}
			</p>

			<div className='msec'>
				<p className='msec-title'>Số người bệnh</p>
				<div className='mrow3'>
					<NumberInput
						label='Cấp 1 (CSC1)'
						value={r.csc1 === '' ? null : Number(r.csc1)}
						onChange={(v) => onFieldChange('csc1', v === null ? '' : String(v))}
					/>
					<NumberInput
						label='Cấp 2 (CSC2)'
						value={r.csc2 === '' ? null : Number(r.csc2)}
						onChange={(v) => onFieldChange('csc2', v === null ? '' : String(v))}
					/>
					<NumberInput
						label='Cấp 3 (CSC3)'
						value={r.csc3 === '' ? null : Number(r.csc3)}
						onChange={(v) => onFieldChange('csc3', v === null ? '' : String(v))}
					/>
				</div>
				<div className='mrow2'>
					<NumberInput
						label='NB khám / PT KH'
						value={r.nbKham === '' ? null : Number(r.nbKham)}
						onChange={(v) => onFieldChange('nbKham', v === null ? '' : String(v))}
					/>
				</div>
			</div>

			<div className='msec'>
				<p className='msec-title'>Nhân lực</p>
				<div className='mrow3'>
					<NumberInput
						label='Tổng nhân lực'
						value={r.nlTong === '' ? null : Number(r.nlTong)}
						onChange={(v) => onFieldChange('nlTong', v === null ? '' : String(v))}
					/>
					<NumberInput
						label='Nghỉ trực'
						value={r.nghiTruc === '' ? null : Number(r.nghiTruc)}
						onChange={(v) => onFieldChange('nghiTruc', v === null ? '' : String(v))}
					/>
					<NumberInput
						label='Nghỉ > 2 ngày'
						value={r.nghiTren2 === '' ? null : Number(r.nghiTren2)}
						onChange={(v) => onFieldChange('nghiTren2', v === null ? '' : String(v))}
					/>
				</div>
				<div className='auto-preview'>
					<span>🔢 Đi làm =</span>
					<span className='auto-val'>{diLam} người</span>
				</div>
			</div>

			<div className='msec'>
				<p className='msec-title'>Ghi chú</p>
				<textarea
					className='fi-input fi-ta'
					rows={2}
					value={r.note}
					onChange={(e) => onFieldChange('note', e.target.value)}
				/>
			</div>
		</div>
	);
}
