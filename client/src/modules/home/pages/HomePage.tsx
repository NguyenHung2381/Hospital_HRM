import { useAppSSE } from '@/hooks/useAppSSE';
import { useAuth } from '@/context/useAuth';
import MainLayout from '@/layouts/MainLayout';
import '@/styles/main.css';
import { useCallback, useState } from 'react';
import DailyStaffingBoard from '../components/DailyStaffingBoard';

export default function HomePage() {
	const { user, khoaList, refresh } = useAuth();

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
			onEditDept={() => setShowDeptModal(true)}
			onReport={() => setShowReportModal(true)}
			onChangePassword={() => setShowPasswordModal(true)}
		>
			<DailyStaffingBoard
				userKhoa={khoaList}
				onDeptNameChange={setDeptName}
				onGiuongMayChange={setGiuongMay}
				showDeptModal={showDeptModal}
				onCloseDeptModal={() => setShowDeptModal(false)}
				showReportModal={showReportModal}
				onCloseReportModal={() => setShowReportModal(false)}
				showPasswordModal={showPasswordModal}
				onClosePasswordModal={() => setShowPasswordModal(false)}
			/>
		</MainLayout>
	);
}
