import { ArrowLeft, Check } from 'lucide-react';
import ModalForm from '@/components/common/ModalForm';
import type { ApiDept } from '@/types/apiType';
import { useState } from 'react';
import SearchInput from '../components/SearchInput';
import type { DeptPermMap } from './accountPageConstants';

export interface AccountAssignModalProps {
	fullName: string;
	depts: ApiDept[];
	assignedDepts: number[];
	setAssignedDepts: React.Dispatch<React.SetStateAction<number[]>>;
	deptPerms: DeptPermMap;
	setDeptPerms: React.Dispatch<React.SetStateAction<DeptPermMap>>;
	toggleDept: (id: number) => void;
	togglePerm: (id: number, key: 'can_edit' | 'can_delete' | 'can_export') => void;
	error: string;
	saving: boolean;
	onClose: () => void;
	onBack: () => void;
	onSave: () => void;
}

export default function AccountAssignModal({
	fullName,
	depts,
	assignedDepts,
	setAssignedDepts,
	deptPerms,
	setDeptPerms,
	toggleDept,
	togglePerm,
	error,
	saving,
	onClose,
	onBack,
	onSave,
}: AccountAssignModalProps) {
	const [deptSearch, setDeptSearch] = useState('');

	const filteredDepts = depts.filter(
		(d) =>
			deptSearch === '' ||
			d.name_department.toLowerCase().includes(deptSearch.toLowerCase()),
	);

	return (
		<ModalForm
			title='Phân khoa & quyền thao tác'
			onClose={onClose}
			wide
		>
			<div className='mform'>
				{error && <p className='login-error'>{error}</p>}

				<p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-gray-500)', marginBottom: 12 }}>
					Chọn khoa mà <strong>{fullName}</strong> được phép xem, sau đó tick
					quyền thao tác cho từng khoa.
					<br />
					Đã chọn <strong>{assignedDepts.length}</strong> / {depts.length} khoa.
				</p>

				<div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
					<button
						className='dv-kp-btn'
						onClick={() => {
							setAssignedDepts(depts.map((d) => d.id_department));
							const map: DeptPermMap = {};
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
						border: '1px solid var(--bdr, #e2e8ec)',
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
									borderBottom: '1px solid var(--bdr, #f0f4f6)',
									background: checked ? 'var(--color-primary-pale)' : 'transparent',
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
											border: `2px solid ${checked ? 'var(--p)' : 'var(--color-gray-300)'}`,
											background: checked ? 'var(--p)' : 'white',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											flexShrink: 0,
										}}
									>
										{checked && (
											<Check
												size={12}
												strokeWidth={3}
												color='white'
											/>
										)}
									</span>
									<span
										style={{
											fontSize: 'var(--fs-sm)',
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
												['can_edit', 'Sửa'],
												['can_delete', 'Xoá'],
												['can_export', 'Xuất'],
											] as const
										).map(([key, label]) => (
											<label
												key={key}
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: 4,
													fontSize: 'var(--fs-xs)',
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
						onClick={onBack}
						disabled={saving}
					>
						<ArrowLeft size={14} /> Quay lại
					</button>
					<button
						className='btn-primary'
						onClick={onSave}
						disabled={saving}
					>
						{saving ? 'Đang lưu...' : 'Lưu phân khoa'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
