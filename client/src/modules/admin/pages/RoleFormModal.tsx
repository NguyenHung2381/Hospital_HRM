import ModalForm from '@/components/common/ModalForm';
import { COLOR_MAP, COLOR_OPTIONS } from '@/constants/mockData';
import type { ApiRole } from '@/types/apiType';
import FormField from '../components/FormField';

export interface RoleFormModalProps {
	mode: 'add' | 'edit';
	draft: Partial<ApiRole>;
	setDraft: React.Dispatch<React.SetStateAction<Partial<ApiRole>>>;
	onClose: () => void;
	onSave: () => void;
}

export default function RoleFormModal({
	mode,
	draft,
	setDraft,
	onClose,
	onSave,
}: RoleFormModalProps) {
	return (
		<ModalForm
			title={mode === 'add' ? '＋ Thêm vai trò mới' : `✏️ Sửa: ${draft.name_role}`}
			onClose={onClose}
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
							onChange={(e) => setDraft((p) => ({ ...p, icon: e.target.value }))}
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
						onClick={onClose}
					>
						Huỷ
					</button>
					<button
						className='btn-primary'
						onClick={onSave}
					>
						💾 Lưu
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
