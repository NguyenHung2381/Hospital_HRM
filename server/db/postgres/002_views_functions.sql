-- ============================================================================
-- View + hàm (chuyển từ dbo.vw_TT03_Recommended, dbo.usp_Recalc_All,
-- dbo.usp_Recalc_TT03). Chạy sau 001_init.sql, bằng hrm_owner.
-- File idempotent (CREATE OR REPLACE) — sửa công thức thì chạy lại file này.
--
-- Giữ nguyên công thức và các phép CAST của bản SQL Server (kể cả việc ép
-- coef_level_* từ numeric(5,4) về numeric(10,3), tức làm tròn 3 chữ số) để
-- kết quả tính lại khớp với dữ liệu đã lưu.
-- Cột L1/L2/L3/total_NB → l1/l2/l3/total_nb (PostgreSQL hạ chữ thường; câu
-- SELECT L1 ... không có "" trong code vẫn khớp).
-- Lưu ý (giữ nguyên hành vi cũ): formula_type 'coef_with_total' của Khuyến
-- nghị KHÔNG có trong view → rec_staff_calc = NULL cho loại này.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW vw_tt03_recommended AS
SELECT
	r.id                         AS record_id,
	r.id_report,
	r.id_department,
	d.name_department,
	d.code_department,

	-- ── Công thức TT03 ─────────────────────────────────────
	cfg_tt.formula_type          AS tt03_formula_type,
	cfg_tt.note                  AS tt03_formula_note,

	-- Đầu vào
	r.patient_level_1            AS l1,
	r.patient_level_2            AS l2,
	r.patient_level_3            AS l3,
	calc.total_nb,
	r.outpatient_cnt,
	d.bed_count,

	-- Nhân lực hiện tại
	r.total_staff,
	r.staff_working,

	-- TT03 đã lưu
	r.recommended_staff          AS tt03_staff_saved,

	-- TT03 tính lại theo công thức
	calc.tt03_staff_calc,

	-- ── Nhân lực Khuyến nghị ───────────────────────────────
	cfg_rc.formula_type          AS rec_formula_type,
	cfg_rc.note                  AS rec_formula_note,
	r.recommended_staff_calc     AS rec_staff_saved,
	calc.rec_staff_calc,

	-- Chênh lệch TT03
	r.staff_working - calc.tt03_staff_calc AS tt03_surplus_deficit,

	r.coordination,
	r.note                       AS record_note,
	r.created_at,
	r.updated_at
FROM report_department_records r
INNER JOIN departments d
	ON r.id_department = d.id_department
LEFT JOIN dept_tt03_config cfg_tt
	ON r.id_department = cfg_tt.id_department
LEFT JOIN dept_recommended_config cfg_rc
	ON r.id_department = cfg_rc.id_department
CROSS JOIN LATERAL (
	SELECT
		t.total_nb,
		CAST(
			CASE cfg_tt.formula_type
				WHEN 'standard' THEN
					( t.total_nb::numeric(10,3)
					  * cfg_tt.patient_ratio
					  / cfg_tt.shift_divisor
					  * cfg_tt.shift_multiplier
					) + COALESCE(cfg_tt.fixed_add, 0)
				WHEN 'icu' THEN
					( t.total_nb::numeric(10,3)
					  * cfg_tt.patient_ratio
					  / cfg_tt.shift_divisor
					  * cfg_tt.shift_multiplier
					)
				WHEN 'surgery' THEN
					( COALESCE(d.bed_count, 0)::numeric(10,3)
					  * cfg_tt.patient_ratio
					  / cfg_tt.shift_divisor
					  * cfg_tt.shift_multiplier
					)
				WHEN 'custom_coef' THEN
					( t.l1 * d.coef_level_1::numeric(10,3) )
				  + ( t.l2 * d.coef_level_2::numeric(10,3) )
				  + ( t.l3 * d.coef_level_3::numeric(10,3) )
				  + ( t.total_nb::numeric(10,3) * d.coef_total::numeric(10,3) )
				ELSE NULL
			END
		AS numeric(8,2)) AS tt03_staff_calc,
		CAST(
			CASE cfg_rc.formula_type
				-- Phổ biến: L1*coef_l1 + L2*coef_l2 + L3*coef_l3 + fixed_add
				WHEN 'coef' THEN
					( t.l1 * cfg_rc.coef_l1::numeric(10,4) )
				  + ( t.l2 * cfg_rc.coef_l2::numeric(10,4) )
				  + ( t.l3 * cfg_rc.coef_l3::numeric(10,4) )
				  + COALESCE(cfg_rc.fixed_add, 0)
				-- Cấp cứu: (L1+L2+L3) * ratio
				WHEN 'total_ratio' THEN
					t.total_nb::numeric(10,3) * COALESCE(cfg_rc.outpatient_ratio, 0)
				  + COALESCE(cfg_rc.fixed_add, 0)
				-- Gây mê: outpatient_cnt * ratio
				WHEN 'outpatient_count' THEN
					COALESCE(r.outpatient_cnt, 0)::numeric(10,3) * COALESCE(cfg_rc.outpatient_ratio, 0)
				  + COALESCE(cfg_rc.fixed_add, 0)
				ELSE NULL
			END
		AS numeric(8,2)) AS rec_staff_calc
	FROM (
		SELECT
			COALESCE(r.patient_level_1, 0) AS l1,
			COALESCE(r.patient_level_2, 0) AS l2,
			COALESCE(r.patient_level_3, 0) AS l3,
			COALESCE(r.patient_level_1, 0)
			  + COALESCE(r.patient_level_2, 0)
			  + COALESCE(r.patient_level_3, 0) AS total_nb
	) t
) calc;

-- Tính lại recommended_staff (TT03) + recommended_staff_calc (Khuyến nghị)
-- từ view. p_id_report NULL = mọi báo cáo. Trả về số bản ghi đã cập nhật.
--   SELECT usp_recalc_all();      SELECT usp_recalc_all(123);
CREATE OR REPLACE FUNCTION usp_recalc_all(p_id_report integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
	v_count integer;
BEGIN
	UPDATE report_department_records r
	-- trunc(): SQL Server CAST(numeric AS SMALLINT) CẮT phần thập phân,
	-- còn PostgreSQL ::smallint làm tròn → phải trunc để giữ hành vi cũ.
	SET recommended_staff      = trunc(v.tt03_staff_calc)::smallint,
	    recommended_staff_calc = trunc(v.rec_staff_calc)::smallint,
	    updated_at             = now()
	FROM vw_tt03_recommended v
	WHERE r.id = v.record_id
	  AND (v.tt03_staff_calc IS NOT NULL OR v.rec_staff_calc IS NOT NULL)
	  AND (p_id_report IS NULL OR r.id_report = p_id_report);

	GET DIAGNOSTICS v_count = ROW_COUNT;
	RAISE NOTICE '% bản ghi đã được cập nhật (TT03 + Khuyến nghị).', v_count;
	RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION usp_recalc_tt03(p_id_report integer DEFAULT NULL)
RETURNS integer
LANGUAGE sql
AS $$ SELECT usp_recalc_all(p_id_report); $$;

COMMIT;
