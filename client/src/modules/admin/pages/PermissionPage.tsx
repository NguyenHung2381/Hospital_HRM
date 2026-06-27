import CheckIcon from '@/assets/svg/CheckIcon';
import EditIcon from '@/assets/svg/EditIcon';
import PlusIcon from '@/assets/svg/PlusIcon';
import TrashIcon from '@/assets/svg/TrashIcon';
import XIcon from '@/assets/svg/XIcon';
import ModalForm from '@/components/common/ModalForm';
import { COLOR_MAP, COLOR_OPTIONS } from '@/constants/mockData';
import useRoles from '@/hooks/useRoles';
import type { ApiPermission, ApiRole } from '@/types/apiType';
import { useCallback, useEffect, useState } from 'react';
import FormField from '../components/FormField';
import PageHeader from '../components/PageHeader';

const ACCESS_INFO: Record<
	string,
	{ icon: string; text: string; sub: string; color: string; bg: string }
> = {
	all: {
		icon: '🏥',
		text: 'Toàn bộ tất cả các khoa',
		sub: 'Không giới hạn - xem được dữ liệu toàn bệnh viện',
		color: '#1d4ed8',
		bg: '#dbeafe',
	},
	assigned: {
		icon: '🗂️',
		text: 'Các khoa được Admin phân quyền',
		sub: 'Phân khoa cụ thể cho từng người dùng trong trang Tài khoản',
		color: '#0f766e',
		bg: '#ccfbf1',
	},
	own: {
		icon: '👤',
		text: 'Chỉ khoa đang công tác của mình',
		sub: 'Tự động theo trường khoa công tác trong hồ sơ tài khoản',
		color: '#475569',
		bg: '#f1f5f9',
	},
};

// Map department_access_type → code quyền xem tương ứng (chỉ tích 1)
const VIEW_PERM_MAP: Record<string, string> = {
	all: 'view_all_depts',
	assigned: 'view_assigned_depts',
	own: 'view_own_dept',
};
const VIEW_PERM_CODES = new Set(Object.values(VIEW_PERM_MAP));

export default function PermissionPage() {
	// ── Sử dụng custom hook lấy danh sách Roles ──
	const { roles, setRoles, loadingRoles, refetchRoles } = useRoles();

	const [allPerms, setAllPerms] = useState<ApiPermission[]>([]);
	const [activeRoleId, setActiveRoleId] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [modal, setModal] = useState<'add' | 'edit' | 'del' | null>(null);
	const [draft, setDraft] = useState<Partial<ApiRole>>({});
	const [editPerms, setEditPerms] = useState<Record<number, boolean>>({});

	// ── Tách riêng hàm fetch quyền hệ thống ──
	const fetchPerms = useCallback(async () => {
		try {
			const res = await fetch(`/api/permissions`);
			const data = (await res.json()) as {
				success: boolean;
				data: ApiPermission[];
			};
			if (data.success) setAllPerms(data.data);
		} catch {
			/* bỏ qua */
		}
	}, []);

	useEffect(() => {
		fetchPerms();
	}, [fetchPerms]);

	// Tự động chọn Role đầu tiên khi load xong danh sách Roles
	useEffect(() => {
		if (roles.length > 0 && !activeRoleId) {
			setActiveRoleId(roles[0].id_role);
		}
	}, [roles, activeRoleId]);

	// Fetch chi tiết quyền của Role đang chọn
	useEffect(() => {
		if (!activeRoleId) return;
		async function fetchRoleDetail() {
			try {
				const res = await fetch(`/api/roles/${activeRoleId}`);
				const data = (await res.json()) as { success: boolean; data: ApiRole };
				if (data.success) {
					// Cập nhật lại role trong danh sách (dùng hàm setRoles từ hook)
					setRoles((prev) =>
						prev.map((r) => (r.id_role === activeRoleId ? data.data : r)),
					);
					const map: Record<number, boolean> = {};
					(data.data.permissions ?? []).forEach((p) => {
						map[p.id_permission] = p.is_granted;
					});
					// Ghi đè quyền xem dữ liệu: tự động tích đúng 1 quyền theo access_type
					const correctViewCode =
						VIEW_PERM_MAP[data.data.department_access_type];
					(data.data.permissions ?? []).forEach((p) => {
						if (VIEW_PERM_CODES.has(p.code_permission)) {
							map[p.id_permission] = p.code_permission === correctViewCode;
						}
					});
					setEditPerms(map);
				}
			} catch {
				/* bỏ qua */
			}
		}
		fetchRoleDetail();
	}, [activeRoleId, setRoles]);

	const activeRole = roles.find((r) => r.id_role === activeRoleId);
	const canEdit = activeRole ? !activeRole.is_system : false;

	const togglePerm = (id: number) => {
		if (!canEdit) return;
		// Quyền xem dữ liệu được lock — tự động theo department_access_type
		const perm = allPerms.find((p) => p.id_permission === id);
		if (perm && VIEW_PERM_CODES.has(perm.code_permission)) return;
		setEditPerms((p) => ({ ...p, [id]: !p[id] }));
		setSaved(false);
	};

	const handleSavePerms = async () => {
		if (!activeRoleId) return;
		setSaving(true);
		try {
			const permissions = allPerms.map((p) => ({
				permission_id: p.id_permission,
				is_granted: editPerms[p.id_permission] ?? false,
			}));
			await fetch(`/api/roles/${activeRoleId}/permissions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ permissions }),
			});
			setSaved(true);
			setTimeout(() => setSaved(false), 2500);
		} catch {
			/* bỏ qua */
		} finally {
			setSaving(false);
		}
	};

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

	const permGroups = allPerms.reduce<Record<string, ApiPermission[]>>(
		(acc, p) => {
			const g = p.group_name ?? 'Khác';
			if (!acc[g]) acc[g] = [];
			acc[g].push(p);
			return acc;
		},
		{},
	);

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
				{/* Sidebar vai trò */}
				<aside className='perm-sidebar'>
					<p className='perm-sidebar-label'>Vai trò</p>
					{loadingRoles ? (
						<div style={{ padding: 12, fontSize: '0.85rem', color: '#64748b' }}>
							Đang tải...
						</div>
					) : (
						<div className='perm-role-list'>
							{roles.map((v, idx) => {
								const c = COLOR_MAP[v.color ?? ''] ?? COLOR_MAP.gray;
								const isActive = v.id_role === activeRoleId;
								return (
									<button
										key={v.id_role}
										className={`perm-role-item${isActive ? ' perm-role-active' : ''}`}
										onClick={() => setActiveRoleId(v.id_role)}
									>
										<span
											className='perm-rank-badge'
											style={
												isActive ? { background: c.bg, color: c.text } : {}
											}
										>
											{idx + 1}
										</span>
										<span
											className='perm-role-ico'
											style={
												isActive ? { background: c.bg, color: c.text } : {}
											}
										>
											{v.icon}
										</span>
										<div className='perm-role-info'>
											<p className='perm-role-name'>{v.name_role}</p>
											<p className='perm-role-desc'>
												{ACCESS_INFO[v.department_access_type]?.icon}{' '}
												{v.department_access_type}
											</p>
										</div>
										{v.is_system && (
											<span
												className='perm-sys-badge'
												title='Vai trò hệ thống'
											>
												🔒
											</span>
										)}
										{isActive && <span className='perm-active-dot' />}
									</button>
								);
							})}
						</div>
					)}
				</aside>

				{/* Chi tiết vai trò */}
				{activeRole && !loadingRoles && (
					<div className='perm-detail'>
						<div className='perm-detail-hdr'>
							<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
								<span
									className='perm-detail-icon'
									style={{
										background:
											COLOR_MAP[activeRole.color ?? '']?.bg ?? '#f1f5f9',
										color: COLOR_MAP[activeRole.color ?? '']?.text ?? '#475569',
									}}
								>
									{activeRole.icon}
								</span>
								<div>
									<p className='perm-detail-name'>{activeRole.name_role}</p>
									<p className='perm-detail-desc'>{activeRole.description}</p>
								</div>
							</div>
							{canEdit ? (
								<div style={{ display: 'flex', gap: 6 }}>
									<button
										className='tbl-btn tbl-btn-edit'
										onClick={openEdit}
									>
										<EditIcon size={14} />
									</button>
									<button
										className='tbl-btn tbl-btn-del'
										onClick={() => setModal('del')}
									>
										<TrashIcon size={14} />
									</button>
								</div>
							) : (
								<span className='perm-lock-note'>
									🔒 Vai trò hệ thống - không thể sửa
								</span>
							)}
						</div>

						{/* Phạm vi khoa */}
						{(() => {
							const info = ACCESS_INFO[activeRole.department_access_type];
							return (
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 8,
										background: info.bg,
										border: `1px solid ${info.color}30`,
										borderRadius: 10,
										padding: '8px 12px',
										margin: '0 18px 16px',
									}}
								>
									<span style={{ fontSize: '1.1rem' }}>{info.icon}</span>
									<div>
										<p
											style={{
												fontSize: '.78rem',
												fontWeight: 700,
												color: info.color,
											}}
										>
											{info.text}
										</p>
										<p
											style={{
												fontSize: '.67rem',
												color: '#64748b',
												marginTop: 1,
											}}
										>
											{info.sub}
										</p>
									</div>
								</div>
							);
						})()}

						{/* Danh sách quyền */}
						<section className='perm-section'>
							<p className='perm-section-title'>
								Quyền hạn ({Object.values(editPerms).filter(Boolean).length}/
								{allPerms.length})
								{!canEdit && (
									<span
										style={{
											marginLeft: 6,
											fontSize: '.7rem',
											color: '#94a3b8',
										}}
									>
										· 🔒 không thể sửa
									</span>
								)}
							</p>
							{Object.entries(permGroups).map(([grp, perms]) => (
								<div
									key={grp}
									style={{ marginBottom: 10 }}
								>
									<p className='perm-group-label'>{grp}</p>
									<div className='perm-quyen-list'>
										{perms.map((p) => {
											const on = editPerms[p.id_permission] ?? false;
											const isViewPerm = VIEW_PERM_CODES.has(p.code_permission);
											const isAutoTicked = isViewPerm && on;
											return (
												<div
													key={p.id_permission}
													className={`perm-quyen-row ${on ? 'pq-on' : 'pq-off'}${!canEdit || isViewPerm ? ' pq-locked' : ''}`}
													onClick={() => togglePerm(p.id_permission)}
													title={
														isViewPerm
															? 'Tự động theo phạm vi khoa của vai trò'
															: undefined
													}
												>
													<span
														className={`pq-toggle ${on ? 'pq-toggle-on' : 'pq-toggle-off'}`}
													>
														{on ? <CheckIcon size={12} /> : <XIcon size={12} />}
													</span>
													<span className='pq-label'>{p.label}</span>
													{isViewPerm && (
														<span
															style={{
																marginLeft: 'auto',
																fontSize: '.65rem',
																color: isAutoTicked ? '#0f766e' : '#94a3b8',
																background: isAutoTicked
																	? '#ccfbf1'
																	: '#f1f5f9',
																borderRadius: 4,
																padding: '1px 6px',
															}}
														>
															{isAutoTicked ? '✓ tự động' : '— tự động'}
														</span>
													)}
												</div>
											);
										})}
									</div>
								</div>
							))}
						</section>
					</div>
				)}
			</div>

			{/* Modal thêm/sửa vai trò */}
			{(modal === 'add' || modal === 'edit') && (
				<ModalForm
					title={
						modal === 'add'
							? '＋ Thêm vai trò mới'
							: `✏️ Sửa: ${activeRole?.name_role}`
					}
					onClose={() => setModal(null)}
				>
					<div className='mform'>
						<div className='mrow2'>
							<FormField label='Tên vai trò'>
								<input
									className='fi-input'
									value={draft.name_role ?? ''}
									onChange={(e) =>
										setDraft((p) => ({ ...p, name_role: e.target.value }))
									}
								/>
							</FormField>
							<FormField label='Icon (emoji)'>
								<input
									className='fi-input'
									value={draft.icon ?? ''}
									placeholder='🔑'
									onChange={(e) =>
										setDraft((p) => ({ ...p, icon: e.target.value }))
									}
								/>
							</FormField>
						</div>
						<FormField label='Mô tả'>
							<input
								className='fi-input'
								value={draft.description ?? ''}
								onChange={(e) =>
									setDraft((p) => ({ ...p, description: e.target.value }))
								}
							/>
						</FormField>
						<FormField label='Phạm vi khoa được xem'>
							<select
								className='fi-input'
								value={draft.department_access_type ?? 'assigned'}
								onChange={(e) =>
									setDraft((p) => ({
										...p,
										department_access_type: e.target
											.value as ApiRole['department_access_type'],
									}))
								}
							>
								<option value='all'>🏥 Toàn bộ tất cả các khoa</option>
								<option value='assigned'>
									🗂️ Các khoa được Admin phân quyền theo từng user
								</option>
								<option value='own'>👤 Chỉ khoa đang công tác của mình</option>
							</select>
						</FormField>
						<FormField label='Màu sắc'>
							<div className='color-picker'>
								{COLOR_OPTIONS.map((c) => (
									<button
										key={c}
										className={`color-swatch${draft.color === c ? ' color-swatch-active' : ''}`}
										style={{
											background: COLOR_MAP[c]?.bg,
											border: `2px solid ${draft.color === c ? COLOR_MAP[c]?.text : 'transparent'}`,
										}}
										onClick={() => setDraft((p) => ({ ...p, color: c }))}
									>
										<span
											style={{
												color: COLOR_MAP[c]?.text,
												fontSize: '.65rem',
												fontWeight: 700,
											}}
										>
											{c}
										</span>
									</button>
								))}
							</div>
						</FormField>
						<div className='mfooter'>
							<button
								className='btn-ghost'
								onClick={() => setModal(null)}
							>
								Huỷ
							</button>
							<button
								className='btn-primary'
								onClick={saveRoleModal}
							>
								💾 Lưu
							</button>
						</div>
					</div>
				</ModalForm>
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
