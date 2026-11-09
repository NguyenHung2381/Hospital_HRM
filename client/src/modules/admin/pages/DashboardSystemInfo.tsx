/** Dòng thông tin tham chiếu cuối trang — không lặp lại số liệu đã có ở trên. */
export default function DashboardSystemInfo() {
	return (
		<dl className='sys-foot'>
			{[
				['Đơn vị', 'Bệnh viện Hữu nghị Đa khoa Nghệ An'],
				['Chuẩn tính toán', 'TT 03/2023/TT-BYT'],
				['Phiên bản', __APP_VERSION__],
			].map(([k, v]) => (
				<div key={k}>
					<dt>{k}</dt>
					<dd>{v}</dd>
				</div>
			))}
		</dl>
	);
}
