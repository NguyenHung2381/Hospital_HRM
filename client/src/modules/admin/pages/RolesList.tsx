import { COLOR_MAP } from '@/constants/mockData';
import type { ApiRole } from '@/types/apiType';
import { ACCESS_INFO } from './permissionPageConstants';

export interface RolesListProps {
	roles: ApiRole[];
	loadingRoles: boolean;
	activeRoleId: number | null;
	onSelect: (id: number) => void;
}

export default function RolesList({
	roles,
	loadingRoles,
	activeRoleId,
	onSelect,
}: RolesListProps) {
	return (
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
								onClick={() => onSelect(v.id_role)}
							>
								<span
									className='perm-rank-badge'
									style={isActive ? { background: c.bg, color: c.text } : {}}
								>
									{idx + 1}
								</span>
								<span
									className='perm-role-ico'
									style={isActive ? { background: c.bg, color: c.text } : {}}
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
	);
}
