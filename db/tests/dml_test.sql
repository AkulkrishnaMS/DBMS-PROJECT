-- Tests for the database rules behind the UPDATE and DELETE features. Everything is rolled back.
-- Run: docker exec -i judge_postgres psql -U "$PG_USER" -d "$PG_DB" < db/tests/dml_test.sql
BEGIN;

INSERT INTO users(username, email, password_hash, role) VALUES
  ('dml_admin', 'dml_admin@x.com', 'h', 'admin'), ('dml_user', 'dml_user@x.com', 'h', 'contestant');
INSERT INTO problems(author_id, title, statement, difficulty)
SELECT user_id, t, 'dml test statement', 800
FROM users, (VALUES ('DML Unused'), ('DML Submitted'), ('DML In Contest')) AS v(t) WHERE username = 'dml_admin';
INSERT INTO contests(organizer_id, name, start_time, end_time)
SELECT user_id, 'DML Round', now() + interval '1 day', now() + interval '2 days'
FROM users WHERE username = 'dml_admin';
INSERT INTO contest_problems(contest_id, problem_id, points, position)
SELECT c.contest_id, p.problem_id, 100, 1 FROM contests c, problems p
WHERE c.name = 'DML Round' AND p.title = 'DML In Contest';
INSERT INTO submissions(user_id, problem_id, language, code, verdict)
SELECT u.user_id, p.problem_id, 'python', 'x', 'WA' FROM users u, problems p
WHERE u.username = 'dml_user' AND p.title = 'DML Submitted';            -- practice submission

DO $$
BEGIN
    -- U1: UPDATE works, and the generated full-text column follows the new title
    UPDATE problems SET title = 'DML Renamed Zebra' WHERE title = 'DML Unused';
    IF NOT EXISTS (SELECT 1 FROM problems
                   WHERE title = 'DML Renamed Zebra' AND search_tsv @@ to_tsquery('english', 'zebra')) THEN
        RAISE EXCEPTION 'FAIL U1'; END IF;
    RAISE NOTICE 'PASS U1: update changed the title and search_tsv followed it';

    -- U2: the CHECK constraint still guards updates
    BEGIN
        UPDATE problems SET difficulty = 5000 WHERE title = 'DML Renamed Zebra';
        RAISE EXCEPTION 'FAIL U2: difficulty 5000 accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'PASS U2: difficulty 5000 rejected by CHECK';
    END;

    -- D1: a problem with a submission cannot be deleted (ON DELETE RESTRICT)
    BEGIN
        DELETE FROM problems WHERE title = 'DML Submitted';
        RAISE EXCEPTION 'FAIL D1: deleted a problem that has submissions';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'PASS D1: problem with submissions kept (RESTRICT)';
    END;

    -- D2: a problem in a contest cannot be deleted (ON DELETE RESTRICT)
    BEGIN
        DELETE FROM problems WHERE title = 'DML In Contest';
        RAISE EXCEPTION 'FAIL D2: deleted a problem that is in a contest';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'PASS D2: problem in a contest kept (RESTRICT)';
    END;

    -- D3: an unused problem can be deleted
    DELETE FROM problems WHERE title = 'DML Renamed Zebra';
    IF FOUND THEN RAISE NOTICE 'PASS D3: unused problem deleted';
    ELSE RAISE EXCEPTION 'FAIL D3'; END IF;

    -- D4: deleting a contest CASCADES to its problem list, but the problem itself stays
    DELETE FROM contests WHERE name = 'DML Round';
    IF EXISTS (SELECT 1 FROM contest_problems cp JOIN problems p ON p.problem_id = cp.problem_id
               WHERE p.title = 'DML In Contest')
       OR NOT EXISTS (SELECT 1 FROM problems WHERE title = 'DML In Contest') THEN
        RAISE EXCEPTION 'FAIL D4'; END IF;
    RAISE NOTICE 'PASS D4: contest delete cascaded to contest_problems, problem kept';
END $$;

ROLLBACK;
