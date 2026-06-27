export interface CurrentUser {
	hoTen: string;
	chucVu: string;
	khoa: string;
}

export interface MainLayoutProps {
	hospitalName?: string;
	deptName?: string;
	giuongMay?: number | null;
	currentUser: CurrentUser;
	onEditDept?: () => void;
	onReport?: () => void;
	onChangePassword?: () => void;
	children: React.ReactNode;
}
