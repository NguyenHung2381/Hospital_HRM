import StatCard from '@/components/ui/StatCard';
import type {
	ComputedStats,
	DailyRecord,
	DeptConfig,
} from '@/types/staffingType';

const fmt = (v: number | null | undefined, dec = 2) => {
	if (v == null || !isFinite(v)) return '—';
	if (dec === 0 || Number.isInteger(v)) return String(Math.round(v));
	return v.toFixed(dec).replace(/\.?0+$/, '');
};

const diffTag = (v: number) => {
	if (v > 0) return <span className='tag tag-green'>Dư +{v} người</span>;
	if (v < 0)
		return <span className='tag tag-red'>Thiếu {Math.abs(v)} người</span>;
	return <span className='tag tag-blue'>Đủ nhân lực</span>;
};

// ── 1. Thống kê tổng quan ────────────────────────────────────
export function DailyStatsOverview({
	active,
	computed,
}: {
	active: DailyRecord;
	computed: ComputedStats | null;
}) {
	return (
		<div className='stats-row'>
			<StatCard
				icon='🛏️'
				label='Tổng người bệnh'
				value={computed ? fmt(computed.tongNB, 0) : '—'}
				accent='blue'
			/>
			<StatCard
				icon='🩺'
				label='NB khám / PT'
				value={fmt(active.nbKhamPT ?? 0, 0)}
				accent='purple'
			/>
			<StatCard
				icon='👥'
				label='Tổng nhân lực'
				value={fmt(active.nl.tong ?? 0, 0)}
				accent='teal'
			/>
			<StatCard
				icon='✅'
				label='Đi làm'
				value={computed ? fmt(computed.diLam, 0) : '—'}
				accent='green'
			/>
			<StatCard
				icon={computed && computed.dieuPhoi >= 0 ? '⬆️' : '⬇️'}
				label='Điều phối'
				value={
					computed
						? computed.dieuPhoi >= 0
							? `+${computed.dieuPhoi}`
							: String(computed.dieuPhoi)
						: '—'
				}
				accent={
					computed
						? computed.dieuPhoi > 0
							? 'surplus'
							: computed.dieuPhoi < 0
								? 'deficit'
								: 'balanced'
						: 'neutral'
				}
			/>
		</div>
	);
}

// ── 2. Người bệnh theo cấp độ ────────────────────────────────
export function PatientStatsCard({
	active,
	computed,
}: {
	active: DailyRecord;
	computed: ComputedStats | null;
}) {
	return (
		<section className='dcard'>
			<h2 className='dcard-title'>🏥 Người bệnh theo cấp độ</h2>
			<div className='cap-row'>
				{[
					{
						label: 'Cấp 1 (CSC1)',
						val: active.nb.cap1,
						desc: 'Nặng / Nguy kịch',
						color: 'cap-red',
					},
					{
						label: 'Cấp 2 (CSC2)',
						val: active.nb.cap2,
						desc: 'Trung bình',
						color: 'cap-yellow',
					},
					{
						label: 'Cấp 3 (CSC3)',
						val: active.nb.cap3,
						desc: 'Nhẹ / Ổn định',
						color: 'cap-green',
					},
				].map((c) => (
					<div
						key={c.label}
						className={`cap-box ${c.color}`}
					>
						<span className='cap-num'>{fmt(c.val ?? 0, 0)}</span>
						<span className='cap-label'>{c.label}</span>
						<span className='cap-desc'>{c.desc}</span>
					</div>
				))}
			</div>
			<div className='nb-total-row'>
				<span>
					Tổng người bệnh = {fmt(active.nb.cap1 ?? 0, 0)} +{' '}
					{fmt(active.nb.cap2 ?? 0, 0)} + {fmt(active.nb.cap3 ?? 0, 0)}
				</span>
				<span className='nb-total-val'>
					{computed ? fmt(computed.tongNB, 0) : '—'} người
				</span>
			</div>
			<div className='info-row'>
				<span className='info-lbl'>NB khám / Phẫu thuật KH</span>
				<span className='info-val'>{fmt(active.nbKhamPT ?? 0, 0)}</span>
			</div>
		</section>
	);
}

// ── 3. Nhân lực đi làm ───────────────────────────────────────
export function StaffingDetailCard({
	active,
	computed,
}: {
	active: DailyRecord;
	computed: ComputedStats | null;
}) {
	return (
		<section className='dcard'>
			<h2 className='dcard-title'>👩‍⚕️ Nhân lực ĐD – Hộ sinh – KTV</h2>
			<div className='nl-grid'>
				<div className='nl-box nl-total'>
					<span className='nl-num'>{fmt(active.nl.tong ?? 0, 0)}</span>
					<span className='nl-lbl'>Tổng</span>
				</div>
				<div className='nl-box nl-diLam'>
					<span className='nl-num c-green'>
						{computed ? fmt(computed.diLam, 0) : '—'}
					</span>
					<span className='nl-lbl'>Đi làm</span>
					<span className='nl-formula'>
						= Tổng - Nghỉ trực - Nghỉ &gt;2 ngày
					</span>
				</div>
				<div className='nl-box'>
					<span className='nl-num c-yellow'>
						{fmt(active.nl.nghiTruc ?? 0, 0)}
					</span>
					<span className='nl-lbl'>Nghỉ trực</span>
				</div>
				<div className='nl-box'>
					<span className='nl-num c-red'>
						{fmt(active.nl.nghiTren2Ngay ?? 0, 0)}
					</span>
					<span className='nl-lbl'>Nghỉ &gt; 2 ngày</span>
				</div>
			</div>
		</section>
	);
}

// ── 4. Công thức khuyến cáo TT03 ─────────────────────────────
export function FormulaPreviewCard({
	active,
	dept,
	computed,
}: {
	active: DailyRecord;
	dept: DeptConfig;
	computed: ComputedStats | null;
}) {
	const formulaLabel = (() => {
		switch (dept.formulaType) {
			case 'icu':
				return `(Tổng NB × ${dept.heSo.patientRatio}) / ${dept.heSo.shiftDivisor ?? 3} × ${dept.heSo.shiftMultiplier ?? 2}`;
			case 'surgery':
				return `(Giường/Bàn × ${dept.heSo.patientRatio}) / ${dept.heSo.shiftDivisor ?? 3} × ${dept.heSo.shiftMultiplier ?? 2}`;
			case 'standard':
				return `(Tổng NB × ${dept.heSo.patientRatio}) / ${dept.heSo.shiftDivisor ?? 3} × ${dept.heSo.shiftMultiplier ?? 2}${(dept.heSo.fixedAdd ?? 0) > 0 ? ` + ${dept.heSo.fixedAdd}` : ''}`;
			default:
				return `(CSC1 × ${dept.heSo.cap1}) + (CSC2 × ${dept.heSo.cap2}) + (CSC3 × ${dept.heSo.cap3}) + (Tổng × ${dept.heSo.tong})`;
		}
	})();

	const formulaCalcDetail = (() => {
		const c1 = active.nb.cap1 ?? 0;
		const c2 = active.nb.cap2 ?? 0;
		const c3 = active.nb.cap3 ?? 0;
		const tong = c1 + c2 + c3;
		switch (dept.formulaType) {
			case 'icu':
				return `= (${tong} × ${dept.heSo.patientRatio}) / ${dept.heSo.shiftDivisor ?? 3} × ${dept.heSo.shiftMultiplier ?? 2}`;
			case 'surgery':
				return `= (${dept.giuongMay ?? 0} × ${dept.heSo.patientRatio}) / ${dept.heSo.shiftDivisor ?? 3} × ${dept.heSo.shiftMultiplier ?? 2}`;
			case 'standard':
				return `= (${tong} × ${dept.heSo.patientRatio}) / ${dept.heSo.shiftDivisor ?? 3} × ${dept.heSo.shiftMultiplier ?? 2}${(dept.heSo.fixedAdd ?? 0) > 0 ? ` + ${dept.heSo.fixedAdd}` : ''}`;
			default:
				return `= (${c1} × ${dept.heSo.cap1}) + (${c2} × ${dept.heSo.cap2}) + (${c3} × ${dept.heSo.cap3}) + (${tong} × ${dept.heSo.tong})`;
		}
	})();

	return (
		<section className='dcard dcard-formula'>
			<h2 className='dcard-title'>📋 Nhân lực khuyến cáo theo TT 03</h2>
			<div className='formula-box'>
				<p className='formula-label'>Công thức tính:</p>
				<code className='formula-code'>{formulaLabel}</code>
				<div className='formula-calc'>{formulaCalcDetail}</div>
			</div>
			<div className='kc-display'>
				<div className='kc-result'>
					<span className='kc-result-label'>Nhân lực KC theo TT 03</span>
					<span className='kc-result-val'>
						{computed ? fmt(computed.tt03, 2) : '—'}
					</span>
				</div>
				<div className='kc-result'>
					<span className='kc-result-label'>Nhân lực theo khuyến cáo</span>
					<span className='kc-result-val'>
						{computed ? fmt(computed.khuyenCao, 2) : '—'}
					</span>
				</div>
			</div>
			<div
				className={`dp-box ${computed && computed.dieuPhoi > 0 ? 'dp-surplus' : computed && computed.dieuPhoi < 0 ? 'dp-deficit' : 'dp-balanced'}`}
			>
				<div>
					<p className='dp-lbl'>Điều phối nhân lực</p>
					<p className='dp-sub'>
						= Đi làm ({computed ? fmt(computed.diLam, 0) : 0}) - Khuyến cáo (
						{computed ? fmt(computed.khuyenCao, 0) : 0})
					</p>
				</div>
				<div>{computed && diffTag(computed.dieuPhoi)}</div>
			</div>
		</section>
	);
}
