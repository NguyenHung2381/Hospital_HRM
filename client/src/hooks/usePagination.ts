import { useMemo, useState } from 'react';

export default function usePagination<T>(data: T[], initialPageSize = 10) {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(initialPageSize);

	// Lưu lại độ dài data và pageSize của lần render trước để đem ra so sánh
	const [prevDataLength, setPrevDataLength] = useState(data.length);
	const [prevPageSize, setPrevPageSize] = useState(initialPageSize);

	const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

	// Thay thế cho useEffect: Cập nhật state trực tiếp trong quá trình render
	if (data.length !== prevDataLength || pageSize !== prevPageSize) {
		setPrevDataLength(data.length);
		setPrevPageSize(pageSize);
		setPage(1);
	}

	// Cắt mảng dữ liệu theo trang hiện tại
	const paginatedData = useMemo(() => {
		const start = (page - 1) * pageSize;
		return data.slice(start, start + pageSize);
	}, [data, page, pageSize]);

	return {
		page,
		setPage,
		pageSize,
		setPageSize,
		totalPages,
		paginatedData,
	};
}
