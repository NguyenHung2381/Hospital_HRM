import type { KhoaItem } from '@/types/staffingType';

export default function DeptSelector({
	khoaList,
	activeId,
	onChange,
}: {
	khoaList: KhoaItem[];
	activeId: number;
	onChange: (k: KhoaItem) => void;
}) {
	if (khoaList.length === 0) {
		return (
			<div className='ds-empty'>
				<span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>
					Chưa có khoa được phân quyền
				</span>
			</div>
		);
	}

	if (khoaList.length === 1) {
		return (
			<div className='ds-single'>
				<svg
					className='ds-single-ico'
					width='14'
					height='14'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='2.5'
					strokeLinecap='round'
					strokeLinejoin='round'
				>
					<path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' />
					<polyline points='9 22 9 12 15 12 15 22' />
				</svg>
				<div className='ds-single-info'>
					<span className='ds-single-lbl'>Khoa của bạn</span>
					<span className='ds-single-name'>{khoaList[0].ten}</span>
				</div>
			</div>
		);
	}

	return (
		<div className='ds-wrap'>
			<label
				className='ds-label'
				htmlFor='khoa-select'
			>
				<svg
					width='12'
					height='12'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='2.5'
					strokeLinecap='round'
					strokeLinejoin='round'
				>
					<path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' />
				</svg>
				Chọn khoa
			</label>
			<div className='ds-select-wrap'>
				<select
					id='khoa-select'
					className='ds-select'
					value={activeId}
					onChange={(e) => {
						const k = khoaList.find((x) => x.id === Number(e.target.value));
						if (k) onChange(k);
					}}
				>
					{khoaList.map((k) => (
						<option
							key={k.id}
							value={k.id}
						>
							{k.ten}
						</option>
					))}
				</select>
				<svg
					className='ds-select-chevron'
					width='14'
					height='14'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='2.5'
					strokeLinecap='round'
					strokeLinejoin='round'
				>
					<polyline points='6 9 12 15 18 9' />
				</svg>
			</div>
		</div>
	);
}
