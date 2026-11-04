import { ChartColumn, Info } from 'lucide-react';
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
						<Info size={16} /> Thông tin hệ thống
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
									background: 'var(--color-gray-50)',
									borderRadius: 8,
									border: '1px solid var(--bdr)',
								}}
							>
								<span
									style={{
										fontSize: '.72rem',
										color: 'var(--color-gray-500)',
										fontWeight: 600,
										
									}}
								>
									{k}
								</span>
								<span
									style={{
										fontSize: '.8rem',
										fontWeight: 700,
										color: 'var(--color-gray-800)',
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
						<ChartColumn size={16} /> Tổng quan khối Lâm sàng
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
								background: 'var(--sur)',
								borderRadius: 8,
								border: '1px solid var(--bdr)',
								textAlign: 'center',
							}}
						>
							<span style={{ fontSize: '.72rem', color: 'var(--pd)', fontWeight: 600 }}>
								Tổng số khoa
							</span>
							<p style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--pd)', margin: '4px 0 0' }}>
								{rowsCount}
							</p>
							<span style={{ fontSize: '.72rem', color: 'var(--pd)', marginTop: 2 }}>khoa active</span>
						</div>

						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								padding: '12px 10px',
								background: 'var(--sur)',
								borderRadius: 8,
								border: '1px solid var(--bdr)',
								textAlign: 'center',
							}}
						>
							<span style={{ fontSize: '.72rem', color: 'var(--pd)', fontWeight: 600 }}>
								Đủ nhân lực
							</span>
							<p style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--p)', margin: '4px 0 0' }}>
								{khoaDuCount}
							</p>
							<span style={{ fontSize: '.72rem', color: 'var(--pd)', marginTop: 2 }}>khoa đáp ứng</span>
						</div>

						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								padding: '12px 10px',
								background: 'var(--sur)',
								borderRadius: 8,
								border: '1px solid var(--bdr)',
								textAlign: 'center',
							}}
						>
							<span style={{ fontSize: '.72rem', color: 'var(--color-error-dark)', fontWeight: 600 }}>
								Thiếu nhân lực
							</span>
							<p style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--color-error)', margin: '4px 0 0' }}>
								{khoaThieuCount}
							</p>
							<span style={{ fontSize: '.72rem', color: 'var(--color-error-dark)', marginTop: 2 }}>khoa cần bù</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
