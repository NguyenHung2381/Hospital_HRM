import ModalForm from '@/components/common/ModalForm';
import type { DraftDept } from '@/types/staffingType';
import { getDraftFormulaPreview } from '@/utils/formulaHelperUtils';
import type { DraftRec, FormTab } from './departmentPageConstants';
import DeptInfoTab from './DeptInfoTab';
import DeptRecTab from './DeptRecTab';
import DeptTt03Tab from './DeptTt03Tab';

export interface DepartmentFormModalProps {
	mode: 'add' | 'edit';
	formTab: FormTab;
	setFormTab: (tab: FormTab) => void;
	draft: DraftDept;
	draftRec: DraftRec;
	setField: <K extends keyof DraftDept>(key: K, val: DraftDept[K]) => void;
	setRecField: <K extends keyof DraftRec>(key: K, val: DraftRec[K]) => void;
	error: string;
	saving: boolean;
	onClose: () => void;
	onSave: () => void;
}

export default function DepartmentFormModal({
	mode,
	formTab,
	setFormTab,
	draft,
	draftRec,
	setField,
	setRecField,
	error,
	saving,
	onClose,
	onSave,
}: DepartmentFormModalProps) {
	const formulaPreview = getDraftFormulaPreview(draft);

	return (
		<ModalForm
			title={mode === 'add' ? '＋ Thêm khoa / phòng' : '✏️ Sửa thông tin khoa'}
			onClose={onClose}
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

				{formTab === 'info' && (
					<DeptInfoTab
						draft={draft}
						setField={setField}
					/>
				)}

				{formTab === 'tt03' && (
					<DeptTt03Tab
						draft={draft}
						setField={setField}
						formulaPreview={formulaPreview}
					/>
				)}

				{formTab === 'rec' && (
					<DeptRecTab
						draftRec={draftRec}
						setRecField={setRecField}
					/>
				)}

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
						onClick={onSave}
						disabled={saving}
					>
						{saving ? '⏳ Đang lưu...' : '💾 Lưu'}
					</button>
				</div>
			</div>
		</ModalForm>
	);
}
