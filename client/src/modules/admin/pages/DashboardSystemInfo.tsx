export interface DashboardSystemInfoProps {
	rowsCount: number;
	khoaDuCount: number;
	khoaThieuCount: number;
}

export default function DashboardSystemInfo({
	rowsCount,
	khoaDuCount,
	khoaThieuCount,
}: DashboardSystemInfoProps) {
	return (
		<section className='hcard hcard-full'>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
					gap: 24,
					alignItems: 'stretch',
				}}
			>
				{/* ── Khối 1: Thông tin hệ thống ── */}
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<h3 className='hcard-title' style={{ marginBottom: 12 }}>
						ℹ️ Thông tin hệ thống
					</h3>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(2, 1fr)',
							gap: 10,
							flex: 1,
						}}
					>
						{[
							['Đơn vị', 'Bệnh viện Hữu nghị Đa khoa Nghệ An'],
							['Chuẩn tính toán', 'TT 03/2023/TT-BYT'],
							['Phiên bản', '1.1.0'],
							['Cập nhật', new Date().toLocaleDateString('vi-VN')],
						].map(([k, v]) => (
							<div
								key={k}
								style={{
									display: 'flex',
									flexDirection: 'column',
									gap: 4,
									padding: '10px 12px',
									background: '#f8fafc',
									borderRadius: 8,
									border: '1px solid #e2e8f0',
								}}
							>
								<span
									style={{
										fontSize: '.68rem',
										color: '#64748b',
										fontWeight: 600,
										textTransform: 'uppercase',
										letterSpacing: '0.04em',
									}}
								>
									{k}
								</span>
								<span
									style={{
										fontSize: '.8rem',
										fontWeight: 700,
										color: '#1e293b',
										lineHeight: 1.3,
									}}
								>
									{v}
								</span>
							</div>
						))}
					</div>
				</div>

				{/* ── Khối 2: Tổng quan khoa ── */}
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<h3 className='hcard-title' style={{ marginBottom: 12 }}>
						📊 Tổng quan khối Lâm sàng
					</h3>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(3, 1fr)',
							gap: 10,
							flex: 1,
						}}
					>
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								padding: '12px 10px',
								background: '#f0faf4',
								borderRadius: 10,
								border: '1px solid #bbf7d0',
								textAlign: 'center',
							}}
						>
							<span style={{ fontSize: '.72rem', color: '#166534', fontWeight: 650 }}>
								Tổng số khoa
							</span>
							<p style={{ fontSize: '1.6rem', fontWeight: 850, color: '#15803d', margin: '4px 0 0' }}>
								{rowsCount}
							</p>
							<span style={{ fontSize: '.65rem', color: '#166534', marginTop: 2 }}>khoa active</span>
						</div>

						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								padding: '12px 10px',
								background: '#ecfdf5',
								borderRadius: 10,
								border: '1px solid #a7f3d0',
								textAlign: 'center',
							}}
						>
							<span style={{ fontSize: '.72rem', color: '#047857', fontWeight: 650 }}>
								Đủ nhân lực
							</span>
							<p style={{ fontSize: '1.6rem', fontWeight: 850, color: '#059669', margin: '4px 0 0' }}>
								{khoaDuCount}
							</p>
							<span style={{ fontSize: '.65rem', color: '#047857', marginTop: 2 }}>khoa đáp ứng</span>
						</div>

						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								padding: '12px 10px',
								background: '#fef2f2',
								borderRadius: 10,
								border: '1px solid #fecaca',
								textAlign: 'center',
							}}
						>
							<span style={{ fontSize: '.72rem', color: '#b91c1c', fontWeight: 650 }}>
								Thiếu nhân lực
							</span>
							<p style={{ fontSize: '1.6rem', fontWeight: 850, color: '#dc2626', margin: '4px 0 0' }}>
								{khoaThieuCount}
							</p>
							<span style={{ fontSize: '.65rem', color: '#b91c1c', marginTop: 2 }}>khoa cần bù</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
