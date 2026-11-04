-- ============================================================================
-- Chạy SAU KHI nạp dữ liệu từ SQL Server (giữ nguyên id cũ): đẩy mọi
-- sequence IDENTITY lên MAX(id) hiện có, nếu không INSERT tiếp theo sẽ trùng
-- khoá chính. Idempotent — chạy lại bao nhiêu lần cũng được.
--   psql -U hrm_owner -d hrm_hospital -v ON_ERROR_STOP=1 -f 900_reset_sequences.sql
-- ============================================================================

DO $$
DECLARE
	rec record;
	v_max bigint;
BEGIN
	FOR rec IN
		SELECT c.table_name, c.column_name,
		       pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
		FROM information_schema.columns c
		WHERE c.table_schema = 'public' AND c.is_identity = 'YES'
	LOOP
		EXECUTE format('SELECT MAX(%I) FROM %I', rec.column_name, rec.table_name) INTO v_max;
		IF v_max IS NULL THEN
			PERFORM setval(rec.seq, 1, false);
		ELSE
			PERFORM setval(rec.seq, v_max, true);
		END IF;
		RAISE NOTICE '%.% → %', rec.table_name, rec.column_name, COALESCE(v_max, 0);
	END LOOP;
END
$$;
