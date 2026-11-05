import { useAuth } from '@/context/useAuth';
import { useState } from 'react';

// Logic đổi mật khẩu dùng chung cho modal "Bảo mật tài khoản" và màn hình bắt
// buộc đổi mật khẩu lần đầu. Kiểm tra sơ bộ ở client; luật đầy đủ (mật khẩu
// phổ biến, chứa tên đăng nhập...) do server kiểm tra và trả thông báo.
export function usePasswordChange(onSuccess?: () => void) {
	const { user } = useAuth();
	const [oldPassword, setOldPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [saving, setSaving] = useState(false);

	const reset = () => {
		setOldPassword('');
		setNewPassword('');
		setConfirmPassword('');
		setError('');
		setSuccess('');
	};

	const validate = (): string => {
		if (!oldPassword) return 'Vui lòng nhập mật khẩu hiện tại';
		if (newPassword.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự';
		if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword))
			return 'Mật khẩu mới phải gồm cả chữ và số';
		const name = user?.taiKhoan.toLowerCase() ?? '';
		if (name.length >= 3 && newPassword.toLowerCase().includes(name))
			return 'Mật khẩu mới không được chứa tên đăng nhập';
		if (newPassword === oldPassword) return 'Mật khẩu mới phải khác mật khẩu hiện tại';
		if (newPassword !== confirmPassword) return 'Mật khẩu nhập lại không khớp';
		return '';
	};

	const submit = async () => {
		const invalid = validate();
		if (invalid) {
			setError(invalid);
			return;
		}
		if (!user?.id) {
			setError('Không xác định được tài khoản');
			return;
		}

		setSaving(true);
		setError('');
		setSuccess('');
		try {
			const res = await fetch(`/api/users/${user.id}/change-password`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
			});
			// Server tự cấp cookie phiên mới cho thiết bị này (phiên ở thiết bị khác bị huỷ)
			const data = (await res.json().catch(() => ({}))) as {
				success?: boolean;
				message?: string;
			};
			if (!data.success) {
				setError(data.message ?? 'Đổi mật khẩu thất bại');
				return;
			}
			setOldPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setSuccess('Đổi mật khẩu thành công!');
			onSuccess?.();
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	// Gõ lại vào ô nào cũng xoá thông báo lỗi cũ
	const bind = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
		setter(e.target.value);
		setError('');
	};

	return {
		user,
		oldPassword,
		newPassword,
		confirmPassword,
		onOldChange: bind(setOldPassword),
		onNewChange: bind(setNewPassword),
		onConfirmChange: bind(setConfirmPassword),
		error,
		success,
		saving,
		submit,
		reset,
	};
}
