import CheckIcon from '@/assets/svg/CheckIcon';
import EditIcon from '@/assets/svg/EditIcon';
import TrashIcon from '@/assets/svg/TrashIcon';
import XIcon from '@/assets/svg/XIcon';
import { COLOR_MAP } from '@/constants/mockData';
import type { ApiPermission, ApiRole } from '@/types/apiType';
import { ACCESS_INFO, VIEW_PERM_CODES } from './permissionPageConstants';

export interface PermissionGridProps {
	activeRole: ApiRole;
	canEdit: boolean;
	allPerms: ApiPermission[];
	editPerms: Record<number, boolean>;
	onTogglePerm: (id: number) => void;
	onEdit: () => void;
	onDelete: () => void;
}

/** Chi tiết vai trò đang chọn: thông tin + danh sách quyền hạn (PermissionPage). */
export default function PermissionGrid({
	activeRole,
	canEdit,
	allPerms,
	editPerms,
	onTogglePerm,
	onEdit,
	onDelete,
}: PermissionGridProps) {
	const info = ACCESS_INFO[activeRole.department_access_type];

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
		<div className='perm-detail'>
			<div className='perm-detail-hdr'>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<span
						className='perm-detail-icon'
						style={{
							background: COLOR_MAP[activeRole.color ?? '']?.bg ?? '#f1f5f9',
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
							onClick={onEdit}
						>
							<EditIcon size={14} />
						</button>
						<button
							className='tbl-btn tbl-btn-del'
							onClick={onDelete}
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
										onClick={() => onTogglePerm(p.id_permission)}
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
													background: isAutoTicked ? '#ccfbf1' : '#f1f5f9',
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
	);
}
