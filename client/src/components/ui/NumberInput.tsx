export default function NumberInput({
	label,
	value,
	onChange,
	step = 'any',
	hint,
}: {
	label: string;
	value: number | null;
	onChange: (v: number | null) => void;
	step?: number | 'any';
	hint?: string;
}) {
	return (
		<label className='fi'>
			<span className='fi-label'>{label}</span>
			{hint && <span className='fi-hint'>{hint}</span>}
			<input
				type='number'
				step={step}
				className='fi-input'
				value={value ?? ''}
				onChange={(e) =>
					onChange(e.target.value === '' ? null : Number(e.target.value))
				}
			/>
		</label>
	);
}
