export interface DataPagerProps {
	page: number;
	setPage: (p: number | ((prev: number) => number)) => void;
	pageSize: number;
	setPageSize: (n: number) => void;
	totalPages: number;
	totalItems: number;
}

/** Điều khiển phân trang bảng dữ liệu (DataPage). */
export default function DataPager({
	page,
	setPage,
	pageSize,
	setPageSize,
	totalPages,
	totalItems,
}: DataPagerProps) {
	return (
		<div className='dv-pager'>
			<div className='dv-pager-info'>
				Hiển thị{' '}
				<strong>
					{Math.min((page - 1) * pageSize + 1, totalItems)}–
					{Math.min(page * pageSize, totalItems)}
				</strong>{' '}
				trong <strong>{totalItems}</strong> khoa
			</div>
			<div className='dv-pager-nav'>
				<button
					className='dv-pager-btn'
					onClick={() => setPage(1)}
					disabled={page === 1}
					title='Trang đầu'
				>
					«
				</button>
				<button
					className='dv-pager-btn'
					onClick={() => setPage((p) => Math.max(1, p - 1))}
					disabled={page === 1}
					title='Trang trước'
				>
					‹
				</button>
				{Array.from({ length: totalPages }, (_, i) => i + 1)
					.filter(
						(p) =>
							totalPages <= 7 ||
							p === 1 ||
							p === totalPages ||
							Math.abs(p - page) <= 1,
					)
					.reduce<(number | '...')[]>((acc, p, idx, arr) => {
						if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1)
							acc.push('...');
						acc.push(p);
						return acc;
					}, [])
					.map((p, idx) =>
						p === '...' ? (
							<span
								key={`dot-${idx}`}
								className='dv-pager-dots'
							>
								…
							</span>
						) : (
							<button
								key={p}
								className={`dv-pager-btn${p === page ? ' dv-pager-btn-active' : ''}`}
								onClick={() => setPage(p as number)}
							>
								{p}
							</button>
						),
					)}
				<button
					className='dv-pager-btn'
					onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
					disabled={page === totalPages}
					title='Trang sau'
				>
					›
				</button>
				<button
					className='dv-pager-btn'
					onClick={() => setPage(totalPages)}
					disabled={page === totalPages}
					title='Trang cuối'
				>
					»
				</button>
			</div>
			<div className='dv-pager-size'>
				<span>Hiển thị</span>
				<select
					className='dv-pager-select'
					value={pageSize}
					onChange={(e) => setPageSize(Number(e.target.value))}
				>
					{[10, 15, 20, 36].map((s) => (
						<option
							key={s}
							value={s}
						>
							{s} khoa/trang
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
