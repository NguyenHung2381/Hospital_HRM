import ModalForm from '@/components/common/ModalForm';
import type { ApiDept, ApiRole } from '@/types/apiType';
import type { UserDraft } from '@/types/userType';
import FormField from '../components/FormField';

export interface AccountFormModalProps {
	mode: 'add' | 'edit';
	draft: UserDraft;
	setDraft: React.Dispatch<React.SetStateAction<UserDraft>>;
	depts: ApiDept[];
	roles: ApiRole[];
	selectedRole: ApiRole | undefined;
	error: string;
	saving: boolean;
	onClose: () => void;
	onSave: () => void;
}

export default function AccountFormModal({
	mode,
	draft,
	setDraft,
	depts,
	roles,
	selectedRole,
	error,
	saving,
	onClose,
	onSave,
}: AccountFormModalProps) {
	return (
		<ModalForm
			title={mode === 'add' ? '＋ Thêm tài khoản' : '✏️ Sửa tài khoản'}
			onClose={onClose}
			wide
		>
			<div className='mform'>
				{error && <p className='login-error'>⚠️ {error}</p>}

				<div className='mrow2'>
					<FormField label='Họ và tên *'>
						<input
							className='fi-input'
							value={draft.full_name}
							onChange={(e) =>
								setDraft((p) => ({ ...p, full_name: e.target.value }))
							}
						/>
					</FormField>
					<FormField label='Mã nhân viên'>
						<input
							className='fi-input'
							value={draft.user_code}
							onChange={(e) =>
								setDraft((p) => ({ ...p, user_code: e.target.value }))
							}
						/>
					</FormField>
				</div>

				<div className='mrow2'>
					<FormField label='Tên đăng nhập *'>
						<input
							className='fi-input'
							value={draft.username}
							disabled={mode === 'edit'}
							onChange={(e) =>
								setDraft((p) => ({ ...p, username: e.target.value }))
							}
						/>
					</FormField>
					{mode === 'add' && (
						<FormField label='Mật khẩu *'>
							<input
								className='fi-input'
								type='password'
								value={draft.password}
								onChange={(e) =>
									setDraft((p) => ({ ...p, password: e.target.value }))
								}
							/>
						</FormField>
					)}
				</div>

				<div className='mrow2'>
					<FormField label='Khoa / Phòng'>
						<select
							className='fi-input'
							value={draft.id_department ?? ''}
							onChange={(e) =>
								setDraft((p) => ({
									...p,
									id_department:
										e.target.value === '' ? null : Number(e.target.value),
								}))
							}
						>
							<option value=''>-- Chọn khoa --</option>
							{depts.map((d) => (
								<option
									key={d.id_department}
									value={d.id_department}
								>
									{d.name_department}
								</option>
							))}
						</select>
					</FormField>
					<FormField label='Chức vụ'>
						<input
							className='fi-input'
							value={draft.position}
							onChange={(e) =>
								setDraft((p) => ({ ...p, position: e.target.value }))
							}
						/>
					</FormField>
				</div>

				<div className='mrow2'>
					<FormField label='Vai trò *'>
						<select
							className='fi-input'
							value={draft.id_role ?? ''}
							onChange={(e) =>
								setDraft((p) => ({
									...p,
									id_role: e.target.value === '' ? null : Number(e.target.value),
								}))
							}
						>
							<option value=''>-- Chọn vai trò --</option>
							{roles.map((r) => (
								<option
									key={r.id_role}
									value={r.id_role}
								>
									{r.icon} {r.name_role}
								</option>
							))}
						</select>
					</FormField>
					<FormField label='Trạng thái'>
						<select
							className='fi-input'
							value={draft.status}
							onChange={(e) =>
								setDraft((p) => ({
									...p,
									status: e.target.value as 'active' | 'inactive',
								}))
							}
						>
							<option value='active'>Hoạt động</option>
							<option value='inactive'>Tạm khoá</option>
						</select>
					</FormField>
				</div>

				{selectedRole && (
					<div className='acc-role-hint'>
						{selectedRole.department_access_type === 'all' && (
							<>
								<span>🏥</span> Xem toàn bộ khoa — không cần phân thêm
							</>
						)}
						{selectedRole.department_access_type === 'assigned' && (
							<>
								<span>🗂️</span> Cần phân khoa cụ thể — bước tiếp theo sẽ chọn
								khoa và quyền
							</>
						)}
						{selectedRole.department_access_type === 'own' && (
							<>
								<span>👤</span> Tự động xem khoa công tác của mình
							</>
						)}
					</div>
				)}

				<div className='mfooter'>
					<button
						className='btn-ghost'
						onClick={onClose}
						disabled={saving}
					>
						Huỷ
					</button>
					<button
						className='btn-primary'
						onClick={onSave}
						disabled={saving}
					>
						{saving
							? '⏳ Đang lưu...'
							: selectedRole?.department_access_type === 'assigned'
								? 'Tiếp theo →'
								: '💾 Lưu'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
