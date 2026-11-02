-- Tests for the rating rules in 04_fair_rating.sql. Everything is rolled back at the end.
-- Run: docker exec -i judge_postgres psql -U "$PG_USER" -d "$PG_DB" < db/tests/rating_test.sql
--
-- Contest "RT Round" (formula: delta = ROUND(60 * ((n+1)/2 - place) / n), n = participants = 5)
--   rt_p1  AC at +10 min               -> place 1            -> +24
--   rt_p2  AC at +20 min (same second) -> places 2,3 -> 2.5  -> +6
--   rt_p3  AC at +20 min (same second) -> places 2,3 -> 2.5  -> +6
--   rt_p4  WA only                     -> places 4,5 -> 4.5  -> -18
--   rt_p5  WA only                     -> places 4,5 -> 4.5  -> -18
--   rt_p6  registered, never submitted -> not rated, no history row, rating stays 1200
--   total change = 24 + 6 + 6 - 18 - 18 = 0
--
-- Contest "RT Seconds": rt_p1 AC at +10:05, rt_p2 AC at +10:40 (same minute)
--   -> ranked 1 and 2 by exact seconds, like the standings page -> +15 and -15
BEGIN;

INSERT INTO users(username, email, password_hash, role) VALUES
  ('rt_admin', 'rt_admin@x.com', 'h', 'admin'),
  ('rt_p1', 'rt_p1@x.com', 'h', 'contestant'), ('rt_p2', 'rt_p2@x.com', 'h', 'contestant'),
  ('rt_p3', 'rt_p3@x.com', 'h', 'contestant'), ('rt_p4', 'rt_p4@x.com', 'h', 'contestant'),
  ('rt_p5', 'rt_p5@x.com', 'h', 'contestant'), ('rt_p6', 'rt_p6@x.com', 'h', 'contestant');

INSERT INTO problems(author_id, title, statement, difficulty)
SELECT user_id, 'RT Problem', 'rating test', 800 FROM users WHERE username = 'rt_admin';

-- contests are open while players register; they end later ("time passes")
INSERT INTO contests(organizer_id, name, start_time, end_time)
SELECT user_id, n, now() - interval '3 hours', now() + interval '1 hour'
FROM users, (VALUES ('RT Round'), ('RT Seconds')) AS v(n) WHERE username = 'rt_admin';

INSERT INTO contest_problems(contest_id, problem_id, points, position)
SELECT c.contest_id, p.problem_id, 100, 1 FROM contests c, problems p
WHERE c.name IN ('RT Round', 'RT Seconds') AND p.title = 'RT Problem';

INSERT INTO contest_registrations(contest_id, user_id)
SELECT c.contest_id, u.user_id FROM contests c, users u
WHERE (c.name = 'RT Round'   AND u.username IN ('rt_p1','rt_p2','rt_p3','rt_p4','rt_p5','rt_p6'))
   OR (c.name = 'RT Seconds' AND u.username IN ('rt_p1','rt_p2'));

INSERT INTO submissions(user_id, problem_id, contest_id, language, code, verdict, submitted_at)
SELECT u.user_id, p.problem_id, c.contest_id, 'python', 'x', x.verdict, c.start_time + x.off
FROM (VALUES ('RT Round',   'rt_p1', 'AC', interval '10 minutes'),
             ('RT Round',   'rt_p2', 'AC', interval '20 minutes'),
             ('RT Round',   'rt_p3', 'AC', interval '20 minutes'),
             ('RT Round',   'rt_p4', 'WA', interval '30 minutes'),
             ('RT Round',   'rt_p5', 'WA', interval '40 minutes'),
             ('RT Seconds', 'rt_p1', 'AC', interval '10 minutes 5 seconds'),
             ('RT Seconds', 'rt_p2', 'AC', interval '10 minutes 40 seconds')) AS x(cname, uname, verdict, off)
JOIN users u ON u.username = x.uname
JOIN contests c ON c.name = x.cname
CROSS JOIN problems p WHERE p.title = 'RT Problem';

UPDATE contests SET end_time = now() - interval '1 minute' WHERE name IN ('RT Round', 'RT Seconds');

DO $$
DECLARE
    v_round INT := (SELECT contest_id FROM contests WHERE name = 'RT Round');
    v_secs  INT := (SELECT contest_id FROM contests WHERE name = 'RT Seconds');
    v_rated INT;
    v_got   TEXT;
    v_sum   INT;
BEGIN
    -- G1: only participants are rated, and the deltas match the expected places
    v_rated := finalize_contest(v_round);
    IF v_rated <> 5 THEN RAISE EXCEPTION 'FAIL G1: % users rated, expected 5', v_rated; END IF;

    SELECT string_agg(u.username || ' ' || (rh.new_rating - rh.old_rating), ', ' ORDER BY u.username)
      INTO v_got
    FROM ratings_history rh JOIN users u ON u.user_id = rh.user_id
    WHERE rh.contest_id = v_round;
    IF v_got <> 'rt_p1 24, rt_p2 6, rt_p3 6, rt_p4 -18, rt_p5 -18' THEN
        RAISE EXCEPTION 'FAIL G1: got %', v_got; END IF;
    RAISE NOTICE 'PASS G1: places shared fairly (%)', v_got;

    -- G2: the changes add up to zero
    SELECT SUM(new_rating - old_rating) INTO v_sum FROM ratings_history WHERE contest_id = v_round;
    IF v_sum <> 0 THEN RAISE EXCEPTION 'FAIL G2: total change %', v_sum; END IF;
    RAISE NOTICE 'PASS G2: total rating change is 0';

    -- G3: the no-show keeps their rating and gets no history row
    IF EXISTS (SELECT 1 FROM ratings_history rh JOIN users u ON u.user_id = rh.user_id
               WHERE u.username = 'rt_p6')
       OR (SELECT global_rating FROM users WHERE username = 'rt_p6') <> 1200 THEN
        RAISE EXCEPTION 'FAIL G3: no-show was rated'; END IF;
    RAISE NOTICE 'PASS G3: registered but never submitted -> not rated, still 1200';

    -- G4: same minute, different seconds -> not a tie (agrees with the standings page)
    PERFORM finalize_contest(v_secs);
    SELECT string_agg(u.username || ' ' || (rh.new_rating - rh.old_rating), ', ' ORDER BY u.username)
      INTO v_got
    FROM ratings_history rh JOIN users u ON u.user_id = rh.user_id
    WHERE rh.contest_id = v_secs;
    IF v_got <> 'rt_p1 15, rt_p2 -15' THEN RAISE EXCEPTION 'FAIL G4: got %', v_got; END IF;
    RAISE NOTICE 'PASS G4: 20 seconds apart is not a tie (%)', v_got;
END $$;

ROLLBACK;
