import ModalForm from '@/components/common/ModalForm';
import type { DeptConfig } from '@/types/staffingType';
import { useEffect, useState } from 'react';
import {
	DEFAULT_HE_SO_REC,
	type HeSoRec,
	type RecFormulaType,
} from './deptConfigTypes';
import RecommendedConfigTab from './RecommendedConfigTab';
import Tt03ConfigTab from './Tt03ConfigTab';

export interface DeptConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	activeKhoaId: number;
	initialDept: DeptConfig;
	onSaveSuccess: (updatedDept: DeptConfig) => void;
}

type TabKey = 'tt03' | 'rec';

export default function DeptConfigModal({
	isOpen,
	onClose,
	activeKhoaId,
	initialDept,
	onSaveSuccess,
}: DeptConfigModalProps) {
	const [activeTab, setActiveTab] = useState<TabKey>('tt03');

	// ── Draft TT03 ──────────────────────────────────────────────
	const [deptDraft, setDeptDraft] = useState<DeptConfig>(initialDept);

	// ── Draft Recommended Config ────────────────────────────────
	const [recFormula, setRecFormula] = useState<RecFormulaType>(
		(initialDept.recFormulaType as RecFormulaType) ?? 'coef',
	);
	const [recHeSo, setRecHeSo] = useState<HeSoRec>({
		coefL1: initialDept.heSoRec?.coefL1 ?? DEFAULT_HE_SO_REC.coefL1,
		coefL2: initialDept.heSoRec?.coefL2 ?? DEFAULT_HE_SO_REC.coefL2,
		coefL3: initialDept.heSoRec?.coefL3 ?? DEFAULT_HE_SO_REC.coefL3,
		outpatientRatio:
			initialDept.heSoRec?.outpatientRatio ?? DEFAULT_HE_SO_REC.outpatientRatio,
		fixedAdd: initialDept.heSoRec?.fixedAdd ?? DEFAULT_HE_SO_REC.fixedAdd,
		note: initialDept.heSoRec?.note ?? DEFAULT_HE_SO_REC.note,
	});

	const [saving, setSaving] = useState(false);
	const [apiError, setApiError] = useState('');

	// Reset khi mở modal
	useEffect(() => {
		if (isOpen) {
			setDeptDraft({ ...initialDept });
			setRecFormula((initialDept.recFormulaType as RecFormulaType) ?? 'coef');
			setRecHeSo({
				coefL1: initialDept.heSoRec?.coefL1 ?? DEFAULT_HE_SO_REC.coefL1,
				coefL2: initialDept.heSoRec?.coefL2 ?? DEFAULT_HE_SO_REC.coefL2,
				coefL3: initialDept.heSoRec?.coefL3 ?? DEFAULT_HE_SO_REC.coefL3,
				outpatientRatio:
					initialDept.heSoRec?.outpatientRatio ??
					DEFAULT_HE_SO_REC.outpatientRatio,
				fixedAdd: initialDept.heSoRec?.fixedAdd ?? DEFAULT_HE_SO_REC.fixedAdd,
				note: initialDept.heSoRec?.note ?? DEFAULT_HE_SO_REC.note,
			});
			setApiError('');
			setActiveTab('tt03');
		}
	}, [isOpen, initialDept]);

	if (!isOpen) return null;

	// ── Lưu toàn bộ (song song 2 + 1 API) ──────────────────────
	const handleSave = async () => {
		setSaving(true);
		setApiError('');

		try {
			// 1️⃣  PUT /api/tt03/config/:deptId
			const tt03Res = await fetch(`/api/tt03/config/${activeKhoaId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					formula_type: deptDraft.formulaType,
					patient_ratio: deptDraft.heSo.patientRatio ?? 0.6,
					shift_divisor: deptDraft.heSo.shiftDivisor ?? 3,
					shift_multiplier: deptDraft.heSo.shiftMultiplier ?? 2,
					fixed_add: deptDraft.heSo.fixedAdd ?? 0,
					note: deptDraft.tt03Note ?? null,
				}),
			});
			if (!tt03Res.ok) {
				const body = (await tt03Res.json().catch(() => ({}))) as {
					message?: string;
				};
				setApiError(body.message ?? 'Lỗi khi lưu cấu hình TT03');
				return;
			}

			// 2️⃣  PUT /api/tt03/recommended-config/:deptId
			const recRes = await fetch(
				`/api/tt03/recommended-config/${activeKhoaId}`,
				{
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						formula_type: recFormula,
						coef_l1: recHeSo.coefL1,
						coef_l2: recHeSo.coefL2,
						coef_l3: recHeSo.coefL3,
						outpatient_ratio: recHeSo.outpatientRatio,
						fixed_add: recHeSo.fixedAdd,
						note: recHeSo.note || null,
					}),
				},
			);
			if (!recRes.ok) {
				const body = (await recRes.json().catch(() => ({}))) as {
					message?: string;
				};
				setApiError(body.message ?? 'Lỗi khi lưu cấu hình khuyến nghị');
				return;
			}

			// 3️⃣  PUT /api/departments/:id
			// Chỉ gửi các field mà API nhận: name, bed_count, coef_*
			const deptBody: Record<string, unknown> = {
				name: deptDraft.ten || initialDept.ten,
				bed_count: deptDraft.giuongMay,
				// Giữ nguyên các giá trị coef từ initialDept (không thay đổi trừ custom_coef)
				coef_level_1: initialDept.heSo.cap1,
				coef_level_2: initialDept.heSo.cap2,
				coef_level_3: initialDept.heSo.cap3,
				coef_total: initialDept.heSo.tong,
			};
			// Nếu là custom_coef thì cập nhật hệ số từ draft
			if (deptDraft.formulaType === 'custom_coef') {
				deptBody.coef_level_1 = deptDraft.heSo.cap1;
				deptBody.coef_level_2 = deptDraft.heSo.cap2;
				deptBody.coef_level_3 = deptDraft.heSo.cap3;
				deptBody.coef_total = deptDraft.heSo.tong;
			}

			const deptRes = await fetch(`/api/departments/${activeKhoaId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(deptBody),
			});
			if (!deptRes.ok) {
				const body = (await deptRes.json().catch(() => ({}))) as {
					message?: string;
				};
				setApiError(body.message ?? 'Lỗi khi cập nhật thông tin khoa');
				return;
			}

			// Cập nhật state trả về cho parent
			onSaveSuccess({
				...deptDraft,
				recFormulaType: recFormula,
				heSoRec: { ...recHeSo },
			});
		} finally {
			setSaving(false);
		}
	};

	// ── Render ──────────────────────────────────────────────────
	return (
		<ModalForm
			title='⚙️ Cấu hình khoa'
			onClose={onClose}
			size='lg'
		>
			<div className='mform'>
				{/* Tên khoa */}
				<div className='msec'>
					<div className='dept-modal-name-row'>
						<div className='dept-modal-name-icon'>🏥</div>
						<div>
							<p className='dept-modal-name-label'>Khoa đang cấu hình</p>
							<p className='dept-modal-name-val'>{initialDept.ten}</p>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div className='tab-bar'>
					<button
						className={`tab-btn${activeTab === 'tt03' ? ' tab-btn--active' : ''}`}
						onClick={() => setActiveTab('tt03')}
					>
						📋 Cấu hình TT 03
					</button>
					<button
						className={`tab-btn${activeTab === 'rec' ? ' tab-btn--active' : ''}`}
						onClick={() => setActiveTab('rec')}
					>
						🏅 Cấu hình Khuyến nghị
					</button>
				</div>

				{activeTab === 'tt03' && (
					<Tt03ConfigTab
						deptDraft={deptDraft}
						setDeptDraft={setDeptDraft}
					/>
				)}

				{activeTab === 'rec' && (
					<RecommendedConfigTab
						recFormula={recFormula}
						setRecFormula={setRecFormula}
						recHeSo={recHeSo}
						setRecHeSo={setRecHeSo}
					/>
				)}

				{apiError && <p className='login-error'>⚠️ {apiError}</p>}

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
						onClick={handleSave}
						disabled={saving}
					>
						{saving ? '⏳ Đang lưu...' : '💾 Lưu cấu hình'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
