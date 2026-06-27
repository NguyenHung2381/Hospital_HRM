import PlusIcon from '@/assets/svg/PlusIcon';
import ModalForm from '@/components/common/ModalForm';
import Pagination from '@/components/ui/Pagination';
import { VAI_TRO_LABELS } from '@/constants/mockData';
import useDepartments from '@/hooks/useDepartments';
import usePagination from '@/hooks/usePagination';
import useRoles from '@/hooks/useRoles';
import useUsers from '@/hooks/useUsers';
import { useState } from 'react';
import FormField from '../components/FormField';
import PageHeader from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import StatusBadge from '../components/StatusBadge';
import TableActions from '../components/TableActions';
import type { RoleType } from '@/types/commonType';
import type { ApiDept, ApiUser } from '@/types/apiType';
import type { DeptPerm, UserDraft } from '@/types/userType';

// ── Draft form thêm/sửa user ──────────────────────────────

const DRAFT_DEFAULT: UserDraft = {
	full_name: '',
	username: '',
	password: '',
	user_code: '',
	id_department: null,
	position: '',
	id_role: null,
	status: 'active',
};

const ROLE_CSS: Record<string, string> = {
	admin: 'role-admin',
	giam_doc: 'role-giam-doc',
	dieu_duong_truong: 'role-ddt-bv',
	ddt_khoa: 'role-ddt-khoa',
	nhan_vien: 'role-nhan-vien',
};

const ROLE_MAP: Record<string, RoleType> = {
	'Quản trị hệ thống': 'admin',
	'Giám đốc': 'giam_doc',
	'Điều dưỡng trưởng BV': 'dieu_duong_truong',
	'Điều dưỡng trưởng khoa': 'ddt_khoa',
	'Nhân viên': 'nhan_vien',
};

export default function AccountPage() {
	// ── Gọi Custom Hooks ──
	const { users, loadingUsers, refetchUsers } = useUsers();
	const { roles, loadingRoles } = useRoles();
	const { depts, loadingDepts } = useDepartments('active');

	// Gộp trạng thái loading
	const isLoading = loadingUsers || loadingRoles || loadingDepts;

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(''); // Lỗi dùng cho form submit
	const [search, setSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState<number | null>(null);

	// Modal state
	type ModalStep = 'form' | 'assign' | null;
	const [modal, setModal] = useState<'add' | 'edit' | 'del' | 'reset' | null>(
		null,
	);
	const [step, setStep] = useState<ModalStep>(null);
	const [draft, setDraft] = useState<UserDraft>(DRAFT_DEFAULT);
	const [target, setTarget] = useState<ApiUser | null>(null);
	const [newUserId, setNewUserId] = useState<number | null>(null);

	// Phân khoa + quyền (cho bước 2 khi assigned)
	const [assignedDepts, setAssignedDepts] = useState<number[]>([]);
	const [deptPerms, setDeptPerms] = useState<
		Record<
			number,
			{ can_edit: boolean; can_delete: boolean; can_export: boolean }
		>
	>({});
	const [deptSearch, setDeptSearch] = useState('');

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

	const selectedRole = roles.find((r) => r.id_role === draft.id_role);

	// ── Handlers ──────────────────────────────────────────
	const openAdd = () => {
		setDraft(DRAFT_DEFAULT);
		setError('');
		setStep('form');
		setModal('add');
	};

	const openEdit = (u: ApiUser) => {
		setDraft({
			full_name: u.full_name,
			username: u.username,
			password: '',
			user_code: u.user_code ?? '',
			id_department: u.id_department,
			position: u.position ?? '',
			id_role: u.id_role,
			status: u.status,
		});
		setTarget(u);
		setError('');
		setStep('form');
		setModal('edit');
	};

	// Lưu bước 1 (thông tin cơ bản)
	const saveStep1 = async () => {
		if (!draft.full_name.trim() || !draft.username.trim() || !draft.id_role) {
			setError('Vui lòng điền đầy đủ họ tên, tên đăng nhập và vai trò');
			return;
		}
		if (modal === 'add' && !draft.password.trim()) {
			setError('Vui lòng nhập mật khẩu');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const isAdd = modal === 'add';
			const url = isAdd ? `/api/users` : `/api/users/${target!.id_user}`;
			const body = isAdd ? draft : { ...draft, password: undefined };
			const res = await fetch(url, {
				method: isAdd ? 'POST' : 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const data = (await res.json()) as {
				success: boolean;
				data?: { id_user: number };
				message?: string;
			};
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi lưu');
				return;
			}

			// Nếu role = assigned → bước 2 phân khoa
			if (selectedRole?.department_access_type === 'assigned') {
				const uid = isAdd ? data.data!.id_user : target!.id_user;
				setNewUserId(uid);
				// Load khoa đã phân nếu edit
				if (!isAdd) {
					const aRes = await fetch(`/api/users/${uid}/assigned-departments`);
					const aData = (await aRes.json()) as {
						success: boolean;
						data: ApiDept[];
					};
					if (aData.success)
						setAssignedDepts(aData.data.map((d) => d.id_department));

					const pRes = await fetch(`/api/users/${uid}/dept-permissions`);
					const pData = (await pRes.json()) as {
						success: boolean;
						data: DeptPerm[];
					};
					if (pData.success) {
						const map: typeof deptPerms = {};
						pData.data.forEach((p) => {
							map[p.id_department] = {
								can_edit: p.can_edit,
								can_delete: p.can_delete,
								can_export: p.can_export,
							};
						});
						setDeptPerms(map);
					}
				} else {
					setAssignedDepts([]);
					setDeptPerms({});
				}
				setStep('assign');
			} else {
				// all / own → lưu xong, đóng modal
				await refetchUsers();
				setModal(null);
				setStep(null);
			}
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	// Lưu bước 2 (phân khoa + quyền cho assigned)
	const saveStep2 = async () => {
		const uid = newUserId ?? target!.id_user;
		setSaving(true);
		setError('');
		try {
			await fetch(`/api/users/${uid}/assigned-departments`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ department_ids: assignedDepts }),
			});

			const permissions = assignedDepts.map((id) => ({
				id_department: id,
				...(deptPerms[id] ?? {
					can_edit: true,
					can_delete: false,
					can_export: true,
				}),
			}));

			await fetch(`/api/users/${uid}/dept-permissions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ permissions }),
			});

			await refetchUsers();
			setModal(null);
			setStep(null);
		} catch {
			setError('Lỗi khi lưu phân khoa.');
		} finally {
			setSaving(false);
		}
	};

	const toggleDept = (id: number) => {
		setAssignedDepts((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
		if (!deptPerms[id]) {
			setDeptPerms((prev) => ({
				...prev,
				[id]: { can_edit: true, can_delete: false, can_export: true },
			}));
		}
	};

	const togglePerm = (
		id: number,
		key: 'can_edit' | 'can_delete' | 'can_export',
	) => {
		setDeptPerms((prev) => ({
			...prev,
			[id]: {
				...(prev[id] ?? {
					can_edit: true,
					can_delete: false,
					can_export: true,
				}),
				[key]: !prev[id]?.[key],
			},
		}));
	};

	const handleDel = async () => {
		if (!target) return;
		setSaving(true);
		try {
			await fetch(`/api/users/${target.id_user}`, { method: 'DELETE' });
			await refetchUsers();
			setModal(null);
		} catch {
			setError('Lỗi khi xoá.');
		} finally {
			setSaving(false);
		}
	};

	const handleReset = async () => {
		if (!target) return;
		setSaving(true);
		try {
			const res = await fetch(`/api/users/${target.id_user}/reset-password`, {
				method: 'PUT',
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (data.success) {
				setModal(null);
			} else {
				setError(data.message ?? 'Lỗi khi đặt lại mật khẩu');
			}
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	const filteredDepts = depts.filter(
		(d) =>
			deptSearch === '' ||
			d.name_department.toLowerCase().includes(deptSearch.toLowerCase()),
	);

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
			<div
				style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}
			>
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
								<th>#</th>
								<th>Họ tên</th>
								<th>Tài khoản</th>
								<th>Khoa / Phòng</th>
								<th>Chức vụ</th>
								<th>Vai trò</th>
								<th>Trạng thái</th>
								<th>Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{paginatedData.map((u, i) => {
								const vt = ROLE_MAP[u.name_role];
								return (
									<tr key={u.id_user}>
										<td className='td-num'>{(page - 1) * pageSize + i + 1}</td>
										<td>
											<div className='td-user'>
												<div
													className={`td-avatar${vt ? ` acc-av-${vt}` : ''}`}
												>
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
										<td>
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
				<ModalForm
					title={modal === 'add' ? '＋ Thêm tài khoản' : '✏️ Sửa tài khoản'}
					onClose={() => {
						setModal(null);
						setStep(null);
					}}
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
									disabled={modal === 'edit'}
									onChange={(e) =>
										setDraft((p) => ({ ...p, username: e.target.value }))
									}
								/>
							</FormField>
							{modal === 'add' && (
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
											id_role:
												e.target.value === '' ? null : Number(e.target.value),
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
										<span>🗂️</span> Cần phân khoa cụ thể — bước tiếp theo sẽ
										chọn khoa và quyền
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
								onClick={() => {
									setModal(null);
									setStep(null);
								}}
								disabled={saving}
							>
								Huỷ
							</button>
							<button
								className='btn-primary'
								onClick={saveStep1}
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
			)}

			{/* ── Modal Bước 2: Phân khoa + quyền ── */}
			{(modal === 'add' || modal === 'edit') && step === 'assign' && (
				<ModalForm
					title='🗂️ Phân khoa & quyền thao tác'
					onClose={() => {
						setModal(null);
						setStep(null);
					}}
					wide
				>
					<div className='mform'>
						{error && <p className='login-error'>⚠️ {error}</p>}

						<p
							style={{ fontSize: '.8rem', color: '#64748b', marginBottom: 12 }}
						>
							Chọn khoa mà <strong>{draft.full_name}</strong> được phép xem, sau
							đó tick quyền thao tác cho từng khoa.
							<br />
							Đã chọn <strong>{assignedDepts.length}</strong> / {depts.length}{' '}
							khoa.
						</p>

						<div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
							<button
								className='dv-kp-btn'
								onClick={() => {
									setAssignedDepts(depts.map((d) => d.id_department));
									const map: typeof deptPerms = {};
									depts.forEach((d) => {
										map[d.id_department] = deptPerms[d.id_department] ?? {
											can_edit: true,
											can_delete: false,
											can_export: true,
										};
									});
									setDeptPerms(map);
								}}
							>
								Chọn tất cả
							</button>
							<button
								className='dv-kp-btn'
								onClick={() => setAssignedDepts([])}
							>
								Bỏ hết
							</button>
						</div>

						<SearchInput
							placeholder='Tìm khoa...'
							value={deptSearch}
							onChange={setDeptSearch}
						/>

						<div
							style={{
								maxHeight: 380,
								overflowY: 'auto',
								marginTop: 10,
								border: '1px solid var(--bdr, #e2e8f0)',
								borderRadius: 8,
							}}
						>
							{filteredDepts.map((d) => {
								const checked = assignedDepts.includes(d.id_department);
								const perm = deptPerms[d.id_department] ?? {
									can_edit: true,
									can_delete: false,
									can_export: true,
								};
								return (
									<div
										key={d.id_department}
										style={{
											padding: '8px 12px',
											borderBottom: '1px solid var(--bdr, #f1f5f9)',
											background: checked ? '#f0fdf4' : 'transparent',
										}}
									>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 8,
												cursor: 'pointer',
											}}
											onClick={() => toggleDept(d.id_department)}
										>
											<span
												style={{
													width: 18,
													height: 18,
													borderRadius: 4,
													border: `2px solid ${checked ? '#16a34a' : '#cbd5e1'}`,
													background: checked ? '#16a34a' : 'white',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													flexShrink: 0,
												}}
											>
												{checked && (
													<span
														style={{
															color: 'white',
															fontSize: 11,
															fontWeight: 700,
														}}
													>
														✓
													</span>
												)}
											</span>
											<span
												style={{
													fontSize: '.83rem',
													fontWeight: checked ? 600 : 400,
												}}
											>
												{d.name_department}
											</span>
										</div>
										{checked && (
											<div
												style={{
													display: 'flex',
													gap: 12,
													marginTop: 6,
													marginLeft: 26,
												}}
											>
												{(
													[
														['can_edit', '✏️ Sửa'],
														['can_delete', '🗑 Xoá'],
														['can_export', '📤 Xuất'],
													] as const
												).map(([key, label]) => (
													<label
														key={key}
														style={{
															display: 'flex',
															alignItems: 'center',
															gap: 4,
															fontSize: '.75rem',
															cursor: 'pointer',
															userSelect: 'none',
														}}
													>
														<input
															type='checkbox'
															checked={perm[key]}
															onChange={() => togglePerm(d.id_department, key)}
														/>
														{label}
													</label>
												))}
											</div>
										)}
									</div>
								);
							})}
						</div>

						<div
							className='mfooter'
							style={{ marginTop: 16 }}
						>
							<button
								className='btn-ghost'
								onClick={() => setStep('form')}
								disabled={saving}
							>
								← Quay lại
							</button>
							<button
								className='btn-primary'
								onClick={saveStep2}
								disabled={saving}
							>
								{saving ? '⏳ Đang lưu...' : '💾 Lưu phân khoa'}
							</button>
						</div>
					</div>
				</ModalForm>
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
