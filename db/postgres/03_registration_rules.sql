-- ============================================================
-- 03_registration_rules.sql
-- T5: a user may register for a contest only while it is still open.
--
-- Why a trigger and not a CHECK constraint?
--   A CHECK can only look at the row being inserted. This rule needs the
--   contest's end_time and status, which live in ANOTHER table (contests).
--
-- Why in the database and not only in the API?
--   Any path that inserts a registration (API, psql, a future script) is
--   covered. Without it, someone who registers after the contest ended
--   (but before finalize) is counted by finalize_contest() and gets rated.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_validate_registration() RETURNS trigger AS $$
DECLARE
    v_end    TIMESTAMPTZ;
    v_status TEXT;
BEGIN
    SELECT end_time, status INTO v_end, v_status
    FROM contests WHERE contest_id = NEW.contest_id;

    IF NOT FOUND THEN
        RETURN NEW;   -- the foreign key reports a missing contest with its own error
    END IF;

    IF v_status = 'finished' OR now() > v_end THEN
        RAISE EXCEPTION 'Registration closed: contest % has ended', NEW.contest_id
              USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registrations_validate ON contest_registrations;
CREATE TRIGGER trg_registrations_validate
    BEFORE INSERT ON contest_registrations
    FOR EACH ROW EXECUTE FUNCTION fn_validate_registration();
