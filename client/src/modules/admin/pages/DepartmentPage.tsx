import PlusIcon from '@/assets/svg/PlusIcon';
import ModalForm from '@/components/common/ModalForm';
import useDepartments from '@/hooks/useDepartments';
import { useDepartmentForm } from '@/hooks/useDepartmentForm';
import type { FormulaType } from '@/types/commonType';
import { FORMULA_BADGE_COLOR, FORMULA_LABELS } from '@/utils/formulaHelperUtils';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import TableActions from '../components/TableActions';
import DepartmentFormModal from './DepartmentFormModal';
import { REC_FORMULA_OPTIONS } from './departmentPageConstants';

export default function DepartmentPage() {
	const { depts, loadingDepts: loading, refetchDepts } = useDepartments();
	const [search, setSearch] = useState('');

	const {
		saving,
		error,
		modal,
		setModal,
		formTab,
		setFormTab,
		draft,
		draftRec,
		target,
		openAdd,
		openEdit,
		openDel,
		save,
		del,
		setField,
		setRecField,
	} = useDepartmentForm(refetchDepts);

	const filtered = depts.filter((k) =>
		k.name_department.toLowerCase().includes(search.toLowerCase()),
	);
	const activeCount = depts.filter((k) => k.status === 'active').length;
	const inactiveCount = depts.filter((k) => k.status === 'inactive').length;

	return (
		<div className='pg'>
			<PageHeader
				title='Quản lý khoa / phòng'
				subtitle={
					loading
						? 'Đang tải...'
						: `${depts.length} khoa · ${activeCount} hoạt động · ${inactiveCount} tạm dừng`
				}
			>
				<button
					className='btn-primary'
					onClick={openAdd}
					disabled={loading}
				>
					<PlusIcon /> Thêm khoa
				</button>
			</PageHeader>

			{/* Thống kê */}
			<div className='dept-stat-row'>
				{[
					{
						label: 'Tổng khoa',
						val: depts.length,
						color: '#1e293b',
						bg: '#f8fafc',
					},
					{
						label: 'Đang hoạt động',
						val: activeCount,
						color: '#065f2b',
						bg: '#f0faf4',
					},
					{
						label: 'Tạm dừng',
						val: inactiveCount,
						color: '#b45309',
						bg: '#fef3c7',
					},
					{
						label: 'Có cấu hình TT03',
						val: depts.filter((k) => k.formula_type !== null).length,
						color: '#1d4ed8',
						bg: '#dbeafe',
					},
					{
						label: 'Có cấu hình KN',
						val: depts.filter((k) => k.rec_formula_type !== null).length,
						color: '#6d28d9',
						bg: '#ede9fe',
					},
				].map((s) => (
					<StatCard
						key={s.label}
						label={s.label}
						value={s.val}
						textColor={s.color}
						bgColor={s.bg}
					/>
				))}
			</div>

			{/* Toolbar */}
			<div className='toolbar'>
				<SearchInput
					value={search}
					onChange={setSearch}
					placeholder='Tìm theo tên khoa…'
				/>
			</div>

			{/* Table */}
			<div className='table-wrap'>
				{loading ? (
					<div className='tbl-empty'>Đang tải dữ liệu...</div>
				) : (
					<table className='tbl'>
						<thead>
							<tr>
								<th>#</th>
								<th>Tên khoa / phòng</th>
								<th className='td-center'>Mã</th>
								<th className='td-center'>Giường/máy</th>
								<th className='td-center'>Công thức TT03</th>
								<th className='td-center'>Hệ số / Tỉ lệ</th>
								<th className='td-center'>Cộng thêm</th>
								<th className='td-center'>Cấu hình KN</th>
								<th className='td-center'>Tổng nhân lực</th>
								<th>Trạng thái</th>
								<th>Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((k, i) => {
								const ft = k.formula_type as FormulaType | null;
								const badge = ft ? FORMULA_BADGE_COLOR[ft] : null;
								const ratioDisplay = (() => {
									if (!ft) return '—';
									if (ft === 'custom_coef')
										return `${k.coef_level_1} / ${k.coef_level_2} / ${k.coef_level_3}`;
									return `×${k.patient_ratio ?? '—'} ÷${k.shift_divisor ?? 3} ×${k.shift_multiplier ?? 2}`;
								})();
								return (
									<tr key={k.id_department}>
										<td className='td-num'>{i + 1}</td>
										<td>
											<div
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: 8,
												}}
											>
												<div
													className={`dept-icon ${k.status === 'inactive' ? 'dept-icon-off' : ''}`}
												>
													🏥
												</div>
												<span className='td-name'>{k.name_department}</span>
											</div>
										</td>
										<td
											className='td-center td-mono'
											style={{ color: '#64748b', fontSize: '.8rem' }}
										>
											{k.code_department ?? '—'}
										</td>
										<td className='td-center'>{k.bed_count ?? '—'}</td>
										<td className='td-center'>
											{ft && badge ? (
												<span
													style={{
														fontSize: '0.68rem',
														fontWeight: 700,
														padding: '3px 8px',
														borderRadius: 9999,
														background: badge.bg,
														color: badge.color,
														whiteSpace: 'nowrap',
													}}
												>
													{FORMULA_LABELS[ft]}
												</span>
											) : (
												<span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
													Chưa cấu hình
												</span>
											)}
										</td>
										<td
											className='td-center td-mono'
											style={{ fontSize: '0.75rem', color: '#475569' }}
										>
											{ratioDisplay}
										</td>
										<td
											className='td-center'
											style={{
												fontSize: '0.8rem',
												color: '#7c3aed',
												fontWeight: 600,
											}}
										>
											{ft && ft !== 'custom_coef' && (k.fixed_add ?? 0) > 0
												? `+${k.fixed_add}`
												: '—'}
										</td>
										<td className='td-center'>
											{k.rec_formula_type ? (
												<span
													style={{
														fontSize: '0.68rem',
														fontWeight: 700,
														padding: '3px 8px',
														borderRadius: 9999,
														background: '#ede9fe',
														color: '#6d28d9',
														whiteSpace: 'nowrap',
													}}
												>
													{REC_FORMULA_OPTIONS.find(
														(o) => o.value === k.rec_formula_type,
													)?.label ?? k.rec_formula_type}
												</span>
											) : (
												<span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
													Chưa cấu hình
												</span>
											)}
										</td>
										<td
											className='td-center'
											style={{ fontWeight: 600, color: '#065f2b' }}
										>
											{k.total_staff ?? '—'}
										</td>
										<td>
											<StatusBadge status={k.status} />
										</td>
										<td>
											<TableActions
												onEdit={() => openEdit(k)}
												onDelete={() => openDel(k)}
											/>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
				{!loading && filtered.length === 0 && (
					<div className='tbl-empty'>Không tìm thấy kết quả nào</div>
				)}
			</div>

			{/* ── Modal thêm / sửa ── */}
			{(modal === 'add' || modal === 'edit') && (
				<DepartmentFormModal
					mode={modal}
					formTab={formTab}
					setFormTab={setFormTab}
					draft={draft}
					draftRec={draftRec}
					setField={setField}
					setRecField={setRecField}
					error={error}
					saving={saving}
					onClose={() => setModal(null)}
					onSave={save}
				/>
			)}

			{/* ── Modal xoá ── */}
			{modal === 'del' && (
				<ModalForm
					title='⚠️ Xác nhận xoá'
					onClose={() => setModal(null)}
				>
					{error && (
						<p
							className='login-error'
							role='alert'
						>
							{error}
						</p>
					)}
					<p className='confirm-txt'>
						Xoá khoa <strong>{target?.name_department}</strong>? Hành động này
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
							onClick={del}
							disabled={saving}
						>
							{saving ? '⏳ Đang xoá...' : '🗑 Xoá'}
						</button>
					</div>
				</ModalForm>
			)}
		</div>
	);
}
