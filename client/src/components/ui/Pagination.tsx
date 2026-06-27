interface PaginationProps {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
}

export default function Pagination({
	page,
	pageSize,
	totalItems,
	totalPages,
	onPageChange,
	onPageSizeChange,
}: PaginationProps) {
	if (totalItems === 0) return null;

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '10px 4px',
				flexWrap: 'wrap',
				gap: 8,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8,
					fontSize: '.8rem',
					color: '#64748b',
				}}
			>
				<span>Hiển thị</span>
				<select
					value={pageSize}
					onChange={(e) => onPageSizeChange(Number(e.target.value))}
					style={{
						border: '1px solid #e2e8f0',
						borderRadius: 6,
						padding: '2px 6px',
						fontSize: '.8rem',
						cursor: 'pointer',
					}}
				>
					{[10, 20, 50].map((n) => (
						<option
							key={n}
							value={n}
						>
							{n}
						</option>
					))}
				</select>
				<span>
					/ <strong>{totalItems}</strong> kết quả
				</span>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
				<button
					onClick={() => onPageChange(1)}
					disabled={page === 1}
					className={`pg-btn ${page === 1 ? 'pg-btn-disabled' : ''}`}
					style={{
						padding: '3px 8px',
						borderRadius: 6,
						border: '1px solid #e2e8f0',
						cursor: page === 1 ? 'default' : 'pointer',
					}}
				>
					«
				</button>
				<button
					onClick={() => onPageChange(Math.max(1, page - 1))}
					disabled={page === 1}
					style={{
						padding: '3px 8px',
						borderRadius: 6,
						border: '1px solid #e2e8f0',
						cursor: page === 1 ? 'default' : 'pointer',
					}}
				>
					‹
				</button>

				{/* Logic vẽ số trang có dấu 3 chấm */}
				{Array.from({ length: totalPages }, (_, i) => i + 1)
					.filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
					.reduce<(number | '...')[]>((acc, n, idx, arr) => {
						if (idx > 0 && (n as number) - (arr[idx - 1] as number) > 1)
							acc.push('...');
						acc.push(n);
						return acc;
					}, [])
					.map((n, idx) =>
						n === '...' ? (
							<span
								key={`e${idx}`}
								style={{
									padding: '3px 6px',
									fontSize: '.78rem',
									color: '#94a3b8',
								}}
							>
								…
							</span>
						) : (
							<button
								key={n}
								onClick={() => onPageChange(n as number)}
								style={{
									padding: '3px 9px',
									borderRadius: 6,
									border: '1px solid',
									borderColor: page === n ? '#0f766e' : '#e2e8f0',
									background: page === n ? '#0f766e' : 'white',
									color: page === n ? 'white' : '#475569',
									cursor: 'pointer',
									fontSize: '.78rem',
									fontWeight: page === n ? 600 : 400,
								}}
							>
								{n}
							</button>
						),
					)}

				<button
					onClick={() => onPageChange(Math.min(totalPages, page + 1))}
					disabled={page === totalPages}
					style={{
						padding: '3px 8px',
						borderRadius: 6,
						border: '1px solid #e2e8f0',
						cursor: page === totalPages ? 'default' : 'pointer',
					}}
				>
					›
				</button>
				<button
					onClick={() => onPageChange(totalPages)}
					disabled={page === totalPages}
					style={{
						padding: '3px 8px',
						borderRadius: 6,
						border: '1px solid #e2e8f0',
						cursor: page === totalPages ? 'default' : 'pointer',
					}}
				>
					»
				</button>
			</div>
		</div>
	);
}
