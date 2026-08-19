import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import ErrorPage from './ErrorPage';

// Bắt lỗi phát sinh trong quá trình render/loader của router (dùng làm errorElement).
export default function RouteErrorPage() {
	const error = useRouteError();
	const navigate = useNavigate();

	if (isRouteErrorResponse(error) && error.status === 404) {
		return (
			<ErrorPage
				variant='not-found'
				code='404'
				title='Không tìm thấy trang'
				message='Trang bạn đang tìm không tồn tại hoặc đã bị di chuyển.'
				primaryAction={{ label: 'Về trang chủ', onClick: () => navigate('/', { replace: true }) }}
			/>
		);
	}

	return (
		<ErrorPage
			variant='bad-gateway'
			code='Lỗi'
			title='Đã có lỗi xảy ra'
			message='Ứng dụng gặp sự cố ngoài ý muốn. Vui lòng tải lại trang hoặc quay về trang chủ.'
			primaryAction={{ label: 'Tải lại trang', onClick: () => window.location.reload() }}
			secondaryAction={{ label: 'Về trang chủ', onClick: () => navigate('/', { replace: true }) }}
		/>
	);
}
