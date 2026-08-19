import { useNavigate } from 'react-router-dom';
import ErrorPage from './ErrorPage';

export default function NotFoundPage() {
	const navigate = useNavigate();

	return (
		<ErrorPage
			variant='not-found'
			code='404'
			title='Không tìm thấy trang'
			message='Trang bạn đang tìm không tồn tại hoặc đã bị di chuyển. Vui lòng kiểm tra lại đường dẫn.'
			primaryAction={{ label: 'Về trang chủ', onClick: () => navigate('/', { replace: true }) }}
			secondaryAction={{ label: 'Quay lại', onClick: () => navigate(-1) }}
		/>
	);
}
