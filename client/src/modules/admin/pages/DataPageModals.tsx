import ModalForm from '@/components/common/ModalForm';
import type { ApiClsRecord, ApiRecord, ApiReport, ReportMeta } from '@/types/apiType';
import { formatDateToVN } from '@/utils/dateUtils';
import AddClsRecordModal from '../components/modal/AddClsRecordModal';
import AddRecordModal from '../components/modal/AddRecordModal';
import CreateReportModal from '../components/modal/CreateReportModal';
import EditClsRecordModal from '../components/modal/EditClsRecordModal';
import EditRecordModal from '../components/modal/EditRecordModal';

export interface DataPageModalsProps {
	report: ApiReport | null;
	setReport: React.Dispatch<React.SetStateAction<ApiReport | null>>;
	setReportMetas: React.Dispatch<React.SetStateAction<ReportMeta[]>>;
	selDate: string;
	userId: number | undefined;
	apiError: string;
	saving: boolean;

	editRecord: ApiRecord | null;
	setEditRecord: (r: ApiRecord | null) => void;
	editClsRecord: ApiClsRecord | null;
	setEditClsRecord: (r: ApiClsRecord | null) => void;

	showCreate: boolean;
	setShowCreate: (v: boolean) => void;
	showAddRecord: boolean;
	setShowAddRecord: (v: boolean) => void;
	showAddClsRecord: boolean;
	setShowAddClsRecord: (v: boolean) => void;
	grantLocalPerm: (id_department: number) => void;

	showDelConfirm: boolean;
	setShowDelConfirm: (v: boolean) => void;
	delReport: () => void;

	delRecord: { id: number; name: string } | null;
	setDelRecord: (v: { id: number; name: string } | null) => void;
	confirmDelRecord: () => void;

	delClsRecord: { id: number; name: string } | null;
	setDelClsRecord: (v: { id: number; name: string } | null) => void;
	confirmDelClsRecord: () => void;
}

/** Toàn bộ modal (sửa/thêm/tạo/xoá) dùng trên DataPage. */
export default function DataPageModals({
	report,
	setReport,
	setReportMetas,
	selDate,
	userId,
	apiError,
	saving,
	editRecord,
	setEditRecord,
	editClsRecord,
	setEditClsRecord,
	showCreate,
	setShowCreate,
	showAddRecord,
	setShowAddRecord,
	showAddClsRecord,
	setShowAddClsRecord,
	grantLocalPerm,
	showDelConfirm,
	setShowDelConfirm,
	delReport,
	delRecord,
	setDelRecord,
	confirmDelRecord,
	delClsRecord,
	setDelClsRecord,
	confirmDelClsRecord,
}: DataPageModalsProps) {
	return (
		<>
			{editRecord && report && (
				<EditRecordModal
					record={editRecord}
					report={report}
					selDate={selDate}
					userId={userId}
					onSaved={(updated) => {
						setReport(updated);
						setEditRecord(null);
					}}
					onClose={() => setEditRecord(null)}
				/>
			)}

			{editClsRecord && report && (
				<EditClsRecordModal
					record={editClsRecord}
					report={report}
					selDate={selDate}
					onSaved={(updated) => {
						setReport(updated);
						setEditClsRecord(null);
					}}
					onClose={() => setEditClsRecord(null)}
				/>
			)}

			{showCreate && (
				<CreateReportModal
					selDate={selDate}
					userId={userId}
					onCreated={(newReport) => {
						setReport(newReport);
						setReportMetas((prev) => [
							...prev,
							{ id_report: newReport.id_report, report_date: selDate },
						]);
					}}
					onClose={() => setShowCreate(false)}
				/>
			)}

			{showAddRecord && report && (
				<AddRecordModal
					reportId={report.id_report}
					selDate={selDate}
					existingDeptIds={new Set(report.records.map((r) => r.id_department))}
					userId={userId}
					onAdded={(updatedReport, newDeptId) => {
						setReport(updatedReport);
						grantLocalPerm(newDeptId);
					}}
					onClose={() => setShowAddRecord(false)}
				/>
			)}

			{showAddClsRecord && report && (
				<AddClsRecordModal
					reportId={report.id_report}
					selDate={selDate}
					existingDeptIds={
						new Set(report.cls_records.map((r) => r.id_department))
					}
					userId={userId}
					onAdded={(updatedReport, newDeptId) => {
						setReport(updatedReport);
						grantLocalPerm(newDeptId);
					}}
					onClose={() => setShowAddClsRecord(false)}
				/>
			)}

			{showDelConfirm && (
				<ModalForm
					title='⚠️ Xác nhận xóa báo cáo'
					onClose={() => setShowDelConfirm(false)}
					size='sm'
				>
					{apiError && <p className='login-error'>⚠️ {apiError}</p>}
					<p className='confirm-txt'>
						Xóa toàn bộ báo cáo ngày <strong>{formatDateToVN(selDate)}</strong>?
						<br />
						<span style={{ fontSize: '.8rem', color: '#64748b' }}>
							Dữ liệu tất cả {report?.records.length ?? 0} khoa trong ngày này
							sẽ bị xóa vĩnh viễn.
						</span>
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setShowDelConfirm(false)}
							disabled={saving}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={delReport}
							disabled={saving}
						>
							{saving ? '⏳ Đang xóa...' : '🗑 Xóa báo cáo'}
						</button>
					</div>
				</ModalForm>
			)}

			{delRecord && (
				<ModalForm
					title='⚠️ Xác nhận xóa bản ghi'
					onClose={() => setDelRecord(null)}
					size='sm'
				>
					{apiError && <p className='login-error'>⚠️ {apiError}</p>}
					<p className='confirm-txt'>
						Xóa bản ghi của <strong>{delRecord.name}</strong> khỏi báo cáo ngày{' '}
						<strong>{formatDateToVN(selDate)}</strong>?
						<br />
						<span style={{ fontSize: '.8rem', color: '#64748b' }}>
							Chỉ xóa dữ liệu của khoa này, không ảnh hưởng các khoa khác.
						</span>
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setDelRecord(null)}
							disabled={saving}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={confirmDelRecord}
							disabled={saving}
						>
							{saving ? '⏳...' : '🗑 Xóa bản ghi'}
						</button>
					</div>
				</ModalForm>
			)}

			{delClsRecord && (
				<ModalForm
					title='⚠️ Xác nhận xóa bản ghi CLS'
					onClose={() => setDelClsRecord(null)}
					size='sm'
				>
					{apiError && <p className='login-error'>⚠️ {apiError}</p>}
					<p className='confirm-txt'>
						Xóa bản ghi của <strong>{delClsRecord.name}</strong> khỏi báo cáo
						ngày <strong>{formatDateToVN(selDate)}</strong>?
						<br />
						<span style={{ fontSize: '.8rem', color: '#64748b' }}>
							Chỉ xóa dữ liệu của khoa này, không ảnh hưởng các khoa khác.
						</span>
					</p>
					<div className='mfooter'>
						<button
							className='btn-ghost'
							onClick={() => setDelClsRecord(null)}
							disabled={saving}
						>
							Huỷ
						</button>
						<button
							className='btn-danger'
							onClick={confirmDelClsRecord}
							disabled={saving}
						>
							{saving ? '⏳...' : '🗑 Xóa bản ghi'}
						</button>
					</div>
				</ModalForm>
			)}
		</>
	);
}
