import ErrorPage from './ErrorPage';

export default function ServiceUnavailablePage() {
	return (
		<ErrorPage
			variant='service-unavailable'
			code='503'
			title='Hệ thống đang bảo trì'
			message='Dịch vụ tạm thời không khả dụng do đang bảo trì hoặc quá tải. Vui lòng quay lại sau ít phút.'
			primaryAction={{ label: 'Thử lại', onClick: () => window.location.reload() }}
			secondaryAction={{ label: 'Về trang chủ', onClick: () => (window.location.href = '/') }}
		/>
	);
}
