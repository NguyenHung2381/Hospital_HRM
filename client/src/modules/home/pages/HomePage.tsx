import { BedDouble, FlaskConical } from 'lucide-react';
import { useAppSSE } from '@/hooks/useAppSSE';
import { useAuth } from '@/context/useAuth';
import MainLayout from '@/layouts/MainLayout';
import '@/styles/main.css';
import { useCallback, useMemo, useState } from 'react';
import DailyStaffingBoard from '../components/DailyStaffingBoard';
import CLSStaffingBoard from '../components/CLSStaffingBoard';

export default function HomePage() {
	const { user, khoaList, refresh, loadError } = useAuth();

	const wardKhoa = useMemo(
		() => khoaList.filter((k) => k.deptGroup !== 'cls'),
		[khoaList],
	);
	const clsKhoa = useMemo(
		() => khoaList.filter((k) => k.deptGroup === 'cls'),
		[khoaList],
	);
	// Hầu hết user chỉ thuộc 1 nhóm khoa; chỉ cần chuyển tab khi hiếm khi
	// tài khoản (vd: được cấp quyền 'all') có cả khoa nội trú lẫn khoa CLS.
	const showGroupTabs = wardKhoa.length > 0 && clsKhoa.length > 0;

	// null = user chưa tự chọn tab → tính mặc định ngay trong render dựa
	// trên khoaList (khoaList tải bất đồng bộ nên không thể chốt cứng lúc
	// khởi tạo state). Một khi user bấm tab, lựa chọn đó luôn được giữ
	// nguyên bất kể khoaList có refetch lại sau đó (SSE, đổi mật khẩu...).
	const [manualGroup, setManualGroup] = useState<'ward' | 'cls' | null>(null);
	const activeGroup = manualGroup ?? (wardKhoa.length > 0 ? 'ward' : 'cls');

	const groupKhoa = activeGroup === 'ward' ? wardKhoa : clsKhoa;

	// undefined = chưa đổi khoa → header hiện khoa đầu tiên của nhóm đang mở
	const [deptName, setDeptName] = useState<string>();
	const [giuongMay, setGiuongMay] = useState<number | null>();
	const switchGroup = (g: 'ward' | 'cls') => {
		setManualGroup(g);
		setDeptName(undefined);
		setGiuongMay(undefined);
	};
	const [showDeptModal, setShowDeptModal] = useState(false);
	const [showReportModal, setShowReportModal] = useState(false);
	const [showPasswordModal, setShowPasswordModal] = useState(false);

	useAppSSE(
		useCallback(
			(payload) => {
				if (
					payload.resource === 'departments' ||
					payload.resource === 'users'
				) {
					refresh();
				}
			},
			[refresh],
		),
	);

	if (!user) return null;

	return (
		<MainLayout
			deptName={deptName ?? groupKhoa[0]?.ten ?? ''}
			giuongMay={
				activeGroup === 'cls'
					? null
					: giuongMay !== undefined
						? giuongMay
						: (groupKhoa[0]?.giuong ?? null)
			}
			currentUser={user}
			onEditDept={
				activeGroup === 'cls' ? undefined : () => setShowDeptModal(true)
			}
			onReport={() => setShowReportModal(true)}
			onChangePassword={() => setShowPasswordModal(true)}
		>
			<div className='home-tabs-wrap'>
				{loadError && (
					<div className='api-error-banner'>
						{loadError}{' '}
						<button
							className='btn-ghost'
							onClick={refresh}
						>
							Thử lại
						</button>
					</div>
				)}
				{showGroupTabs && (
					<div className='home-tabs-bar-wrap'>
						<div className='tab-bar'>
							<button
								className={`tab-btn${activeGroup === 'ward' ? ' tab-btn--active' : ''}`}
								onClick={() => switchGroup('ward')}
							>
								<BedDouble size={15} /> Khoa nội trú
							</button>
							<button
								className={`tab-btn${activeGroup === 'cls' ? ' tab-btn--active' : ''}`}
								onClick={() => switchGroup('cls')}
							>
								<FlaskConical size={15} /> Hệ Cận lâm sàng
							</button>
						</div>
					</div>
				)}

				<div className='home-tabs-row'>
					{activeGroup === 'ward' ? (
						// key: danh sách khoa tải bất đồng bộ → mount lại khi có khoa
						// để state khởi tạo đúng khoa đầu tiên (thay cho setState trong effect)
						<DailyStaffingBoard
							key={wardKhoa[0]?.id ?? 0}
							userKhoa={wardKhoa}
							onDeptNameChange={setDeptName}
							onGiuongMayChange={setGiuongMay}
							showDeptModal={showDeptModal}
							onCloseDeptModal={() => setShowDeptModal(false)}
							showReportModal={showReportModal}
							onCloseReportModal={() => setShowReportModal(false)}
							showPasswordModal={showPasswordModal}
							onClosePasswordModal={() => setShowPasswordModal(false)}
						/>
					) : (
						<CLSStaffingBoard
							key={clsKhoa[0]?.id ?? 0}
							userKhoa={clsKhoa}
							onDeptNameChange={setDeptName}
							showReportModal={showReportModal}
							onCloseReportModal={() => setShowReportModal(false)}
							showPasswordModal={showPasswordModal}
							onClosePasswordModal={() => setShowPasswordModal(false)}
						/>
					)}
				</div>
			</div>
		</MainLayout>
	);
}
