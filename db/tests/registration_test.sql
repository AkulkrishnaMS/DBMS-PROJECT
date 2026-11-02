-- Tests for T5 (03_registration_rules.sql). Everything is rolled back at the end.
-- Run: docker exec -i judge_postgres psql -U "$PG_USER" -d "$PG_DB" < db/tests/registration_test.sql
BEGIN;

INSERT INTO users(username, email, password_hash, role) VALUES
  ('regtest_admin', 'regtest_admin@test.com', 'x', 'admin'),
  ('regtest_user',  'regtest_user@test.com',  'x', 'contestant');

INSERT INTO contests(organizer_id, name, start_time, end_time)
SELECT user_id, 'RegTest Open',  now() - interval '1 hour', now() + interval '1 hour'
FROM users WHERE username = 'regtest_admin';
INSERT INTO contests(organizer_id, name, start_time, end_time)
SELECT user_id, 'RegTest Ended', now() - interval '2 hours', now() - interval '1 hour'
FROM users WHERE username = 'regtest_admin';

DO $$
DECLARE
    v_user INT := (SELECT user_id FROM users WHERE username = 'regtest_user');
    v_open INT := (SELECT contest_id FROM contests WHERE name = 'RegTest Open');
    v_done INT := (SELECT contest_id FROM contests WHERE name = 'RegTest Ended');
BEGIN
    -- R1: a running contest accepts the registration
    INSERT INTO contest_registrations(contest_id, user_id) VALUES (v_open, v_user);
    RAISE NOTICE 'PASS R1: registration for a running contest accepted';

    -- R2: an ended contest rejects it
    BEGIN
        INSERT INTO contest_registrations(contest_id, user_id) VALUES (v_done, v_user);
        RAISE EXCEPTION 'FAIL R2: late registration was accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS R2: late registration rejected (%)', SQLERRM;
    END;

    -- R3: a finished contest rejects it even if end_time were in the future
    UPDATE contests SET status = 'finished', end_time = now() + interval '1 day' WHERE contest_id = v_done;
    BEGIN
        INSERT INTO contest_registrations(contest_id, user_id) VALUES (v_done, v_user);
        RAISE EXCEPTION 'FAIL R3: registration for a finished contest was accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS R3: finished contest rejected';
    END;
END $$;

ROLLBACK;
