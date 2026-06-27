import SearchIcon from '@/assets/svg/SearchIcon';

interface SearchInputProps {
	value: string;
	onChange: (val: string) => void;
	placeholder?: string;
	className?: string;
}

export default function SearchInput({
	value,
	onChange,
	placeholder = 'Tìm kiếm...',
	className = '',
}: SearchInputProps) {
	return (
		<div className={`search-wrap ${className}`}>
			<SearchIcon />
			<input
				className='search-inp'
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
}
