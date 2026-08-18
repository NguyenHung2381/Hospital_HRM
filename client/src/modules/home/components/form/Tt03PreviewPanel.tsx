import {
	getFormulaTypeName,
	getRecFormulaTypeName,
	getPreviewFormulaDetail,
	getPreviewRecDetail,
	type TT03Preview,
} from '@/utils/formulaHelperUtils';
import type { DailyRecord } from '@/types/staffingType';

export interface Tt03PreviewPanelProps {
	tt03Preview: TT03Preview | null;
	previewLoading: boolean;
	nb: DailyRecord['nb'];
	diLam: number;
}

export default function Tt03PreviewPanel({
	tt03Preview,
	previewLoading,
	nb,
	diLam,
}: Tt03PreviewPanelProps) {
	// Điều phối dựa trên Nhân lực khuyến nghị (ưu tiên) hoặc TT03
	const staffRef =
		tt03Preview?.recommended?.staff ?? tt03Preview?.tt03?.staff ?? null;
	const dieuPhoiPreview = staffRef !== null ? diLam - staffRef : null;

	const tt03Detail = getPreviewFormulaDetail(tt03Preview, nb);
	const recDetail = getPreviewRecDetail(tt03Preview, nb);
	const tt03TypeName = tt03Preview?.tt03
		? getFormulaTypeName(tt03Preview.tt03.formula_type)
		: '';
	const recTypeName = tt03Preview?.recommended
		? getRecFormulaTypeName(tt03Preview.recommended.formula_type)
		: '';

	return (
		<div className='tt03-preview'>
			<div className='tt03-preview-hdr'>
				<span>📋 Nhân lực khuyến cáo</span>
				{previewLoading && (
					<span className='tt03-preview-loading'>⏳ đang tính...</span>
				)}
			</div>

			{tt03Preview ? (
				<div className='tt03-preview-body'>
					{/* ── Cột TT03 ── */}
					<div className='tt03-preview-col'>
						<div className='tt03-preview-col-hdr tt03-col-hdr-blue'>
							📑 Theo TT03
						</div>
						{tt03Preview.tt03 ? (
							<>
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Loại CT</span>
									<span className='tt03-preview-val tt03-formula-tag'>
										{tt03TypeName}
									</span>
								</div>
								{tt03Detail && (
									<div className='tt03-formula-detail'>
										<span className='tt03-preview-lbl'>Công thức</span>
										<code className='tt03-formula-expr'>{tt03Detail}</code>
									</div>
								)}
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Tổng NB</span>
									<span className='tt03-preview-val'>
										{tt03Preview.total_patients} người
									</span>
								</div>
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Kết quả (thô)</span>
									<span className='tt03-preview-val'>
										{tt03Preview.tt03.raw?.toFixed(2) ?? '—'}
									</span>
								</div>
								<div className='tt03-preview-row tt03-preview-main'>
									<span className='tt03-preview-lbl'>Khuyến cáo</span>
									<span className='tt03-preview-kc'>
										{tt03Preview.tt03.staff ?? '—'} người
									</span>
								</div>
							</>
						) : (
							<p className='tt03-preview-empty'>Chưa cấu hình TT03</p>
						)}
					</div>

					{/* ── Cột Khuyến nghị ── */}
					<div className='tt03-preview-col'>
						<div className='tt03-preview-col-hdr tt03-col-hdr-green'>
							💡 Khuyến nghị
						</div>
						{tt03Preview.recommended ? (
							<>
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Loại CT</span>
									<span className='tt03-preview-val tt03-formula-tag tt03-formula-tag-green'>
										{recTypeName}
									</span>
								</div>
								{recDetail && (
									<div className='tt03-formula-detail'>
										<span className='tt03-preview-lbl'>Công thức</span>
										<code className='tt03-formula-expr'>{recDetail}</code>
									</div>
								)}
								<div className='tt03-preview-row'>
									<span className='tt03-preview-lbl'>Kết quả (thô)</span>
									<span className='tt03-preview-val'>
										{tt03Preview.recommended.raw?.toFixed(2) ?? '—'}
									</span>
								</div>
								<div className='tt03-preview-row tt03-preview-main'>
									<span className='tt03-preview-lbl'>Khuyến nghị</span>
									<span className='tt03-preview-kc tt03-preview-kc-green'>
										{tt03Preview.recommended.staff ?? '—'} người
									</span>
								</div>
							</>
						) : (
							<p className='tt03-preview-empty'>Chưa cấu hình khuyến nghị</p>
						)}
					</div>

					{/* ── Điều phối (dựa trên khuyến nghị nếu có, fallback TT03) ── */}
					{dieuPhoiPreview !== null && (
						<div
							className={`tt03-preview-dp tt03-preview-dp-full ${
								dieuPhoiPreview > 0
									? 'dp-ok'
									: dieuPhoiPreview < 0
										? 'dp-warn'
										: 'dp-exact'
							}`}
						>
							{dieuPhoiPreview > 0
								? `✅ Dư +${dieuPhoiPreview} người`
								: dieuPhoiPreview < 0
									? `⚠️ Thiếu ${Math.abs(dieuPhoiPreview)} người`
									: `✔️ Đủ nhân lực`}
							<span className='dp-ref-note'>
								{tt03Preview.recommended
									? '(theo nhân lực khuyến nghị)'
									: '(theo TT03)'}
							</span>
						</div>
					)}
				</div>
			) : (
				<p className='tt03-preview-empty'>
					Nhập số NB để xem khuyến cáo TT03 và nhân lực khuyến nghị
				</p>
			)}
		</div>
	);
}
