import ModalForm from '@/components/common/ModalForm';
import NumberInput from '@/components/ui/NumberInput';
import type { ApiDept, ApiReport } from '@/types/apiType';
import { BLANK_ROW_INPUT, type RowInput } from '@/types/staffingType';
import { formatDateToVN } from '@/utils/dateUtils';
import { parseNumberOrNull } from '@/utils/formatUtils';
import { useEffect, useState } from 'react';
import SearchInput from '../SearchInput';

interface CreateReportModalProps {
	selDate: string;
	userId: number | null | undefined;
	onCreated: (report: ApiReport) => void;
	onClose: () => void;
}

/**
 * Modal tạo báo cáo mới cho 1 ngày chưa có dữ liệu.
 * Layout 2 cột: sidebar danh sách khoa (có search + dot indicator)
 * + panel nhập liệu chi tiết cho khoa đang chọn.
 *
 * Tự fetch danh sách khoa active khi lần đầu mở.
 * Sau khi POST thành công, refetch báo cáo và trả qua onCreated.
 */
export default function CreateReportModal({
	selDate,
	userId,
	onCreated,
	onClose,
}: CreateReportModalProps) {
	const [allDepts, setAllDepts] = useState<ApiDept[]>([]);
	const [loadingDepts, setLoadingDepts] = useState(false);
	const [newRows, setNewRows] = useState<Record<number, RowInput>>({});
	const [createSearch, setCreateSearch] = useState('');
	const [createActiveDept, setCreateActiveDept] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	// Fetch khoa active khi mount
	useEffect(() => {
		async function load() {
			setLoadingDepts(true);
			try {
				const res = await fetch(`/api/departments?status=active`);
				const data = (await res.json()) as {
					success: boolean;
					data: ApiDept[];
				};
				if (data.success) setAllDepts(data.data);
			} catch {
				/* bỏ qua */
			} finally {
				setLoadingDepts(false);
			}
		}
		load();
	}, []);

	// Khởi tạo newRows khi allDepts load xong
	useEffect(() => {
		if (allDepts.length === 0) return;
		setNewRows((prev) => {
			const init: Record<number, RowInput> = {};
			allDepts.forEach((d) => {
				init[d.id_department] = prev[d.id_department] ?? { ...BLANK_ROW_INPUT };
			});
			return init;
		});
	}, [allDepts]);

	const setRowField = (id: number, key: keyof RowInput, val: string) =>
		setNewRows((p) => ({ ...p, [id]: { ...p[id], [key]: val } }));

	const filledCount = Object.values(newRows).filter((r) =>
		Object.values(r).some((v) => v.trim() !== ''),
	).length;

	const handleCreate = async () => {
		const toNum = parseNumberOrNull;
		const records = allDepts
			.filter((d) => {
				const r = newRows[d.id_department];
				return r && Object.values(r).some((v) => v.trim() !== '');
			})
			.map((d, i) => {
				const r = newRows[d.id_department];
				return {
					id_department: d.id_department,
					sort_order: i + 1,
					patient_level_1: toNum(r.csc1),
					patient_level_2: toNum(r.csc2),
					patient_level_3: toNum(r.csc3),
					outpatient_cnt: toNum(r.nbKham),
					total_staff: toNum(r.nlTong),
					staff_on_duty: toNum(r.nghiTruc),
					staff_long_leave: toNum(r.nghiTren2),
					note: r.note || null,
					// Không gửi recommended_staff → backend tự tính
				};
			});

		if (records.length === 0) {
			setError('Vui lòng nhập dữ liệu ít nhất 1 khoa.');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const res = await fetch(`/api/reports`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					report_date: selDate,
					records,
					created_by: userId,
				}),
			});
			const data = (await res.json()) as {
				success: boolean;
				message?: string;
			};
			if (!data.success) {
				setError(data.message ?? 'Lỗi khi tạo báo cáo');
				return;
			}
			const rRes = await fetch(`/api/reports/date/${selDate}`);
			const rData = (await rRes.json()) as {
				success: boolean;
				data: ApiReport;
			};
			if (rData.success) onCreated(rData.data);
			onClose();
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<ModalForm
			title={`＋ Tạo báo cáo — ${formatDateToVN(selDate)}`}
			onClose={onClose}
			size='xl'
		>
			<div>
				{error && (
					<div style={{ padding: '12px 20px 0' }}>
						<p className='login-error'>⚠️ {error}</p>
					</div>
				)}

				{loadingDepts ? (
					<div
						style={{
							textAlign: 'center',
							padding: 48,
							color: '#94a3b8',
							fontSize: '.85rem',
						}}
					>
						Đang tải danh sách khoa...
					</div>
				) : (
					<div className='mcreate-layout'>
						{/* ── Sidebar danh sách khoa ── */}
						<div className='mcreate-sidebar'>
							<div className='mcreate-sidebar-hdr'>
								<SearchInput
									placeholder='Tìm khoa...'
									value={createSearch}
									onChange={setCreateSearch}
								/>
								<p
									style={{
										fontSize: '.68rem',
										color: '#94a3b8',
										marginTop: 8,
										marginBottom: 0,
									}}
								>
									🟢 {filledCount} / {allDepts.length} khoa đã nhập
								</p>
							</div>
							<div className='mcreate-sidebar-list'>
								{allDepts
									.filter(
										(d) =>
											createSearch === '' ||
											d.name_department
												.toLowerCase()
												.includes(createSearch.toLowerCase()),
									)
									.map((d) => {
										const r = newRows[d.id_department];
										const has =
											r && Object.values(r).some((v) => v.trim() !== '');
										return (
											<button
												key={d.id_department}
												className={`mcreate-dept-btn${createActiveDept === d.id_department ? ' active' : ''}${has ? ' filled' : ''}`}
												onClick={() => setCreateActiveDept(d.id_department)}
											>
												<span className='mcreate-dept-dot' />
												<span
													style={{
														flex: 1,
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
													}}
												>
													{d.name_department}
												</span>
											</button>
										);
									})}
							</div>
						</div>

						{/* ── Panel nhập liệu ── */}
						<div className='mcreate-detail'>
							{createActiveDept === null ? (
								<div className='mcreate-empty'>
									<span style={{ fontSize: '2rem', marginBottom: 8 }}>👈</span>
									Chọn khoa bên trái để nhập số liệu
								</div>
							) : (
								(() => {
									const dept = allDepts.find(
										(d) => d.id_department === createActiveDept,
									)!;
									const r = newRows[createActiveDept] ?? { ...BLANK_ROW_INPUT };
									const diLam =
										(Number(r.nlTong) || 0) -
										(Number(r.nghiTruc) || 0) -
										(Number(r.nghiTren2) || 0);
									return (
										<div
											style={{
												display: 'flex',
												flexDirection: 'column',
												gap: 16,
											}}
										>
											<p
												style={{
													fontWeight: 700,
													fontSize: '.88rem',
													color: 'var(--p)',
													margin: 0,
													paddingBottom: 12,
													borderBottom: '1px solid var(--bdr)',
												}}
											>
												🏥 {dept.name_department}
											</p>

											<div className='msec'>
												<p className='msec-title'>Số người bệnh</p>
												<div className='mrow3'>
													<NumberInput
														label='Cấp 1 (CSC1)'
														value={r.csc1 === '' ? null : Number(r.csc1)}
														onChange={(v) =>
															setRowField(
																createActiveDept,
																'csc1',
																v === null ? '' : String(v),
															)
														}
													/>
													<NumberInput
														label='Cấp 2 (CSC2)'
														value={r.csc2 === '' ? null : Number(r.csc2)}
														onChange={(v) =>
															setRowField(
																createActiveDept,
																'csc2',
																v === null ? '' : String(v),
															)
														}
													/>
													<NumberInput
														label='Cấp 3 (CSC3)'
														value={r.csc3 === '' ? null : Number(r.csc3)}
														onChange={(v) =>
															setRowField(
																createActiveDept,
																'csc3',
																v === null ? '' : String(v),
															)
														}
													/>
												</div>
												<div className='mrow2'>
													<NumberInput
														label='NB khám / PT KH'
														value={r.nbKham === '' ? null : Number(r.nbKham)}
														onChange={(v) =>
															setRowField(
																createActiveDept,
																'nbKham',
																v === null ? '' : String(v),
															)
														}
													/>
												</div>
											</div>

											<div className='msec'>
												<p className='msec-title'>Nhân lực</p>
												<div className='mrow3'>
													<NumberInput
														label='Tổng nhân lực'
														value={r.nlTong === '' ? null : Number(r.nlTong)}
														onChange={(v) =>
															setRowField(
																createActiveDept,
																'nlTong',
																v === null ? '' : String(v),
															)
														}
													/>
													<NumberInput
														label='Nghỉ trực'
														value={
															r.nghiTruc === '' ? null : Number(r.nghiTruc)
														}
														onChange={(v) =>
															setRowField(
																createActiveDept,
																'nghiTruc',
																v === null ? '' : String(v),
															)
														}
													/>
													<NumberInput
														label='Nghỉ > 2 ngày'
														value={
															r.nghiTren2 === '' ? null : Number(r.nghiTren2)
														}
														onChange={(v) =>
															setRowField(
																createActiveDept,
																'nghiTren2',
																v === null ? '' : String(v),
															)
														}
													/>
												</div>
												<div className='auto-preview'>
													<span>🔢 Đi làm =</span>
													<span className='auto-val'>{diLam} người</span>
												</div>
											</div>

											<div className='msec'>
												<p className='msec-title'>Ghi chú</p>
												<textarea
													className='fi-input fi-ta'
													rows={2}
													value={r.note}
													onChange={(e) =>
														setRowField(
															createActiveDept,
															'note',
															e.target.value,
														)
													}
												/>
											</div>
										</div>
									);
								})()
							)}
						</div>
					</div>
				)}

				<div
					className='mfooter'
					style={{ padding: '12px 20px' }}
				>
					<button
						className='btn-ghost'
						onClick={onClose}
						disabled={saving}
					>
						Huỷ
					</button>
					<button
						className='btn-primary'
						onClick={handleCreate}
						disabled={saving || loadingDepts || filledCount === 0}
					>
						{saving ? '⏳ Đang tạo...' : `💾 Tạo báo cáo (${filledCount} khoa)`}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
