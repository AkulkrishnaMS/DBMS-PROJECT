-- Self-cleaning smoke test:  psql -d judgedb -f db/tests/smoke_test.sql
BEGIN;

INSERT INTO users(username, email, password_hash, role) VALUES
  ('admin1','a@x.com','h','admin'), ('alice','al@x.com','h','contestant'),
  ('bob','bo@x.com','h','contestant'), ('carol','ca@x.com','h','contestant');

INSERT INTO problems(author_id, title, statement, difficulty)
  SELECT user_id, 'Two Sum', 'Find two numbers that add up to the target value', 800
  FROM users WHERE username = 'admin1';

INSERT INTO contests(organizer_id, name, start_time, end_time, status)
  SELECT user_id, 'Test Round', now() - interval '3 hours', now() - interval '1 hour', 'running'
  FROM users WHERE username = 'admin1';

INSERT INTO contest_problems(contest_id, problem_id, points, position)
  SELECT c.contest_id, p.problem_id, 100, 1 FROM contests c, problems p
  WHERE c.name = 'Test Round' AND p.title = 'Two Sum';

INSERT INTO contest_registrations(contest_id, user_id)
  SELECT c.contest_id, u.user_id FROM contests c, users u
  WHERE c.name = 'Test Round' AND u.role = 'contestant';

INSERT INTO users(username, email, password_hash) VALUES ('dave','d@x.com','h');  -- not registered

DO $$
DECLARE
    v_c INT; v_p INT; v_rows INT; v_alice INT; v_bob INT; v_carol INT; v_dave INT;
BEGIN
    SELECT contest_id INTO v_c FROM contests WHERE name = 'Test Round';
    SELECT problem_id INTO v_p FROM problems WHERE title = 'Two Sum';

    -- T1: non-admin cannot author a problem
    BEGIN
        INSERT INTO problems(author_id, title, statement, difficulty)
        SELECT user_id, 'Bad', 'x', 800 FROM users WHERE username = 'alice';
        RAISE EXCEPTION 'FAIL T1';
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS T1: non-admin author rejected'; END;

    -- T2a: unregistered user cannot submit in contest
    BEGIN
        INSERT INTO submissions(user_id, problem_id, contest_id, language, code, submitted_at)
        SELECT user_id, v_p, v_c, 'python', 'x', now() - interval '2 hours' FROM users WHERE username = 'dave';
        RAISE EXCEPTION 'FAIL T2a';
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS T2a: unregistered user rejected'; END;

    -- T2b: submission after contest end rejected
    BEGIN
        INSERT INTO submissions(user_id, problem_id, contest_id, language, code, submitted_at)
        SELECT user_id, v_p, v_c, 'python', 'x', now() FROM users WHERE username = 'alice';
        RAISE EXCEPTION 'FAIL T2b';
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS T2b: late submission rejected'; END;

    -- valid submissions: alice AC @+10m, bob AC @+30m, carol WA
    INSERT INTO submissions(user_id, problem_id, contest_id, language, code, verdict, submitted_at)
    SELECT u.user_id, v_p, v_c, 'python', 'print(1)', x.verdict,
           (SELECT start_time FROM contests WHERE contest_id = v_c) + x.off
    FROM (VALUES ('alice','AC', interval '10 minutes'),
                 ('bob',  'AC', interval '30 minutes'),
                 ('carol','WA', interval '20 minutes')) AS x(name, verdict, off)
    JOIN users u ON u.username = x.name;

    -- finalize (transaction-safe function) -> ratings + trigger-driven ranks
    v_rows := finalize_contest(v_c);
    IF v_rows <> 3 THEN RAISE EXCEPTION 'FAIL finalize rows=%', v_rows; END IF;

    SELECT global_rating INTO v_alice FROM users WHERE username = 'alice';
    SELECT global_rating INTO v_bob   FROM users WHERE username = 'bob';
    SELECT global_rating INTO v_carol FROM users WHERE username = 'carol';
    IF (v_alice, v_bob, v_carol) <> (1220, 1200, 1180) THEN
        RAISE EXCEPTION 'FAIL ratings % % %', v_alice, v_bob, v_carol; END IF;
    RAISE NOTICE 'PASS ratings: alice 1220, bob 1200, carol 1180';

    SELECT global_rank INTO v_alice FROM users WHERE username = 'alice';
    SELECT global_rank INTO v_dave  FROM users WHERE username = 'dave';
    IF v_alice <> 1 THEN RAISE EXCEPTION 'FAIL rank alice=%', v_alice; END IF;
    RAISE NOTICE 'PASS T4: trigger refreshed global_rank (alice = 1)';

    -- double finalize rejected
    BEGIN
        PERFORM finalize_contest(v_c);
        RAISE EXCEPTION 'FAIL double finalize';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
        RAISE NOTICE 'PASS: double finalize rejected'; END;

    -- vector similarity
    INSERT INTO problems(author_id, title, statement, difficulty, embedding)
    SELECT user_id, t, 's', 900, array_fill(0.1::real, ARRAY[384])::vector
    FROM users, (VALUES ('Sim A'), ('Sim B')) AS v(t) WHERE username = 'admin1';
    IF (SELECT COUNT(*) FROM find_similar_problems(
            (SELECT problem_id FROM problems WHERE title = 'Sim A'), 5)) <> 1 THEN
        RAISE EXCEPTION 'FAIL similarity'; END IF;
    RAISE NOTICE 'PASS: find_similar_problems works';
END $$;

ROLLBACK;   -- leaves the DB untouched
