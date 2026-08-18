import NumberInput from '@/components/ui/NumberInput';

export interface NumberGridField {
	label: string;
	value: number | null;
	onChange: (v: number | null) => void;
}

export interface NumberGridProps {
	/** Mỗi phần tử là 1 hàng (3 hoặc 2 field) — className hàng lấy theo số field. */
	rows: NumberGridField[][];
}

/** Lưới NumberInput chia theo hàng 3 (hoặc 2) cột, dùng cho các form nhập số liệu lặp lại. */
export default function NumberGrid({ rows }: NumberGridProps) {
	return (
		<>
			{rows.map((row, i) => (
				<div
					key={i}
					className={row.length === 2 ? 'mrow2' : 'mrow3'}
				>
					{row.map((field) => (
						<NumberInput
							key={field.label}
							label={field.label}
							value={field.value}
							onChange={field.onChange}
						/>
					))}
				</div>
			))}
		</>
	);
}
