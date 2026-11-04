interface StatusBadgeProps {
	status: 'active' | 'inactive' | string;
	activeLabel?: string;
	inactiveLabel?: string;
}

export default function StatusBadge({
	status,
	activeLabel = 'Hoạt động',
	inactiveLabel = 'Tạm dừng',
}: StatusBadgeProps) {
	const isActive = status === 'active';
	return (
		<span className={`status-dot ${isActive ? 'status-dot-on' : 'status-dot-off'}`}>
			{isActive ? activeLabel : inactiveLabel}
		</span>
	);
}
