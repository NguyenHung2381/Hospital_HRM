import type { DraftDept } from '@/types/staffingType';
import FormField from '../components/FormField';

export interface DeptInfoTabProps {
	draft: DraftDept;
	setField: <K extends keyof DraftDept>(key: K, val: DraftDept[K]) => void;
}

export default function DeptInfoTab({ draft, setField }: DeptInfoTabProps) {
	return (
		<>
			<FormField label='Tên khoa / phòng *'>
				<input
					className='fi-input'
					value={draft.name}
					onChange={(e) => setField('name', e.target.value)}
					placeholder='Ví dụ: Khoa Nội tim mạch'
				/>
			</FormField>

			<div className='mrow3'>
				<FormField label='Mã khoa'>
					<input
						className='fi-input'
						value={draft.code_department}
						onChange={(e) => setField('code_department', e.target.value)}
						placeholder='VD: K001'
						maxLength={10}
					/>
				</FormField>
				<FormField label='Số giường / máy'>
					<input
						className='fi-input'
						type='number'
						min={0}
						value={draft.bed_count ?? ''}
						placeholder='Nhập số...'
						onChange={(e) =>
							setField(
								'bed_count',
								e.target.value === '' ? null : Number(e.target.value),
							)
						}
					/>
				</FormField>
				<FormField label='Tổng nhân lực'>
					<input
						className='fi-input'
						type='number'
						min={0}
						value={draft.total_staff ?? ''}
						placeholder='Nhập số...'
						onChange={(e) =>
							setField(
								'total_staff',
								e.target.value === '' ? null : Number(e.target.value),
							)
						}
					/>
				</FormField>
			</div>

			<FormField label='Trạng thái'>
				<select
					className='fi-input'
					value={draft.status}
					onChange={(e) =>
						setField('status', e.target.value as 'active' | 'inactive')
					}
				>
					<option value='active'>Hoạt động</option>
					<option value='inactive'>Tạm dừng</option>
				</select>
			</FormField>
		</>
	);
}
