import { useAppSSE } from '@/hooks/useAppSSE';
import { useAuth } from '@/context/useAuth';
import MainLayout from '@/layouts/MainLayout';
import '@/styles/main.css';
import { useCallback, useMemo, useState } from 'react';
import DailyStaffingBoard from '../components/DailyStaffingBoard';
import CLSStaffingBoard from '../components/CLSStaffingBoard';

export default function HomePage() {
	const { user, khoaList, refresh } = useAuth();

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

	const [deptName, setDeptName] = useState(
		khoaList.length > 0 ? khoaList[0].ten : '',
	);
	const [giuongMay, setGiuongMay] = useState<number | null>(null);
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
			deptName={deptName}
			giuongMay={giuongMay}
			currentUser={user}
			onEditDept={
				activeGroup === 'cls' ? undefined : () => setShowDeptModal(true)
			}
			onReport={() => setShowReportModal(true)}
			onChangePassword={() => setShowPasswordModal(true)}
		>
			<div className='home-tabs-wrap'>
				{showGroupTabs && (
					<div className='home-tabs-bar-wrap'>
						<div className='tab-bar'>
							<button
								className={`tab-btn${activeGroup === 'ward' ? ' tab-btn--active' : ''}`}
								onClick={() => setManualGroup('ward')}
							>
								🏥 Khối nội trú
							</button>
							<button
								className={`tab-btn${activeGroup === 'cls' ? ' tab-btn--active' : ''}`}
								onClick={() => setManualGroup('cls')}
							>
								🧪 Hệ Cận lâm sàng
							</button>
						</div>
					</div>
				)}

				<div className='home-tabs-row'>
					{activeGroup === 'ward' ? (
						<DailyStaffingBoard
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
