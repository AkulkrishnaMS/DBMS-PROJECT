-- ============================================================
-- 04_fair_rating.sql
-- Replaces finalize_contest() from 02_functions_triggers.sql with fairer rating rules.
--
-- Old behaviour (two problems):
--   1. Every registered user was rated, so a no-show who never submitted lost rating.
--      Tied players got RANK(), i.e. the BEST shared place, so players who solved
--      nothing could GAIN rating and the total rating in the system kept growing.
--   2. Ties were broken by penalty in whole MINUTES, while the standings view uses
--      SECONDS, so two players 20 seconds apart could be ranked 1 and 2 on the page
--      but tied for ratings.
--
-- New rules:
--   * Only PARTICIPANTS are rated: registered users with at least one submission
--     in the contest. A no-show keeps their rating (no ratings_history row).
--   * Solvers are ordered by the view's own `standing` (exact seconds), so ratings
--     always agree with the standings page.
--   * Participants with no accepted answer share the last places.
--   * Tied players get the AVERAGE of the places they share
--     (e.g. tied for places 2, 3, 4 -> each counts as 3).
--     Average place = first shared place + (number tied - 1) / 2.
--     With average places the deltas add up to 0 (before rounding).
--
-- Everything else is unchanged: the FOR UPDATE row lock, the ratings_applied flag,
-- the "has not ended yet" check, and the trigger chain that updates global ranks.
-- ============================================================

CREATE OR REPLACE FUNCTION finalize_contest(p_contest_id INT) RETURNS INT AS $$
DECLARE
    v_status  TEXT;
    v_applied BOOLEAN;
    v_end     TIMESTAMPTZ;
    v_n       INT;
    v_rows    INT := 0;
BEGIN
    SELECT status, ratings_applied, end_time INTO v_status, v_applied, v_end
    FROM contests WHERE contest_id = p_contest_id FOR UPDATE;      -- row lock: no double finalize

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contest % not found', p_contest_id;
    END IF;
    IF v_applied THEN
        RAISE EXCEPTION 'Contest % already finalized', p_contest_id;
    END IF;
    IF now() < v_end THEN
        RAISE EXCEPTION 'Contest % has not ended yet', p_contest_id;
    END IF;

    -- n = participants (registered AND submitted at least once in this contest)
    SELECT COUNT(*) INTO v_n
    FROM contest_registrations cr
    WHERE cr.contest_id = p_contest_id
      AND EXISTS (SELECT 1 FROM submissions s
                  WHERE s.contest_id = cr.contest_id AND s.user_id = cr.user_id);

    IF v_n > 0 THEN
        INSERT INTO ratings_history (user_id, contest_id, old_rating, new_rating)
        SELECT r.user_id, p_contest_id, u.global_rating,
               GREATEST(0, LEAST(4000,
                   u.global_rating + ROUND(60.0 * ((v_n + 1) / 2.0 - r.avg_place) / v_n)::INT))
        FROM (
            SELECT p.user_id,
                   -- first shared place + (players in the tie - 1) / 2
                   RANK() OVER (ORDER BY p.standing NULLS LAST)
                     + (COUNT(*) OVER (PARTITION BY p.standing) - 1) / 2.0 AS avg_place
            FROM (
                SELECT cr.user_id, cs.standing        -- standing is NULL for non-solvers
                FROM contest_registrations cr
                LEFT JOIN contest_standings cs
                       ON cs.contest_id = cr.contest_id AND cs.user_id = cr.user_id
                WHERE cr.contest_id = p_contest_id
                  AND EXISTS (SELECT 1 FROM submissions s
                              WHERE s.contest_id = cr.contest_id AND s.user_id = cr.user_id)
            ) p
        ) r
        JOIN users u ON u.user_id = r.user_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
    END IF;

    UPDATE contests SET status = 'finished', ratings_applied = TRUE
    WHERE contest_id = p_contest_id;                 -- fires trg_contest_finished

    IF v_status = 'finished' THEN                    -- trigger won't fire if already finished
        PERFORM fn_refresh_global_ranks();
    END IF;
    RETURN v_rows;
END $$ LANGUAGE plpgsql;
