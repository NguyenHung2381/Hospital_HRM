import ModalForm from '@/components/common/ModalForm';
import type { ApiCoordination } from '@/types/apiType';
import type { KhoaRecord } from '@/types/reportType';
import { useState } from 'react';
import FormField from '../FormField';

interface CreateCoordinationModalProps {
	reportDate: string;
	rows: KhoaRecord[];
	userId: number | null | undefined;
	/** Khoa gửi được chọn sẵn (VD: từ thao tác kéo-thả) */
	initialFromId?: number | null;
	/** Khoa nhận được chọn sẵn (VD: từ thao tác kéo-thả) */
	initialToId?: number | null;
	onCreated: (record: ApiCoordination) => void;
	onClose: () => void;
}

const QUICK_REASONS = [
	'Tăng cường ca đêm',
	'Bù kíp trực thiếu',
	'Điều phối khẩn cấp',
	'Hỗ trợ ca ngày',
	'Thay thế nghỉ phép',
];

/**
 * Modal ghi nhận việc điều chuyển nhân lực từ 1 khoa (đang dư) sang
 * 1 khoa khác (đang thiếu) trong ngày báo cáo đang chọn.
 */
export default function CreateCoordinationModal({
	reportDate,
	rows,
	userId,
	initialFromId,
	initialToId,
	onCreated,
	onClose,
}: CreateCoordinationModalProps) {
	const [fromId, setFromId] = useState<number | null>(initialFromId ?? null);
	const [toId, setToId] = useState<number | null>(initialToId ?? null);
	const [staffCount, setStaffCount] = useState<number>(1);
	const [note, setNote] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	// Record selected
	const fromDept = rows.find((r) => r.id_department === fromId);
	const toDept = rows.find((r) => r.id_department === toId);

	// Surplus of fromDept
	const fromSurplus = fromDept?.dieuPhoi ?? 0;
	// Deficit of toDept (negative value)
	const toDeficit = toDept?.dieuPhoi ?? 0;

	// Sort departments: Surplus first for From, Deficit first for To
	const surplusDepts = rows.filter((r) => (r.dieuPhoi ?? 0) > 0);
	const deficitDepts = rows.filter((r) => (r.dieuPhoi ?? 0) < 0);
	const otherDepts = rows.filter((r) => (r.dieuPhoi ?? 0) === 0);

	const handleAddNoteTag = (tag: string) => {
		if (note.includes(tag)) return;
		setNote((prev) => (prev ? `${prev}, ${tag}` : tag));
	};

	const handleCreate = async () => {
		if (!fromId || !toId) {
			setError('Vui lòng chọn khoa gửi và khoa nhận');
			return;
		}
		if (fromId === toId) {
			setError('Khoa gửi và khoa nhận không được trùng nhau');
			return;
		}
		if (!staffCount || staffCount <= 0) {
			setError('Số người điều chuyển phải lớn hơn 0');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const res = await fetch('/api/coordination', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					report_date: reportDate,
					id_department_from: fromId,
					id_department_to: toId,
					staff_count: staffCount,
					note: note || null,
					created_by: userId ?? null,
				}),
			});
			const data = (await res.json()) as {
				success: boolean;
				data?: ApiCoordination;
				message?: string;
			};
			if (!data.success || !data.data) {
				setError(data.message ?? 'Lỗi khi tạo điều phối');
				return;
			}
			onCreated(data.data);
			onClose();
		} catch {
			setError('Lỗi kết nối server.');
		} finally {
			setSaving(false);
		}
	};

	// Format date string for title
	const dateFormatted = reportDate
		? new Date(reportDate).toLocaleDateString('vi-VN')
		: '';

	return (
		<ModalForm
			title={`🔄 Điều phối nhân lực ca trực ${dateFormatted ? `(${dateFormatted})` : ''}`}
			onClose={onClose}
			size='lg'
		>
			<div className='mform coord-modal-wrap'>
				{error && <p className='login-error'>⚠️ {error}</p>}

				{/* ── Visual Flow Card ── */}
				<div className='coord-flow-grid'>
					{/* Khoa Gửi */}
					<div className='coord-dept-box coord-dept-box-from'>
						<div className='coord-dept-header'>
							<span className='coord-dept-icon'>🟢</span>
							<span className='coord-dept-title'>Khoa gửi (Bên nguồn dư)</span>
						</div>
						<select
							className='fi-input coord-select'
							value={fromId ?? ''}
							onChange={(e) => {
								const val = e.target.value === '' ? null : Number(e.target.value);
								setFromId(val);
								setError('');
							}}
						>
							<option value=''>-- Chọn khoa gửi --</option>
							{surplusDepts.length > 0 && (
								<optgroup label='🟢 Các khoa đang dư nhân sự (Ưu tiên)'>
									{surplusDepts.map((r) => (
										<option key={r.id_department} value={r.id_department}>
											{r.ten} (Dư +{r.dieuPhoi})
										</option>
									))}
								</optgroup>
							)}
							{deficitDepts.length > 0 && (
								<optgroup label='🔴 Các khoa đang thiếu nhân sự'>
									{deficitDepts.map((r) => (
										<option key={r.id_department} value={r.id_department}>
											{r.ten} (Thiếu {r.dieuPhoi})
										</option>
									))}
								</optgroup>
							)}
							{otherDepts.length > 0 && (
								<optgroup label='⚪ Các khoa cân bằng'>
									{otherDepts.map((r) => (
										<option key={r.id_department} value={r.id_department}>
											{r.ten} (Đủ)
										</option>
									))}
								</optgroup>
							)}
						</select>

						{fromDept && (
							<div className={`coord-stat-badge ${fromSurplus > 0 ? 'badge-green' : 'badge-gray'}`}>
								{fromSurplus > 0
									? `⚡ Đang dư +${fromSurplus} nhân sự`
									: fromSurplus < 0
									? `⚠️ Đang thiếu ${fromSurplus} nhân sự`
									: '✅ Đã đủ định mức'}
							</div>
						)}
					</div>

					{/* Flow Arrow */}
					<div className='coord-flow-arrow' title='Hướng điều chuyển'>
						<span className='coord-arrow-icon'>➔</span>
						<span className='coord-arrow-sub'>Điều chuyển</span>
					</div>

					{/* Khoa Nhận */}
					<div className='coord-dept-box coord-dept-box-to'>
						<div className='coord-dept-header'>
							<span className='coord-dept-icon'>🔴</span>
							<span className='coord-dept-title'>Khoa nhận (Bên tiếp nhận)</span>
						</div>
						<select
							className='fi-input coord-select'
							value={toId ?? ''}
							onChange={(e) => {
								const val = e.target.value === '' ? null : Number(e.target.value);
								setToId(val);
								setError('');
							}}
						>
							<option value=''>-- Chọn khoa nhận --</option>
							{deficitDepts.length > 0 && (
								<optgroup label='🔴 Các khoa đang thiếu nhân sự (Ưu tiên)'>
									{deficitDepts.map((r) => (
										<option key={r.id_department} value={r.id_department}>
											{r.ten} (Thiếu {r.dieuPhoi})
										</option>
									))}
								</optgroup>
							)}
							{surplusDepts.length > 0 && (
								<optgroup label='🟢 Các khoa đang dư nhân sự'>
									{surplusDepts.map((r) => (
										<option key={r.id_department} value={r.id_department}>
											{r.ten} (Dư +{r.dieuPhoi})
										</option>
									))}
								</optgroup>
							)}
							{otherDepts.length > 0 && (
								<optgroup label='⚪ Các khoa cân bằng'>
									{otherDepts.map((r) => (
										<option key={r.id_department} value={r.id_department}>
											{r.ten} (Đủ)
										</option>
									))}
								</optgroup>
							)}
						</select>

						{toDept && (
							<div className={`coord-stat-badge ${toDeficit < 0 ? 'badge-red' : 'badge-gray'}`}>
								{toDeficit < 0
									? `⚠️ Đang thiếu ${Math.abs(toDeficit)} nhân sự`
									: toDeficit > 0
									? `⚡ Đang dư +${toDeficit} nhân sự`
									: '✅ Đã đủ định mức'}
							</div>
						)}
					</div>
				</div>

				{/* ── Quantity Section & Stepper + Chips ── */}
				<div className='coord-qty-wrap'>
					<label className='fi-label'>Số người điều chuyển *</label>
					<div className='coord-qty-row'>
						<div className='coord-stepper'>
							<button
								type='button'
								className='coord-step-btn'
								onClick={() => setStaffCount((c) => Math.max(1, (c || 1) - 1))}
								disabled={staffCount <= 1}
							>
								−
							</button>
							<input
								type='number'
								min={1}
								className='fi-input coord-qty-input'
								value={staffCount}
								onChange={(e) => setStaffCount(Math.max(1, Number(e.target.value)))}
							/>
							<button
								type='button'
								className='coord-step-btn'
								onClick={() => setStaffCount((c) => (c || 0) + 1)}
							>
								+
							</button>
						</div>

						{/* Quick Chips */}
						<div className='coord-qty-chips'>
							{[1, 2, 3, 5].map((n) => (
								<button
									key={n}
									type='button'
									className={`coord-qty-chip ${staffCount === n ? 'active' : ''}`}
									onClick={() => setStaffCount(n)}
								>
									+{n} người
								</button>
							))}
							{fromSurplus > 0 && (
								<button
									type='button'
									className={`coord-qty-chip chip-max ${staffCount === fromSurplus ? 'active' : ''}`}
									onClick={() => setStaffCount(fromSurplus)}
									title={`Điều chuyển toàn bộ số dư (+${fromSurplus})`}
								>
									Tối đa (+{fromSurplus})
								</button>
							)}
						</div>
					</div>
				</div>

				{/* ── Impact Preview Card ── */}
				{fromDept && toDept && (
					<div className='coord-impact-preview'>
						<div className='coord-impact-hdr'>📊 Dự báo số liệu sau điều phối:</div>
						<div className='coord-impact-grid'>
							<div className='coord-impact-item'>
								<span className='coord-impact-label'>{fromDept.ten} (Gửi):</span>
								<span className='coord-impact-val'>
									{fromSurplus > 0 ? `Dư +${fromSurplus}` : `${fromSurplus}`} ➔{' '}
									<strong>
										{fromSurplus - staffCount >= 0
											? `Dư +${fromSurplus - staffCount}`
											: `Thiếu ${fromSurplus - staffCount}`}
									</strong>
								</span>
							</div>
							<div className='coord-impact-item'>
								<span className='coord-impact-label'>{toDept.ten} (Nhận):</span>
								<span className='coord-impact-val'>
									{toDeficit < 0 ? `Thiếu ${toDeficit}` : `Dư +${toDeficit}`} ➔{' '}
									<strong>
										{toDeficit + staffCount < 0
											? `Thiếu ${toDeficit + staffCount}`
											: `Dư +${toDeficit + staffCount}`}
									</strong>
								</span>
							</div>
						</div>
						{fromSurplus > 0 && staffCount > fromSurplus && (
							<div className='coord-impact-warn'>
								⚠️ Số lượng chuyển ({staffCount}) vượt quá số dư hiện tại của Khoa gửi ({fromSurplus}).
							</div>
						)}
					</div>
				)}

				{/* ── Notes with Quick Tags ── */}
				<FormField label='Ghi chú điều phối'>
					<textarea
						className='fi-input fi-ta'
						rows={2}
						placeholder='Nhập lý do điều chuyển, ca trực, kíp trực...'
						value={note}
						onChange={(e) => setNote(e.target.value)}
					/>
					<div className='coord-quick-tags'>
						<span className='coord-tag-label'>Gợi ý nhanh:</span>
						{QUICK_REASONS.map((tag) => (
							<button
								key={tag}
								type='button'
								className='coord-quick-tag'
								onClick={() => handleAddNoteTag(tag)}
							>
								+{tag}
							</button>
						))}
					</div>
				</FormField>

				<div className='mfooter'>
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
						disabled={saving}
					>
						{saving ? '⏳ Đang lưu...' : '🚀 Xác nhận điều phối'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
