-- =====================================================================
-- Triggers, stored functions, transaction-safe contest finalisation
-- =====================================================================

-- ---- T1: only admins may author problems / organize contests ----
CREATE OR REPLACE FUNCTION fn_require_admin() RETURNS trigger AS $$
DECLARE
    v_uid  INT;
    v_role TEXT;
BEGIN
    IF TG_TABLE_NAME = 'problems' THEN v_uid := NEW.author_id;
    ELSE                               v_uid := NEW.organizer_id;
    END IF;
    SELECT role INTO v_role FROM users WHERE user_id = v_uid;
    IF v_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'User % is not an admin', v_uid USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_problems_author_admin
    BEFORE INSERT OR UPDATE OF author_id ON problems
    FOR EACH ROW EXECUTE FUNCTION fn_require_admin();

CREATE TRIGGER trg_contests_organizer_admin
    BEFORE INSERT OR UPDATE OF organizer_id ON contests
    FOR EACH ROW EXECUTE FUNCTION fn_require_admin();

-- ---- T2: contest submissions must be registered, in-window, and for a problem in the contest ----
CREATE OR REPLACE FUNCTION fn_validate_submission() RETURNS trigger AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end   TIMESTAMPTZ;
BEGIN
    IF NEW.contest_id IS NULL THEN
        RETURN NEW;                                   -- practice submission
    END IF;

    SELECT start_time, end_time INTO v_start, v_end
    FROM contests WHERE contest_id = NEW.contest_id;

    IF NEW.submitted_at < v_start OR NEW.submitted_at > v_end THEN
        RAISE EXCEPTION 'Submission outside contest window' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM contest_registrations
                   WHERE contest_id = NEW.contest_id AND user_id = NEW.user_id) THEN
        RAISE EXCEPTION 'User % is not registered for contest %', NEW.user_id, NEW.contest_id
              USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM contest_problems
                   WHERE contest_id = NEW.contest_id AND problem_id = NEW.problem_id) THEN
        RAISE EXCEPTION 'Problem % is not part of contest %', NEW.problem_id, NEW.contest_id
              USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_submissions_validate
    BEFORE INSERT ON submissions
    FOR EACH ROW EXECUTE FUNCTION fn_validate_submission();

-- ---- T3: a ratings_history row pushes the new rating onto the user ----
CREATE OR REPLACE FUNCTION fn_apply_rating() RETURNS trigger AS $$
BEGIN
    UPDATE users SET global_rating = NEW.new_rating WHERE user_id = NEW.user_id;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ratings_apply
    AFTER INSERT ON ratings_history
    FOR EACH ROW EXECUTE FUNCTION fn_apply_rating();

-- ---- T4: contest finished -> recompute global_rank for everyone ----
CREATE OR REPLACE FUNCTION fn_refresh_global_ranks() RETURNS void AS $$
    UPDATE users u
    SET    global_rank = r.rk
    FROM  (SELECT user_id, RANK() OVER (ORDER BY global_rating DESC) AS rk
           FROM users WHERE role = 'contestant') r
    WHERE  u.user_id = r.user_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION fn_on_contest_finished() RETURNS trigger AS $$
BEGIN
    PERFORM fn_refresh_global_ranks();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contest_finished
    AFTER UPDATE OF status ON contests
    FOR EACH ROW
    WHEN (OLD.status <> 'finished' AND NEW.status = 'finished')
    EXECUTE FUNCTION fn_on_contest_finished();

-- ---- Stored function: finalize a contest atomically ----
-- Everything below runs in ONE transaction (a function call is atomic):
-- if anything fails (crash, constraint), no rating or status change is persisted.
-- Rating rule (simplified Elo-like): delta = round(60 * ((n+1)/2 - rank) / n)
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

    SELECT COUNT(*) INTO v_n FROM contest_registrations WHERE contest_id = p_contest_id;

    IF v_n > 0 THEN
        INSERT INTO ratings_history (user_id, contest_id, old_rating, new_rating)
        SELECT r.user_id, p_contest_id, u.global_rating,
               GREATEST(0, LEAST(4000,
                   u.global_rating + ROUND(60.0 * ((v_n + 1) / 2.0 - r.rk) / v_n)::INT))
        FROM (SELECT cr.user_id,
                     RANK() OVER (ORDER BY COALESCE(cs.score, 0) DESC,
                                           COALESCE(cs.penalty_min, 0) ASC) AS rk
              FROM contest_registrations cr
              LEFT JOIN contest_standings cs
                     ON cs.contest_id = cr.contest_id AND cs.user_id = cr.user_id
              WHERE cr.contest_id = p_contest_id) r
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

-- ---- Vector similarity: "Find Similar Problems" (cosine distance, pgvector) ----
CREATE OR REPLACE FUNCTION find_similar_problems(p_problem_id INT, p_k INT DEFAULT 5)
RETURNS TABLE (problem_id INT, title VARCHAR, difficulty INT, similarity DOUBLE PRECISION) AS $$
    SELECT p.problem_id, p.title, p.difficulty, 1 - (p.embedding <=> q.embedding)
    FROM problems p,
         (SELECT embedding FROM problems WHERE problem_id = p_problem_id) q
    WHERE p.problem_id <> p_problem_id
      AND p.embedding IS NOT NULL
      AND q.embedding IS NOT NULL
    ORDER BY p.embedding <=> q.embedding
    LIMIT p_k;
$$ LANGUAGE sql STABLE;
