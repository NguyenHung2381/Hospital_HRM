import { useState } from 'react';
import { getTodayDateString } from '@/utils/dateUtils';

/**
 * Validate ngày nhập bản ghi mới: không được để trống, không trong quá khứ,
 * không trùng ngày đã có bản ghi. Dùng chung cho DailyStaffingForm và CLSStaffingForm.
 */
export function useDateValidation(existingDates: string[] = []) {
	const [dateError, setDateError] = useState('');
	const existingDateSet = new Set(existingDates);
	const todayStr = getTodayDateString();

	const validateDate = (dateStr: string): string => {
		if (!dateStr) return 'Vui lòng chọn ngày';
		if (dateStr < todayStr) return 'Không thể thêm bản ghi cho ngày trong quá khứ';
		if (existingDateSet.has(dateStr))
			return 'Ngày này đã có bản ghi, vui lòng chọn ngày khác';
		return '';
	};

	return { dateError, setDateError, validateDate, todayStr };
}
