import ErrorPage from './ErrorPage';

export default function BadGatewayPage() {
	return (
		<ErrorPage
			variant='bad-gateway'
			code='502'
			title='Lỗi cổng kết nối'
			message='Máy chủ đang gặp sự cố khi kết nối tới hệ thống backend. Vui lòng thử tải lại trang sau ít phút.'
			primaryAction={{ label: 'Tải lại trang', onClick: () => window.location.reload() }}
			secondaryAction={{ label: 'Về trang chủ', onClick: () => (window.location.href = '/') }}
		/>
	);
}
