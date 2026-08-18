import PlusIcon from '@/assets/svg/PlusIcon';
import ModalForm from '@/components/common/ModalForm';
import Pagination from '@/components/ui/Pagination';
import { VAI_TRO_LABELS } from '@/constants/mockData';
import useDepartments from '@/hooks/useDepartments';
import usePagination from '@/hooks/usePagination';
import useRoles from '@/hooks/useRoles';
import useUsers from '@/hooks/useUsers';
import { useAccountActions } from '@/hooks/useAccountActions';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import StatusBadge from '../components/StatusBadge';
import TableActions from '../components/TableActions';
import AccountAssignModal from './AccountAssignModal';
import AccountFormModal from './AccountFormModal';
import { ROLE_CSS, ROLE_MAP } from './accountPageConstants';

export default function AccountPage() {
	// ── Gọi Custom Hooks ──
	const { users, loadingUsers, refetchUsers } = useUsers();
	const { roles, loadingRoles } = useRoles();
	const { depts, loadingDepts } = useDepartments('active');

	// Gộp trạng thái loading
	const isLoading = loadingUsers || loadingRoles || loadingDepts;

	const [search, setSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState<number | null>(null);

	const {
		saving,
		error,
		setError,
		modal,
		setModal,
		step,
		setStep,
		draft,
		setDraft,
		target,
		setTarget,
		assignedDepts,
		setAssignedDepts,
		deptPerms,
		setDeptPerms,
		selectedRole,
		openAdd,
		openEdit,
		closeModal,
		saveStep1,
		saveStep2,
		toggleDept,
		togglePerm,
		handleDel,
		handleReset,
	} = useAccountActions(roles, refetchUsers);

	// ── Computed ──────────────────────────────────────────
	const filtered = users
		.filter(
			(u) =>
				(roleFilter === null || u.id_role === roleFilter) &&
				(u.full_name.toLowerCase().includes(search.toLowerCase()) ||
					u.username.toLowerCase().includes(search.toLowerCase()) ||
					(u.name_department ?? '')
						.toLowerCase()
						.includes(search.toLowerCase())),
		)
		.sort((a, b) => a.id_role - b.id_role);

	// ── Sử dụng Pagination Hook ──
	const { page, setPage, pageSize, setPageSize, totalPages, paginatedData } =
		usePagination(filtered, 10);

	return (
		<div className='pg'>
			<PageHeader
				title='Quản lý tài khoản'
				subtitle={
					isLoading
						? 'Đang tải...'
						: `${users.length} tài khoản · ${roles.length} vai trò`
				}
			>
				<button
					className='btn-primary'
					onClick={openAdd}
					disabled={isLoading}
				>
					<PlusIcon /> Thêm tài khoản
				</button>
			</PageHeader>

			{/* Tóm tắt cấp bậc — click để lọc */}
			<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
				<div
					className='acc-rank-chip'
					style={{
						cursor: 'pointer',
						outline: roleFilter === null ? '2px solid #0f766e' : 'none',
						background: roleFilter === null ? '#ccfbf1' : undefined,
					}}
					onClick={() => {
						setRoleFilter(null);
						setPage(1);
					}}
				>
					<span>👥</span>
					<span className='acc-rank-label'>Tất cả</span>
					<span className='acc-rank-count'>{users.length}</span>
				</div>
				{roles.map((r) => {
					const vt = ROLE_MAP[r.name_role];
					const info = vt ? VAI_TRO_LABELS[vt] : null;
					const count = users.filter((u) => u.id_role === r.id_role).length;
					const active = roleFilter === r.id_role;
					return (
						<div
							key={r.id_role}
							className='acc-rank-chip'
							style={{
								cursor: 'pointer',
								outline: active ? '2px solid #0f766e' : 'none',
								background: active ? '#ccfbf1' : undefined,
							}}
							onClick={() => {
								setRoleFilter(active ? null : r.id_role);
								setPage(1);
							}}
						>
							<span>{r.icon ?? '👤'}</span>
							<span className='acc-rank-label'>
								{info?.shortLabel ?? r.name_role}
							</span>
							<span className='acc-rank-count'>{count}</span>
						</div>
					);
				})}
			</div>

			<div className='toolbar'>
				<SearchInput
					placeholder='Tìm theo tên, tài khoản, khoa…'
					value={search}
					onChange={setSearch} // Hook usePagination tự reset về trang 1
				/>
			</div>

			<div className='table-wrap'>
				{isLoading ? (
					<div className='tbl-empty'>Đang tải dữ liệu...</div>
				) : (
					<table className='tbl'>
						<thead>
							<tr>
								<th className='td-num td-center' style={{ width: 44 }}>#</th>
								<th>Họ tên</th>
								<th>Tài khoản</th>
								<th>Khoa / Phòng</th>
								<th>Chức vụ</th>
								<th>Vai trò</th>
								<th>Trạng thái</th>
								<th style={{ textAlign: 'right' }}>Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{paginatedData.map((u, i) => {
								const vt = ROLE_MAP[u.name_role];
								return (
									<tr key={u.id_user}>
										<td className='td-num td-center'>{(page - 1) * pageSize + i + 1}</td>
										<td>
											<div className='td-user'>
												<div className={`td-avatar${vt ? ` acc-av-${vt}` : ''}`}>
													{u.full_name.split(' ').pop()?.charAt(0)}
												</div>
												<div>
													<span className='td-name'>{u.full_name}</span>
													{u.user_code && (
														<span
															style={{
																fontSize: '.72rem',
																color: '#94a3b8',
																marginLeft: 6,
															}}
														>
															{u.user_code}
														</span>
													)}
												</div>
											</div>
										</td>
										<td className='td-mono'>{u.username}</td>
										<td>{u.name_department ?? '—'}</td>
										<td>{u.position ?? '—'}</td>
										<td>
											<span className={`role-badge ${vt ? ROLE_CSS[vt] : ''}`}>
												{u.name_role}
											</span>
										</td>
										<td>
											<StatusBadge
												status={u.status}
												inactiveLabel='Tạm khoá'
											/>
										</td>
										<td style={{ textAlign: 'right' }}>
											<TableActions
												onReset={() => {
													setTarget(u);
													setError('');
													setModal('reset');
												}}
												onEdit={() => openEdit(u)}
												onDelete={() => {
													setTarget(u);
													setModal('del');
												}}
											/>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
				{!isLoading && filtered.length === 0 && (
					<div className='tbl-empty'>Không tìm thấy kết quả nào</div>
				)}

				{/* ── Component Phân Trang Gọi Từ Ngoài ── */}
				{!isLoading && filtered.length > 0 && (
					<Pagination
						page={page}
						pageSize={pageSize}
						totalItems={filtered.length}
						totalPages={totalPages}
						onPageChange={setPage}
						onPageSizeChange={setPageSize}
					/>
				)}
			</div>

			{/* ── Modal Thêm / Sửa — Bước 1 ── */}
			{(modal === 'add' || modal === 'edit') && step === 'form' && (
				<AccountFormModal
					mode={modal}
					draft={draft}
					setDraft={setDraft}
					depts={depts}
					roles={roles}
					selectedRole={selectedRole}
					error={error}
					saving={saving}
					onClose={closeModal}
					onSave={saveStep1}
				/>
			)}

			{/* ── Modal Bước 2: Phân khoa + quyền ── */}
			{(modal === 'add' || modal === 'edit') && step === 'assign' && (
				<AccountAssignModal
					fullName={draft.full_name}
					depts={depts}
					assignedDepts={assignedDepts}
					setAssignedDepts={setAssignedDepts}
					deptPerms={deptPerms}
					setDeptPerms={setDeptPerms}
					toggleDept={toggleDept}
					togglePerm={togglePerm}
					error={error}
					saving={saving}
					onClose={closeModal}
					onBack={() => setStep('form')}
					onSave={saveStep2}
				/>
			)}

			{/* Modal xoá */}
			{modal === 'del' && (
				<ModalForm
					title='⚠️ Xác nhận xoá'
					onClose={() => setModal(null)}
				>
					{error && <p className='login-error'>⚠️ {error}</p>}
					<p className='confirm-txt'>
						Xoá tài khoản <strong>{target?.full_name}</strong>? Hành động này
						không thể hoàn tác.
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setModal(null)}
							disabled={saving}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={handleDel}
							disabled={saving}
						>
							{saving ? '⏳...' : '🗑 Xoá'}
						</button>
					</div>
				</ModalForm>
			)}

			{/* Modal reset mật khẩu */}
			{modal === 'reset' && (
				<ModalForm
					title='🔑 Đặt lại mật khẩu'
					onClose={() => setModal(null)}
				>
					{error && <p className='login-error'>⚠️ {error}</p>}
					<p className='confirm-txt'>
						Đặt lại mật khẩu cho <strong>{target?.full_name}</strong>?
						<br />
						<br />
						Mật khẩu sẽ được đặt về:{' '}
						<strong
							style={{
								fontFamily: 'monospace',
								background: '#f1f5f9',
								padding: '2px 8px',
								borderRadius: 4,
							}}
						>
							{target?.username}
						</strong>
						<br />
						<span style={{ fontSize: '.78rem', color: '#64748b' }}>
							Người dùng cần đổi mật khẩu sau khi đăng nhập lại.
						</span>
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setModal(null)}
							disabled={saving}
						>
							Huỷ
						</button>
						<button
							className='btn-primary'
							style={{ background: '#d97706' }}
							onClick={handleReset}
							disabled={saving}
						>
							{saving ? '⏳ Đang xử lý...' : '🔑 Xác nhận đặt lại'}
						</button>
					</div>
				</ModalForm>
			)}
		</div>
	);
}
