export interface DateFieldProps {
	mode: 'add' | 'edit';
	value: string;
	dateError: string;
	todayStr: string;
	onChange: (value: string) => void;
}

/** Ô chọn ngày dùng chung giữa DailyStaffingForm và CLSStaffingForm. */
export default function DateField({
	mode,
	value,
	dateError,
	todayStr,
	onChange,
}: DateFieldProps) {
	return (
		<div className='msec'>
			<p className='msec-title'>📅 Ngày</p>
			<label className='fi'>
				<span className='fi-label'>Chọn ngày</span>
				<input
					type='date'
					className={`fi-input${dateError ? ' fi-input-error' : ''}`}
					value={value}
					disabled={mode === 'edit'}
					min={mode === 'add' ? todayStr : undefined}
					onChange={(e) => onChange(e.target.value)}
				/>
				{mode === 'add' && dateError && (
					<span className='fi-error'>{dateError}</span>
				)}
				{mode === 'add' && !dateError && value && (
					<span className='fi-hint'>✅ Ngày hợp lệ — chưa có bản ghi</span>
				)}
			</label>
		</div>
	);
}
