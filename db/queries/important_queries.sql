-- =====================================================================
-- Important queries (CP Judge).  Run:
--   docker exec -i judge_postgres psql -U "$PG_USER" -d "$PG_DB" < db/queries/important_queries.sql
-- Uses names ('alice', 'Round 1', 'Double It') instead of ids, so it works on any copy of the data.
-- Sections 15-17 change data inside a transaction and ROLLBACK: nothing is saved.
-- =====================================================================

\echo '=== 1. SELECT + WHERE + ORDER BY: non-accepted submissions'
SELECT submission_id, user_id, language, verdict, runtime_ms
FROM submissions
WHERE verdict <> 'AC'
ORDER BY submission_id;

\echo '=== 2. JOIN (3 tables): who submitted what'
SELECT s.submission_id, u.username, p.title, s.verdict
FROM submissions s
JOIN users u    ON u.user_id    = s.user_id
JOIN problems p ON p.problem_id = s.problem_id
ORDER BY s.submission_id;

\echo '=== 3. LEFT JOIN + COALESCE: every registered player of Round 1, even without an accepted solution'
SELECT u.username, COALESCE(cs.score, 0) AS score, COALESCE(cs.solved, 0) AS solved
FROM contests c
JOIN contest_registrations cr ON cr.contest_id = c.contest_id
JOIN users u                  ON u.user_id     = cr.user_id
LEFT JOIN contest_standings cs ON cs.contest_id = c.contest_id AND cs.user_id = u.user_id
WHERE c.name = 'Round 1'
ORDER BY score DESC, u.username;

\echo '=== 4. GROUP BY + aggregates: submissions and accepted count per user'
SELECT u.username,
       COUNT(*)                                  AS total,
       COUNT(*) FILTER (WHERE s.verdict = 'AC')  AS accepted
FROM submissions s
JOIN users u ON u.user_id = s.user_id
GROUP BY u.username
ORDER BY total DESC;

\echo '=== 5. HAVING: users with at least 2 submissions (HAVING filters groups, WHERE filters rows)'
SELECT u.username, COUNT(*) AS total
FROM submissions s
JOIN users u ON u.user_id = s.user_id
GROUP BY u.username
HAVING COUNT(*) >= 2;

\echo '=== 6. Aggregates per problem: acceptance rate and slowest run'
SELECT p.title,
       COUNT(*) AS submissions,
       ROUND(100.0 * COUNT(*) FILTER (WHERE s.verdict = 'AC') / COUNT(*), 1) AS acceptance_pct,
       MAX(s.runtime_ms) AS slowest_ms
FROM problems p
JOIN submissions s ON s.problem_id = p.problem_id
GROUP BY p.problem_id, p.title
ORDER BY acceptance_pct DESC;

\echo '=== 7. Subquery (IN): users with at least one accepted submission'
SELECT username
FROM users
WHERE user_id IN (SELECT user_id FROM submissions WHERE verdict = 'AC');

\echo '=== 8. Correlated subquery (NOT EXISTS): contestants who never got an AC'
SELECT u.username
FROM users u
WHERE u.role = 'contestant'
  AND NOT EXISTS (SELECT 1 FROM submissions s
                  WHERE s.user_id = u.user_id AND s.verdict = 'AC');

\echo '=== 9. CTE (WITH): rating change per player per contest'
WITH changes AS (
    SELECT rh.user_id, c.name AS contest, rh.new_rating - rh.old_rating AS delta
    FROM ratings_history rh
    JOIN contests c ON c.contest_id = rh.contest_id
)
SELECT u.username, ch.contest, ch.delta
FROM changes ch
JOIN users u ON u.user_id = ch.user_id
ORDER BY ch.delta DESC;

\echo '=== 10. Window function: leaderboard with the gap to the leader'
SELECT username, global_rating,
       RANK() OVER (ORDER BY global_rating DESC)        AS rnk,
       MAX(global_rating) OVER () - global_rating       AS behind_leader
FROM users
WHERE role = 'contestant';

\echo '=== 11. Window function with PARTITION BY: running submission count per user'
SELECT u.username, s.submission_id, s.verdict,
       COUNT(*) OVER (PARTITION BY s.user_id ORDER BY s.submission_id) AS nth_submission
FROM submissions s
JOIN users u ON u.user_id = s.user_id
ORDER BY u.username, s.submission_id;

\echo '=== 12. The contest_standings VIEW (saved query with DISTINCT ON, GROUP BY and RANK)'
SELECT standing, username, solved, score, penalty_min
FROM contest_standings
WHERE contest_id = (SELECT contest_id FROM contests WHERE name = 'Round 1')
ORDER BY standing;

\echo '=== 13. Full-text search with ranking (title weight A, statement weight B)'
SELECT title, ROUND(ts_rank(search_tsv, q)::numeric, 3) AS relevance
FROM problems, websearch_to_tsquery('english', 'double') AS q
WHERE search_tsv @@ q
ORDER BY relevance DESC;

\echo '=== 14. EXPLAIN: is the index used?  (tiny tables make Postgres prefer a sequential scan,'
\echo '===     so we switch seqscan off for this session to show the index plan)'
SET enable_seqscan = off;
EXPLAIN
SELECT submission_id, verdict
FROM submissions
WHERE user_id = (SELECT user_id FROM users WHERE username = 'admin')
ORDER BY submitted_at DESC;
RESET enable_seqscan;

\echo '=== 15. UPDATE and DELETE inside a transaction that is rolled back'
BEGIN;
UPDATE problems SET difficulty = 1200 WHERE title = 'Double It';
SELECT title, difficulty FROM problems WHERE title = 'Double It';
DELETE FROM submissions WHERE verdict IN ('TLE', 'MLE') AND contest_id IS NULL;
SELECT COUNT(*) AS submissions_inside_transaction FROM submissions;
ROLLBACK;
SELECT title, difficulty FROM problems WHERE title = 'Double It';
SELECT COUNT(*) AS submissions_after_rollback FROM submissions;

\echo '=== 16. ON DELETE RESTRICT: deleting a user who authored problems is refused (expect an ERROR)'
BEGIN;
DELETE FROM users WHERE username = 'admin';
ROLLBACK;

\echo '=== 17. ON DELETE CASCADE: deleting a user removes their submissions, registrations and ratings'
BEGIN;
SELECT (SELECT COUNT(*) FROM submissions)          AS submissions,
       (SELECT COUNT(*) FROM contest_registrations) AS registrations,
       (SELECT COUNT(*) FROM ratings_history)       AS ratings;
DELETE FROM users WHERE username = 'alice';
SELECT (SELECT COUNT(*) FROM submissions)          AS submissions,
       (SELECT COUNT(*) FROM contest_registrations) AS registrations,
       (SELECT COUNT(*) FROM ratings_history)       AS ratings;
ROLLBACK;
