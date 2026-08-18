import ModalForm from '@/components/common/ModalForm';
import type { ApiDept, ApiReport } from '@/types/apiType';
import { BLANK_ROW_INPUT, type RowInput } from '@/types/staffingType';
import { formatDateToVN } from '@/utils/dateUtils';
import { parseNumberOrNull } from '@/utils/formatUtils';
import { useEffect, useState } from 'react';
import SearchInput from '../SearchInput';
import CreateReportDeptForm from './CreateReportDeptForm';

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
				const res = await fetch(`/api/departments?status=active&group=ward`);
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
									return (
										<CreateReportDeptForm
											dept={dept}
											row={r}
											onFieldChange={(key, val) =>
												setRowField(createActiveDept, key, val)
											}
										/>
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
