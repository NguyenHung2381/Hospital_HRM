-- ============================================================================
-- Dữ liệu danh mục ban đầu cho bản cài mới — SINH TỰ ĐỘNG, không sửa tay.
-- Nguồn: SQL Server HRM_HOSPITAL, xuất ngày 2026-11-04 bằng
--   cd server && npm run db:export-seed
-- Nạp bởi npm run setup (chế độ "Cài mới") khi bảng roles còn trống.
-- Gồm: vai trò, quyền, quyền theo vai trò, khoa phòng, cấu hình TT03,
-- cấu hình khuyến nghị. Không có tài khoản người dùng.
-- ============================================================================

SET client_encoding = 'UTF8';
BEGIN;

-- roles (5 dòng)
INSERT INTO roles (id_role, name_role, description, icon, color, is_system, department_access_type) VALUES
	(1, 'Quản trị hệ thống', 'Toàn quyền hệ thống', '🔑', 'red', true, 'all'),
	(2, 'Giám đốc', 'Xem toàn bộ tất cả các khoa', '👔', 'blue', true, 'all'),
	(3, 'Điều dưỡng trưởng BV', 'Xem các khoa được Admin phân quyền', '🏥', 'purple', false, 'assigned'),
	(4, 'Điều dưỡng trưởng khoa', 'Xem các khoa được Admin phân quyền', '🩺', 'teal', false, 'assigned'),
	(5, 'Nhân viên', 'Chỉ xem khoa đang công tác của mình', '👤', 'gray', false, 'own');

-- permissions (10 dòng)
INSERT INTO permissions (id_permission, code_permission, label, group_name, sort_order) VALUES
	(1, 'view_own_dept', 'Xem dữ liệu khoa của mình', 'Xem dữ liệu', 1),
	(2, 'view_assigned_depts', 'Xem dữ liệu khoa được phân', 'Xem dữ liệu', 2),
	(3, 'view_all_depts', 'Xem dữ liệu tất cả khoa', 'Xem dữ liệu', 3),
	(4, 'edit_daily_data', 'Nhập / sửa dữ liệu ngày', 'Thao tác dữ liệu', 4),
	(5, 'delete_record', 'Xoá bản ghi', 'Thao tác dữ liệu', 5),
	(6, 'export_report', 'Xuất báo cáo', 'Thao tác dữ liệu', 6),
	(7, 'manage_accounts', 'Quản lý tài khoản', 'Quản trị hệ thống', 7),
	(8, 'manage_roles', 'Phân quyền', 'Quản trị hệ thống', 8),
	(9, 'manage_departments', 'Quản lý khoa phòng', 'Quản trị hệ thống', 9),
	(10, 'edit_dept_info', 'Sửa thông tin khoa', 'Quản trị hệ thống', 10);

-- role_permissions (30 dòng)
INSERT INTO role_permissions (id_role, id_permission, is_granted) VALUES
	(3, 1, false),
	(3, 2, true),
	(3, 3, false),
	(3, 4, true),
	(3, 5, true),
	(3, 6, true),
	(3, 7, true),
	(3, 8, true),
	(3, 9, true),
	(3, 10, true),
	(4, 1, false),
	(4, 2, true),
	(4, 3, false),
	(4, 4, true),
	(4, 5, true),
	(4, 6, true),
	(4, 7, false),
	(4, 8, false),
	(4, 9, false),
	(4, 10, false),
	(5, 1, true),
	(5, 2, false),
	(5, 3, false),
	(5, 4, true),
	(5, 5, true),
	(5, 6, false),
	(5, 7, false),
	(5, 8, false),
	(5, 9, false),
	(5, 10, false);

-- departments (47 dòng)
INSERT INTO departments (id_department, name_department, code_department, bed_count, coef_level_1, coef_level_2, coef_level_3, coef_total, total_staff, status, formula_type, fixed_staff_add, dept_group) VALUES
	(1, 'Y học cổ truyền', NULL, 20, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(2, 'Phục hồi chức năng', 'K002', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(3, 'Nội thận', 'K003', 20, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(4, 'Nhiễm khuẩn tổng hợp', 'K004', 20, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(5, 'TT Đột quỵ', 'K005', 10, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(6, 'Hồi sức tích cực', 'K006', NULL, 1, 0.5, 0.25, 0.2, NULL, 'active', NULL, NULL, 'ward'),
	(7, 'Hồi sức ngoại khoa', NULL, NULL, 1, 0.5, 0.25, 0.2, NULL, 'active', NULL, NULL, 'ward'),
	(8, 'Chống độc', 'K008', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(9, 'Gây mê hồi sức', 'K009', 20, 0.5, 0.104, 0.104, 0.15, NULL, 'active', NULL, NULL, 'ward'),
	(10, 'Răng hàm mặt', 'K010', 1, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(11, 'Cơ xương khớp', 'K011', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(12, 'Nội tiết - ĐTĐ', 'K012', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(13, 'Nội dị ứng- hô hấp', 'K013', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(14, 'Nội dị ứng lâm sàng', 'K014', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(15, 'Nội tim mạch 1', 'K015', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(16, 'Nội tim mạch 2', 'K016', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(17, 'Tim mạch lồng ngực', 'K017', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(18, 'Thần kinh', 'K018', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(19, 'Tai mũi họng', 'K019', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(20, 'Nội tiêu hóa', 'K020', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(21, 'Ngoại tổng hợp 2', 'K021', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(22, 'Chấn thương', 'K022', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(23, 'Bỏng', 'K023', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(24, 'Phẫu thuật cột sống', 'K024', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(25, 'TT Hỗ trợ sinh sản', 'K025', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(26, 'Sản phụ', 'K026', NULL, 0.5, 0.125, 0.125, 0.13, NULL, 'active', NULL, NULL, 'ward'),
	(27, 'Ngoại tiêu hóa', 'K027', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(28, 'Thẩm mỹ', 'K028', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(29, 'Nhi sơ sinh', 'K029', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(30, 'Ngoại thận - tiết niệu', 'K030', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(31, 'Ngoại tổng hợp 1', 'K031', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(32, 'Virut- ký sinh trùng', 'K032', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(33, 'Cấp cứu', 'K033', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(34, 'Nội A- Lão khoa', 'K034', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(35, 'Huyết học lâm sàng', NULL, NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(36, 'Mắt', 'K036', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(37, 'Khoa Da liễu', NULL, NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'ward'),
	(38, 'Huyết học', 'CLS01', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(39, 'Hóa sinh', 'CLS02', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(40, 'Vi sinh', 'CLS03', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(41, 'Sinh học phân tử', 'CLS04', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(42, 'Giải phẫu bệnh', 'CLS05', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(43, 'Thăm dò chức năng', 'CLS06', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(44, 'X.Quang', 'CLS07', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(45, 'Kiểm soát nhiễm khuẩn', 'CLS08', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(46, 'Dinh dưỡng', 'CLS09', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls'),
	(47, 'Khám bệnh', 'CLS10', NULL, 0.5, 0.104, 0.104, 0.12, NULL, 'active', NULL, NULL, 'cls');

-- dept_tt03_config (37 dòng)
INSERT INTO dept_tt03_config (id, id_department, formula_type, patient_ratio, shift_divisor, shift_multiplier, fixed_add, note) VALUES
	(1, 1, 'custom_coef', 0.6, 3, 2, 0, ''),
	(2, 2, 'custom_coef', 0.5, 3, 2, 0, 'Phục hồi chức năng: dùng hệ số từ coef_*'),
	(3, 3, 'standard', 0.6, 1, 1, 9.2, 'Nội thận: +9.2 cho máy lọc thận'),
	(4, 4, 'standard', 0.6, 3, 2, 20, 'Nhiễm khuẩn tổng hợp: +20 khu cách ly'),
	(5, 5, 'standard', 0.6, 3, 2, 10, 'TT Đột quỵ: +10 đơn vị đột quỵ'),
	(6, 6, 'icu', 2, 3, 2, 0, 'Hồi sức tích cực'),
	(7, 7, 'icu', 2, 3, 2, 0, 'Hồi sức ngoại khoa'),
	(8, 8, 'icu', 2, 3, 2, 0, 'Chống độc'),
	(9, 9, 'surgery', 4, 3, 2, 0, 'Gây mê hồi sức: 4 người/bàn mổ, dùng bed_count'),
	(10, 10, 'standard', 0.6, 3, 2, 1, 'Răng hàm mặt: +1'),
	(11, 11, 'standard', 0.6, 3, 2, 0, 'Cơ xương khớp'),
	(12, 12, 'standard', 0.6, 3, 2, 0, 'Nội tiết - ĐTĐ'),
	(13, 13, 'standard', 0.6, 3, 2, 0, 'Nội dị ứng - hô hấp'),
	(14, 14, 'standard', 0.6, 3, 2, 0, 'Nội dị ứng lâm sàng'),
	(15, 15, 'standard', 0.6, 3, 2, 0, 'Nội tim mạch 1'),
	(16, 16, 'standard', 0.6, 3, 2, 0, 'Nội tim mạch 2'),
	(17, 17, 'standard', 0.6, 3, 2, 0, 'Tim mạch lồng ngực'),
	(18, 18, 'standard', 0.6, 3, 2, 0, 'Thần kinh'),
	(19, 19, 'standard', 0.6, 3, 2, 0, 'Tai mũi họng'),
	(20, 20, 'standard', 0.6, 3, 2, 0, 'Nội tiêu hóa'),
	(21, 21, 'standard', 0.6, 3, 2, 0, 'Ngoại tổng hợp 2'),
	(22, 22, 'standard', 0.6, 3, 2, 0, 'Chấn thương'),
	(23, 23, 'standard', 0.6, 3, 2, 0, 'Bỏng'),
	(24, 24, 'standard', 0.6, 3, 2, 0, 'Phẫu thuật cột sống'),
	(25, 25, 'standard', 0.6, 3, 2, 0, 'TT Hỗ trợ sinh sản'),
	(26, 26, 'standard', 0.6, 3, 2, 0, 'Sản phụ'),
	(27, 27, 'standard', 0.6, 3, 2, 0, 'Ngoại tiêu hóa'),
	(28, 28, 'standard', 0.6, 3, 2, 0, 'Thẩm mỹ'),
	(29, 29, 'standard', 0.6, 3, 2, 0, 'Nhi sơ sinh'),
	(30, 30, 'standard', 0.6, 3, 2, 0, 'Ngoại thận - tiết niệu'),
	(31, 31, 'standard', 0.6, 3, 2, 0, 'Ngoại tổng hợp 1'),
	(32, 32, 'standard', 0.6, 3, 2, 0, 'Virut - ký sinh trùng'),
	(33, 33, 'standard', 0.6, 3, 2, 0, 'Cấp cứu (cần xác nhận lại công thức)'),
	(34, 34, 'standard', 0.6, 3, 2, 0, 'Nội A - Lão khoa'),
	(35, 35, 'standard', 0.6, 3, 2, 0, 'Huyết học lâm sàng'),
	(36, 36, 'standard', 0.6, 3, 2, 0, 'Mắt'),
	(37, 37, 'standard', 0.6, 3, 2, 0, NULL);

-- dept_recommended_config (47 dòng)
INSERT INTO dept_recommended_config (id, id_department, formula_type, coef_l1, coef_l2, coef_l3, outpatient_ratio, fixed_add, note) VALUES
	(1, 1, 'coef_with_total', 0.5, 0.104, 0.104, 0.12, 0, 'Y học cổ truyền'),
	(2, 2, 'coef_with_total', 0.5, 0.104, 0.104, 0.1, 0, 'Phục hồi chức năng'),
	(3, 3, 'coef', 0.5, 0.104, 0.104, NULL, 10, 'Nội thận'),
	(4, 4, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Nhiễm khuẩn tổng hợp'),
	(5, 5, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'TT Đột quỵ'),
	(6, 6, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Hồi sức tích cực'),
	(7, 7, 'coef', 0.5, 0.125, 0.125, NULL, 5, 'Hồi sức ngoại khoa: +5'),
	(8, 8, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Chống độc'),
	(9, 9, 'outpatient_count', 0.5, 0.104, 0.104, 2, 0, 'Gây mê: PT_KH * 0.2 (4 người/bàn)'),
	(10, 10, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Răng hàm mặt'),
	(11, 11, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Cơ xương khớp'),
	(12, 12, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Nội tiết - ĐTĐ'),
	(13, 13, 'coef', 0.5, 0.104, 0.104, NULL, 1, 'Nội dị ứng- hô hấp: +1'),
	(14, 14, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Nội dị ứng lâm sàng'),
	(15, 15, 'coef', 0.5, 0.104, 0.104, NULL, 3, 'Nội tim mạch 1: +2'),
	(16, 16, 'coef', 0.5, 0.104, 0.104, NULL, 2, 'Nội tim mạch 2: +2'),
	(17, 17, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Tim mạch lồng ngực'),
	(18, 18, 'coef', 0.5, 0.104, 0.104, NULL, 2, 'Thần kinh: +2'),
	(19, 19, 'coef', 0.5, 0.125, 0.125, NULL, 1, 'Tai mũi họng: +1'),
	(20, 20, 'coef', 0.5, 0.104, 0.104, NULL, 6, 'Nội tiêu hóa: +3'),
	(21, 21, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Ngoại tổng hợp 2'),
	(22, 22, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Chấn thương'),
	(23, 23, 'coef', 0.5, 0.125, 0.125, NULL, 1, 'Bỏng'),
	(24, 24, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Phẫu thuật cột sống'),
	(25, 25, 'coef_with_outpatient', 0.5, 0.125, 0.125, 0.03, 8, 'TT Hỗ trợ sinh sản: +8 '),
	(26, 26, 'coef', 0.5, 0.125, 0.125, NULL, 5, 'Sản phụ: +5'),
	(27, 27, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Ngoại tiêu hóa'),
	(28, 28, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Thẩm mỹ'),
	(29, 29, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Nhi sơ sinh'),
	(30, 30, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Ngoại thân - tiết niệu'),
	(31, 31, 'coef', 0.5, 0.125, 0.125, NULL, 0, 'Ngoại tổng hợp 1'),
	(32, 32, 'coef', 0.5, 0.104, 0.104, NULL, 3, 'Virut- ký sinh trùng'),
	(33, 33, 'total_ratio', 0.5, 0.104, 0.104, 0.4, 0, 'Cấp cứu: Total * 0.4'),
	(34, 34, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Nội A- Lão khoa'),
	(35, 35, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Huyết học lâm sàng'),
	(36, 36, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Mắt'),
	(37, 37, 'coef', 0.5, 0.104, 0.104, NULL, 0, 'Da liễu'),
	(38, 38, 'fixed', 0, 0, 0, NULL, 32, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(39, 39, 'fixed', 0, 0, 0, NULL, 31, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(40, 40, 'fixed', 0, 0, 0, NULL, 18, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(41, 41, 'fixed', 0, 0, 0, NULL, 15, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(42, 42, 'fixed', 0, 0, 0, NULL, 18, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(43, 43, 'fixed', 0, 0, 0, NULL, 46, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(44, 44, 'fixed', 0, 0, 0, NULL, 51, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(45, 45, 'fixed', 0, 0, 0, NULL, 61, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(46, 46, 'fixed', 0, 0, 0, NULL, 24, 'Nhân lực khuyến cáo cố định — hệ CLS'),
	(47, 47, 'fixed', 0, 0, 0, NULL, 89, 'Nhân lực khuyến cáo cố định — hệ CLS');

-- Đẩy sequence IDENTITY lên MAX(id) để thêm mới không trùng khoá
SELECT setval(pg_get_serial_sequence('roles', 'id_role'), COALESCE((SELECT MAX(id_role) FROM roles), 1), (SELECT COUNT(*) > 0 FROM roles));
SELECT setval(pg_get_serial_sequence('permissions', 'id_permission'), COALESCE((SELECT MAX(id_permission) FROM permissions), 1), (SELECT COUNT(*) > 0 FROM permissions));
SELECT setval(pg_get_serial_sequence('departments', 'id_department'), COALESCE((SELECT MAX(id_department) FROM departments), 1), (SELECT COUNT(*) > 0 FROM departments));
SELECT setval(pg_get_serial_sequence('dept_tt03_config', 'id'), COALESCE((SELECT MAX(id) FROM dept_tt03_config), 1), (SELECT COUNT(*) > 0 FROM dept_tt03_config));
SELECT setval(pg_get_serial_sequence('dept_recommended_config', 'id'), COALESCE((SELECT MAX(id) FROM dept_recommended_config), 1), (SELECT COUNT(*) > 0 FROM dept_recommended_config));

COMMIT;
