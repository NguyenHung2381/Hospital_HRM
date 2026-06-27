import InfoIcon from '@/assets/svg/InfoIcon';
import PlusIcon from '@/assets/svg/PlusIcon';
import ModalForm from '@/components/common/ModalForm';
import useDepartments from '@/hooks/useDepartments';
import type { ApiDept } from '@/types/apiType';
import type { FormulaType, RecommendedFormulaType } from '@/types/commonType';
import type { DraftDept } from '@/types/staffingType';
import {
	FORMULA_BADGE_COLOR,
	FORMULA_LABELS,
	getDraftFormulaPreview,
} from '@/utils/formulaHelperUtils';
import { useState } from 'react';
import FormField from '../components/FormField';
import PageHeader from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import TableActions from '../components/TableActions';

interface DraftRec {
	formula_type: RecommendedFormulaType;
	coef_l1: number;
	coef_l2: number;
	coef_l3: number;
	outpatient_ratio: number | null;
	fixed_add: number;
	note: string;
}

const DRAFT_DEFAULT: DraftDept = {
	name: '',
	code_department: '',
	bed_count: null,
	coef_level_1: 0.5,
	coef_level_2: 0.104,
	coef_level_3: 0.104,
	coef_total: 0.12,
	total_staff: null,
	status: 'active',
	formula_type: 'custom_coef',
	patient_ratio: 0.6,
	shift_divisor: 3,
	shift_multiplier: 2,
	fixed_add: 0,
	tt03_note: '',
};

const REC_DEFAULT: DraftRec = {
	formula_type: 'coef',
	coef_l1: 0.5,
	coef_l2: 0.104,
	coef_l3: 0.104,
	outpatient_ratio: null,
	fixed_add: 0,
	note: '',
};

const COEF_FIELDS: { label: string; key: keyof DraftDept; hint?: string }[] = [
	{ label: 'HS Cấp 1 (CSC1)', key: 'coef_level_1', hint: 'Nặng / Nguy kịch' },
	{ label: 'HS Cấp 2 (CSC2)', key: 'coef_level_2', hint: 'Trung bình' },
	{ label: 'HS Cấp 3 (CSC3)', key: 'coef_level_3', hint: 'Nhẹ / Ổn định' },
	{ label: 'HS Tổng NB', key: 'coef_total', hint: 'Nhân với tổng NB' },
];

const REC_FORMULA_OPTIONS: {
	value: RecommendedFormulaType;
	label: string;
	hint: string;
}[] = [
	{
		value: 'coef',
		label: 'Hệ số theo cấp độ NB',
		hint: '= (L1 × coef_l1) + (L2 × coef_l2) + (L3 × coef_l3) + fixed_add',
	},
	{
		value: 'coef_with_total',
		label: 'Hệ số cấp độ + Tổng NB',
		hint: '= (L1 × coef_l1) + (L2 × coef_l2) + (L3 × coef_l3) + (Tổng NB × outpatient_ratio) + fixed_add',
	},
	{
		value: 'total_ratio',
		label: 'Tỉ lệ tổng NB (cấp cứu)',
		hint: '= (L1 + L2 + L3) × outpatient_ratio + fixed_add',
	},
	{
		value: 'outpatient_count',
		label: 'Lượt khám ngoại trú',
		hint: '= outpatient_cnt × outpatient_ratio + fixed_add',
	},
];

type FormTab = 'info' | 'tt03' | 'rec';

export default function DepartmentPage() {
	const { depts, loadingDepts: loading, refetchDepts } = useDepartments();

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [modal, setModal] = useState<'add' | 'edit' | 'del' | null>(null);
	const [formTab, setFormTab] = useState<FormTab>('info');
	const [draft, setDraft] = useState<DraftDept>(DRAFT_DEFAULT);
	const [draftRec, setDraftRec] = useState<DraftRec>(REC_DEFAULT);
	const [target, setTarget] = useState<ApiDept | null>(null);

	const filtered = depts.filter((k) =>
		k.name_department.toLowerCase().includes(search.toLowerCase()),
	);
	const activeCount = depts.filter((k) => k.status === 'active').length;
	const inactiveCount = depts.filter((k) => k.status === 'inactive').length;

	const openAdd = () => {
		setDraft({ ...DRAFT_DEFAULT });
		setDraftRec({ ...REC_DEFAULT });
		setFormTab('info');
		setError('');
		setModal('add');
	};

	const openEdit = (k: ApiDept) => {
		setDraft({
			name: k.name_department,
			code_department: k.code_department ?? '',
			bed_count: k.bed_count,
			coef_level_1: k.coef_level_1,
			coef_level_2: k.coef_level_2,
			coef_level_3: k.coef_level_3,
			coef_total: k.coef_total,
			total_staff: k.total_staff,
			status: k.status,
			formula_type: (k.formula_type as FormulaType) ?? 'custom_coef',
			patient_ratio: k.patient_ratio ?? 0.6,
			shift_divisor: k.shift_divisor ?? 3,
			shift_multiplier: k.shift_multiplier ?? 2,
			fixed_add: k.fixed_add ?? 0,
			tt03_note: k.tt03_note ?? '',
		});
		setDraftRec({
			formula_type: (k.rec_formula_type as RecommendedFormulaType) ?? 'coef',
			coef_l1: k.rec_coef_l1 ?? 0.5,
			coef_l2: k.rec_coef_l2 ?? 0.104,
			coef_l3: k.rec_coef_l3 ?? 0.104,
			outpatient_ratio: k.rec_outpatient_ratio ?? null,
			fixed_add: k.rec_fixed_add ?? 0,
			note: k.rec_note ?? '',
		});
		setTarget(k);
		setFormTab('info');
		setError('');
		setModal('edit');
	};

	const openDel = (k: ApiDept) => {
		setTarget(k);
		setError('');
		setModal('del');
	};

	const save = async () => {
		if (!draft.name.trim()) {
			setError('Tên khoa không được để trống.');
			setFormTab('info');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const isAdd = modal === 'add';

			// ── 1. POST/PUT /api/departments ─────────────────────────
			// Chú ý: PUT chỉ nhận name, code_department, bed_count,
			// coef_*, total_staff, status theo API departments.js
			const deptBody: Record<string, unknown> = {
				name: draft.name,
				code_department: draft.code_department || null,
				bed_count: draft.bed_count,
				coef_level_1: draft.coef_level_1,
				coef_level_2: draft.coef_level_2,
				coef_level_3: draft.coef_level_3,
				coef_total: draft.coef_total,
				total_staff: draft.total_staff,
				status: draft.status,
			};

			// POST còn nhận formula_type + fixed_add để tạo TT03 config luôn
			if (isAdd) {
				deptBody.formula_type = draft.formula_type;
				deptBody.fixed_add = draft.fixed_add;
			}

			const deptRes = await fetch(
				isAdd
					? `/api/departments`
					: `/api/departments/${target!.id_department}`,
				{
					method: isAdd ? 'POST' : 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(deptBody),
				},
			);
			const deptData = (await deptRes.json()) as {
				success: boolean;
				message?: string;
				data?: { id_department: number };
			};
			if (!deptData.success) {
				setError(deptData.message ?? 'Lỗi khi lưu thông tin khoa.');
				return;
			}

			const deptId = isAdd
				? deptData.data?.id_department
				: target!.id_department;
			if (!deptId) {
				setError('Không xác định được ID khoa.');
				return;
			}

			// ── 2. PUT /api/tt03/config/:deptId ─────────────────────
			const tt03Res = await fetch(`/api/tt03/config/${deptId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					formula_type: draft.formula_type,
					patient_ratio: draft.patient_ratio,
					shift_divisor: draft.shift_divisor,
					shift_multiplier: draft.shift_multiplier,
					fixed_add: draft.fixed_add,
					note: draft.tt03_note || null,
				}),
			});
			if (!tt03Res.ok) {
				const tt03Data = (await tt03Res.json().catch(() => ({}))) as {
					message?: string;
				};
				setError(tt03Data.message ?? 'Lỗi khi lưu cấu hình TT03.');
				return;
			}

			// ── 3. POST/PUT /api/departments/:id/recommended-config ─
			// POST khi tạo mới, PUT khi cập nhật (khớp với API tách biệt POST/PUT)
			const recRes = await fetch(
				`/api/departments/${deptId}/recommended-config`,
				{
					method: isAdd ? 'POST' : 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						formula_type: draftRec.formula_type,
						coef_l1: draftRec.coef_l1,
						coef_l2: draftRec.coef_l2,
						coef_l3: draftRec.coef_l3,
						outpatient_ratio: draftRec.outpatient_ratio,
						fixed_add: draftRec.fixed_add,
						note: draftRec.note || null,
					}),
				},
			);
			if (!recRes.ok) {
				const recData = (await recRes.json().catch(() => ({}))) as {
					message?: string;
				};
				setError(recData.message ?? 'Lỗi khi lưu cấu hình khuyến nghị.');
				return;
			}

			await refetchDepts();
			setModal(null);
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	const del = async () => {
		if (!target) return;
		setSaving(true);
		setError('');
		try {
			const res = await fetch(`/api/departments/${target.id_department}`, {
				method: 'DELETE',
			});
			const data = (await res.json()) as { success: boolean; message?: string };
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi xoá.');
				return;
			}
			await refetchDepts();
			setModal(null);
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	const setField = <K extends keyof DraftDept>(key: K, val: DraftDept[K]) =>
		setDraft((p) => ({ ...p, [key]: val }));

	const setRecField = <K extends keyof DraftRec>(key: K, val: DraftRec[K]) =>
		setDraftRec((p) => ({ ...p, [key]: val }));

	const formulaPreview = getDraftFormulaPreview(draft);
	const recOption = REC_FORMULA_OPTIONS.find(
		(o) => o.value === draftRec.formula_type,
	);

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
				<ModalForm
					title={
						modal === 'add' ? '＋ Thêm khoa / phòng' : '✏️ Sửa thông tin khoa'
					}
					onClose={() => setModal(null)}
					size='lg'
				>
					<div className='mform'>
						{error && (
							<p
								className='login-error'
								role='alert'
							>
								{error}
							</p>
						)}

						{/* Tab bar */}
						<div className='tab-bar'>
							<button
								className={`tab-btn${formTab === 'info' ? ' tab-btn--active' : ''}`}
								onClick={() => setFormTab('info')}
							>
								🏥 Thông tin
							</button>
							<button
								className={`tab-btn${formTab === 'tt03' ? ' tab-btn--active' : ''}`}
								onClick={() => setFormTab('tt03')}
							>
								📋 TT 03
							</button>
							<button
								className={`tab-btn${formTab === 'rec' ? ' tab-btn--active' : ''}`}
								onClick={() => setFormTab('rec')}
							>
								🏅 Khuyến nghị
							</button>
						</div>

						{/* ══ Tab: Thông tin cơ bản ══════════════════════════════ */}
						{formTab === 'info' && (
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
											onChange={(e) =>
												setField('code_department', e.target.value)
											}
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
											setField(
												'status',
												e.target.value as 'active' | 'inactive',
											)
										}
									>
										<option value='active'>Hoạt động</option>
										<option value='inactive'>Tạm dừng</option>
									</select>
								</FormField>
							</>
						)}

						{/* ══ Tab: Cấu hình TT03 ════════════════════════════════ */}
						{formTab === 'tt03' && (
							<>
								<div className='dept-heso-section'>
									<div className='dept-heso-hdr'>
										<p className='msec-title'>📐 Cấu hình TT 03/2023/TT-BYT</p>
										<span
											className='dept-heso-hint-icon'
											title='Chọn loại công thức phù hợp với đặc thù khoa'
										>
											<InfoIcon size={13} />
										</span>
									</div>

									<FormField label='Loại công thức'>
										<select
											className='fi-input'
											value={draft.formula_type}
											onChange={(e) =>
												setField('formula_type', e.target.value as FormulaType)
											}
										>
											<option value='custom_coef'>
												Hệ số từng cấp (Y học cổ truyền, PHCN...)
											</option>
											<option value='standard'>
												Nội trú thông thường (hệ số 0.6)
											</option>
											<option value='icu'>
												Hồi sức / Chống độc (hệ số 2.0)
											</option>
											<option value='surgery'>
												Gây mê / Phẫu thuật (tính theo bàn mổ)
											</option>
										</select>
									</FormField>

									{draft.formula_type === 'custom_coef' && (
										<>
											<p className='msec-hint'>
												Công thức: (CSC1 × hs1) + (CSC2 × hs2) + (CSC3 × hs3) +
												(Tổng × hst)
											</p>
											<div
												className='mrow2'
												style={{ marginTop: 8 }}
											>
												{COEF_FIELDS.map((h) => (
													<FormField
														key={h.key as string}
														label={h.label}
														hint={h.hint}
													>
														<input
															className='fi-input'
															type='number'
															step='0.001'
															min={0}
															value={draft[h.key] as number}
															onChange={(e) =>
																setField(h.key, Number(e.target.value))
															}
														/>
													</FormField>
												))}
											</div>
										</>
									)}

									{draft.formula_type !== 'custom_coef' && (
										<>
											<p className='msec-hint'>
												Công thức: (Tổng NB × tỉ lệ) / số ca × nhân ca
												{draft.formula_type === 'surgery'
													? ' — dùng số giường/bàn'
													: ''}
											</p>
											<div
												className='mrow3'
												style={{ marginTop: 8 }}
											>
												<FormField
													label='Tỉ lệ NB/ĐD'
													hint='VD: 0.6 hoặc 2.0'
												>
													<input
														className='fi-input'
														type='number'
														step='0.001'
														min={0}
														value={draft.patient_ratio}
														onChange={(e) =>
															setField('patient_ratio', Number(e.target.value))
														}
													/>
												</FormField>
												<FormField
													label='Chia ca'
													hint='Thường là 3'
												>
													<input
														className='fi-input'
														type='number'
														min={1}
														value={draft.shift_divisor}
														onChange={(e) =>
															setField('shift_divisor', Number(e.target.value))
														}
													/>
												</FormField>
												<FormField
													label='Nhân ca'
													hint='Thường là 2'
												>
													<input
														className='fi-input'
														type='number'
														min={1}
														value={draft.shift_multiplier}
														onChange={(e) =>
															setField(
																'shift_multiplier',
																Number(e.target.value),
															)
														}
													/>
												</FormField>
											</div>
											{draft.formula_type === 'standard' && (
												<div style={{ marginTop: 8 }}>
													<FormField
														label='Cộng thêm cố định'
														hint='VD: 9.2 cho máy lọc thận'
													>
														<input
															className='fi-input'
															type='number'
															step='0.1'
															min={0}
															value={draft.fixed_add}
															onChange={(e) =>
																setField('fixed_add', Number(e.target.value))
															}
														/>
													</FormField>
												</div>
											)}
										</>
									)}

									<FormField
										label='Ghi chú công thức'
										hint='Tuỳ chọn'
									>
										<input
											className='fi-input'
											value={draft.tt03_note}
											onChange={(e) => setField('tt03_note', e.target.value)}
											placeholder='VD: 4 người/bàn mổ'
										/>
									</FormField>

									<div className='dept-heso-preview'>
										<span className='dept-heso-preview-label'>
											Công thức hiện tại:
										</span>
										<span className='dept-heso-preview-val'>
											{formulaPreview}
										</span>
									</div>
								</div>
							</>
						)}

						{/* ══ Tab: Cấu hình Khuyến nghị ════════════════════════ */}
						{formTab === 'rec' && (
							<>
								<FormField label='Loại công thức khuyến nghị'>
									<select
										className='fi-input'
										value={draftRec.formula_type}
										onChange={(e) =>
											setRecField(
												'formula_type',
												e.target.value as RecommendedFormulaType,
											)
										}
									>
										{REC_FORMULA_OPTIONS.map((o) => (
											<option
												key={o.value}
												value={o.value}
											>
												{o.label}
											</option>
										))}
									</select>
								</FormField>

								{recOption && <p className='msec-hint'>{recOption.hint}</p>}

								{/* coef: L1/L2/L3 + fixed_add */}
								{draftRec.formula_type === 'coef' && (
									<>
										<div className='mrow3'>
											<FormField
												label='Hệ số L1'
												hint='Nặng / Nguy kịch'
											>
												<input
													className='fi-input'
													type='number'
													step='0.001'
													min={0}
													value={draftRec.coef_l1}
													onChange={(e) =>
														setRecField('coef_l1', Number(e.target.value))
													}
												/>
											</FormField>
											<FormField
												label='Hệ số L2'
												hint='Trung bình'
											>
												<input
													className='fi-input'
													type='number'
													step='0.001'
													min={0}
													value={draftRec.coef_l2}
													onChange={(e) =>
														setRecField('coef_l2', Number(e.target.value))
													}
												/>
											</FormField>
											<FormField
												label='Hệ số L3'
												hint='Nhẹ / Ổn định'
											>
												<input
													className='fi-input'
													type='number'
													step='0.001'
													min={0}
													value={draftRec.coef_l3}
													onChange={(e) =>
														setRecField('coef_l3', Number(e.target.value))
													}
												/>
											</FormField>
										</div>
										<div className='mrow2'>
											<FormField label='Cộng thêm cố định'>
												<input
													className='fi-input'
													type='number'
													step='0.1'
													min={0}
													value={draftRec.fixed_add}
													onChange={(e) =>
														setRecField('fixed_add', Number(e.target.value))
													}
												/>
											</FormField>
										</div>
									</>
								)}

								{/* total_ratio / outpatient_count: outpatient_ratio + fixed_add */}
								{draftRec.formula_type === 'coef_with_total' && (
									<>
										<div className='mrow3'>
											<FormField
												label='Hệ số L1'
												hint='Nặng / Nguy kịch'
											>
												<input
													className='fi-input'
													type='number'
													step='0.001'
													min={0}
													value={draftRec.coef_l1}
													onChange={(e) =>
														setRecField('coef_l1', Number(e.target.value))
													}
												/>
											</FormField>
											<FormField
												label='Hệ số L2'
												hint='Trung bình'
											>
												<input
													className='fi-input'
													type='number'
													step='0.001'
													min={0}
													value={draftRec.coef_l2}
													onChange={(e) =>
														setRecField('coef_l2', Number(e.target.value))
													}
												/>
											</FormField>
											<FormField
												label='Hệ số L3'
												hint='Nhẹ / Ổn định'
											>
												<input
													className='fi-input'
													type='number'
													step='0.001'
													min={0}
													value={draftRec.coef_l3}
													onChange={(e) =>
														setRecField('coef_l3', Number(e.target.value))
													}
												/>
											</FormField>
										</div>
										<div className='mrow2'>
											<FormField
												label='Tỉ lệ Tổng NB (outpatient_ratio)'
												hint='VD: 0.12'
											>
												<input
													className='fi-input'
													type='number'
													step='0.001'
													min={0}
													value={draftRec.outpatient_ratio ?? ''}
													placeholder='Nhập tỉ lệ...'
													onChange={(e) =>
														setRecField(
															'outpatient_ratio',
															e.target.value === ''
																? null
																: Number(e.target.value),
														)
													}
												/>
											</FormField>
											<FormField label='Cộng thêm cố định'>
												<input
													className='fi-input'
													type='number'
													step='0.1'
													min={0}
													value={draftRec.fixed_add}
													onChange={(e) =>
														setRecField('fixed_add', Number(e.target.value))
													}
												/>
											</FormField>
										</div>
									</>
								)}

								{/* total_ratio / outpatient_count: outpatient_ratio + fixed_add */}
								{(draftRec.formula_type === 'total_ratio' ||
									draftRec.formula_type === 'outpatient_count') && (
									<div className='mrow2'>
										<FormField
											label='Tỉ lệ (outpatient_ratio)'
											hint='VD: 0.15'
										>
											<input
												className='fi-input'
												type='number'
												step='0.001'
												min={0}
												value={draftRec.outpatient_ratio ?? ''}
												placeholder='Nhập tỉ lệ...'
												onChange={(e) =>
													setRecField(
														'outpatient_ratio',
														e.target.value === ''
															? null
															: Number(e.target.value),
													)
												}
											/>
										</FormField>
										<FormField label='Cộng thêm cố định'>
											<input
												className='fi-input'
												type='number'
												step='0.1'
												min={0}
												value={draftRec.fixed_add}
												onChange={(e) =>
													setRecField('fixed_add', Number(e.target.value))
												}
											/>
										</FormField>
									</div>
								)}

								<FormField
									label='Ghi chú'
									hint='Tuỳ chọn'
								>
									<input
										className='fi-input'
										value={draftRec.note}
										onChange={(e) => setRecField('note', e.target.value)}
										placeholder='VD: Theo khuyến nghị Bộ Y tế...'
									/>
								</FormField>
							</>
						)}

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
								onClick={save}
								disabled={saving}
							>
								{saving ? '⏳ Đang lưu...' : '💾 Lưu'}
							</button>
						</div>
					</div>
				</ModalForm>
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
