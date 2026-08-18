import CheckIcon from '@/assets/svg/CheckIcon';
import PlusIcon from '@/assets/svg/PlusIcon';
import ModalForm from '@/components/common/ModalForm';
import useRoles from '@/hooks/useRoles';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import type { ApiRole } from '@/types/apiType';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import PermissionGrid from './PermissionGrid';
import RoleFormModal from './RoleFormModal';
import RolesList from './RolesList';

export default function PermissionPage() {
	// ── Sử dụng custom hook lấy danh sách Roles ──
	const { roles, setRoles, loadingRoles, refetchRoles } = useRoles();

	const {
		allPerms,
		activeRoleId,
		setActiveRoleId,
		saving,
		saved,
		editPerms,
		activeRole,
		canEdit,
		togglePerm,
		handleSavePerms,
	} = useRolePermissions(roles, setRoles);

	const [modal, setModal] = useState<'add' | 'edit' | 'del' | null>(null);
	const [draft, setDraft] = useState<Partial<ApiRole>>({});

	const openAdd = () => {
		setDraft({
			name_role: '',
			description: '',
			icon: '👥',
			color: 'teal',
			is_system: false,
			department_access_type: 'assigned',
		});
		setModal('add');
	};

	const openEdit = () => {
		if (!activeRole) return;
		setDraft({ ...activeRole });
		setModal('edit');
	};

	const saveRoleModal = async () => {
		const isAdd = modal === 'add';
		const url = isAdd ? `/api/roles` : `/api/roles/${activeRoleId}`;
		try {
			await fetch(url, {
				method: isAdd ? 'POST' : 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: draft.name_role,
					description: draft.description,
					icon: draft.icon,
					color: draft.color,
					department_access_type: draft.department_access_type,
				}),
			});
			// Gọi hàm refetchRoles từ hook để cập nhật danh sách
			await refetchRoles();
			setModal(null);
		} catch {
			/* bỏ qua */
		}
	};

	const deleteRole = async () => {
		if (!activeRoleId) return;
		try {
			await fetch(`/api/roles/${activeRoleId}`, {
				method: 'DELETE',
			});
			setActiveRoleId(null);
			// Gọi hàm refetchRoles từ hook để cập nhật danh sách
			await refetchRoles();
			setModal(null);
		} catch {
			/* bỏ qua */
		}
	};

	return (
		<div className='pg'>
			<PageHeader
				title='Phân quyền'
				subtitle={
					loadingRoles
						? 'Đang tải...'
						: `${roles.length} vai trò · Quản lý quyền hệ thống`
				}
			>
				<button
					className='btn-outline'
					onClick={openAdd}
					disabled={loadingRoles}
				>
					<PlusIcon /> Thêm vai trò
				</button>
				<button
					className='btn-primary'
					onClick={handleSavePerms}
					disabled={saving || !canEdit || loadingRoles}
				>
					{saved ? (
						<>
							<CheckIcon size={12} /> Đã lưu
						</>
					) : saving ? (
						'⏳ Đang lưu...'
					) : (
						'💾 Lưu quyền'
					)}
				</button>
			</PageHeader>

			<div className='perm-layout'>
				<RolesList
					roles={roles}
					loadingRoles={loadingRoles}
					activeRoleId={activeRoleId}
					onSelect={setActiveRoleId}
				/>

				{activeRole && !loadingRoles && (
					<PermissionGrid
						activeRole={activeRole}
						canEdit={canEdit}
						allPerms={allPerms}
						editPerms={editPerms}
						onTogglePerm={togglePerm}
						onEdit={openEdit}
						onDelete={() => setModal('del')}
					/>
				)}
			</div>

			{/* Modal thêm/sửa vai trò */}
			{(modal === 'add' || modal === 'edit') && (
				<RoleFormModal
					mode={modal}
					draft={draft}
					setDraft={setDraft}
					onClose={() => setModal(null)}
					onSave={saveRoleModal}
				/>
			)}

			{/* Modal xoá vai trò */}
			{modal === 'del' && (
				<ModalForm
					title='⚠️ Xác nhận xoá'
					onClose={() => setModal(null)}
				>
					<p className='confirm-txt'>
						Xoá vai trò <strong>{activeRole?.name_role}</strong>? Hành động này
						không thể hoàn tác.
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setModal(null)}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={deleteRole}
						>
							🗑 Xoá
						</button>
					</div>
				</ModalForm>
			)}

			<p
				className='perm-note'
				style={{ marginTop: 4 }}
			>
				* Vai trò hệ thống (🔒) không thể sửa hoặc xoá. Phân khoa theo từng
				người dùng được quản lý trong trang Tài khoản.
			</p>
		</div>
	);
}
