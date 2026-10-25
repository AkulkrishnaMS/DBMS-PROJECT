-- =====================================================================
-- Competitive Programming Judge Platform : relational schema (PostgreSQL)
-- Maps 1:1 to the ER diagram. Runs automatically on first container boot.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- USERS ----------
CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(30)  NOT NULL UNIQUE
                   CHECK (username ~ '^[A-Za-z0-9_]{3,30}$'),
    email          VARCHAR(255) NOT NULL UNIQUE
                   CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    password_hash  TEXT         NOT NULL,                 -- bcrypt, never plain text
    role           VARCHAR(12)  NOT NULL DEFAULT 'contestant'
                   CHECK (role IN ('admin', 'contestant')),
    global_rating  INT          NOT NULL DEFAULT 1200
                   CHECK (global_rating BETWEEN 0 AND 4000),
    global_rank    INT          CHECK (global_rank >= 1), -- maintained by trigger
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------- PROBLEMS  (AUTHORS: USERS 1 -- N PROBLEMS, total on problem side) ----------
CREATE TABLE problems (
    problem_id       SERIAL PRIMARY KEY,
    author_id        INT          NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    title            VARCHAR(150) NOT NULL UNIQUE,
    statement        TEXT         NOT NULL,
    difficulty       INT          NOT NULL CHECK (difficulty BETWEEN 800 AND 3500),
    time_limit_ms    INT          NOT NULL DEFAULT 2000   CHECK (time_limit_ms BETWEEN 100 AND 10000),
    memory_limit_kb  INT          NOT NULL DEFAULT 262144 CHECK (memory_limit_kb BETWEEN 16384 AND 1048576),
    embedding        vector(384),                          -- semantic embedding of the statement
    search_tsv       tsvector GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', coalesce(title, '')),     'A') ||
                        setweight(to_tsvector('english', coalesce(statement, '')), 'B')
                     ) STORED,                             -- full-text search
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------- CONTESTS  (ORGANIZES: USERS 1 -- M CONTESTS, total on contest side) ----------
CREATE TABLE contests (
    contest_id       SERIAL PRIMARY KEY,
    organizer_id     INT          NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    name             VARCHAR(150) NOT NULL UNIQUE,
    start_time       TIMESTAMPTZ  NOT NULL,
    end_time         TIMESTAMPTZ  NOT NULL,
    status           VARCHAR(10)  NOT NULL DEFAULT 'upcoming'
                     CHECK (status IN ('upcoming', 'running', 'finished')),
    ratings_applied  BOOLEAN      NOT NULL DEFAULT FALSE,
    CHECK (end_time > start_time)
);

-- ---------- CONTAINS  (CONTESTS M -- N PROBLEMS) ----------
CREATE TABLE contest_problems (
    contest_id  INT NOT NULL REFERENCES contests(contest_id) ON DELETE CASCADE,
    problem_id  INT NOT NULL REFERENCES problems(problem_id) ON DELETE RESTRICT,
    points      INT NOT NULL DEFAULT 100 CHECK (points > 0),
    position    INT NOT NULL CHECK (position > 0),
    PRIMARY KEY (contest_id, problem_id),
    UNIQUE (contest_id, position)
);

-- ---------- REGISTERS  (USERS M -- N CONTESTS) ----------
CREATE TABLE contest_registrations (
    contest_id     INT NOT NULL REFERENCES contests(contest_id) ON DELETE CASCADE,
    user_id        INT NOT NULL REFERENCES users(user_id)       ON DELETE CASCADE,
    registered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contest_id, user_id)
);

-- ---------- SUBMISSIONS ----------
-- SUBMITS  : USERS 1 -- N SUBMISSIONS (total)
-- ATTEMPTS : PROBLEMS 1 -- N SUBMISSIONS (total)
-- SCOPED_IN: CONTESTS 1 -- N SUBMISSIONS (partial: NULL contest_id = practice submission)
CREATE TABLE submissions (
    submission_id  BIGSERIAL PRIMARY KEY,
    user_id        INT         NOT NULL REFERENCES users(user_id)       ON DELETE CASCADE,
    problem_id     INT         NOT NULL REFERENCES problems(problem_id) ON DELETE RESTRICT,
    contest_id     INT         REFERENCES contests(contest_id)          ON DELETE SET NULL,
    language       VARCHAR(20) NOT NULL CHECK (language IN ('python', 'cpp', 'c', 'java', 'javascript')),
    code           TEXT        NOT NULL CHECK (length(code) BETWEEN 1 AND 65536),
    verdict        VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                   CHECK (verdict IN ('PENDING', 'RUNNING', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE')),
    runtime_ms     INT         CHECK (runtime_ms >= 0),
    memory_kb      INT         CHECK (memory_kb >= 0),
    submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    -- raw per-testcase logs live in MongoDB: execution_logs.submission_id
);

-- ---------- RATINGS_HISTORY  (HAS_RATING: USERS 1 -- N, AFFECTS: CONTESTS 1 -- N; both total) ----------
CREATE TABLE ratings_history (
    rating_id   SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(user_id)       ON DELETE CASCADE,
    contest_id  INT NOT NULL REFERENCES contests(contest_id) ON DELETE CASCADE,
    old_rating  INT NOT NULL CHECK (old_rating BETWEEN 0 AND 4000),
    new_rating  INT NOT NULL CHECK (new_rating BETWEEN 0 AND 4000),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, contest_id)          -- one rating change per user per contest
);

-- ---------- INDEXES ----------
CREATE INDEX idx_submissions_user          ON submissions (user_id, submitted_at DESC);
CREATE INDEX idx_submissions_contest_user  ON submissions (contest_id, user_id) WHERE contest_id IS NOT NULL;
CREATE INDEX idx_submissions_problem       ON submissions (problem_id, verdict);
CREATE INDEX idx_problems_difficulty       ON problems (difficulty);
CREATE INDEX idx_problems_fts              ON problems USING GIN (search_tsv);
CREATE INDEX idx_problems_embedding        ON problems USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_users_rating              ON users (global_rating DESC);
CREATE INDEX idx_ratings_user              ON ratings_history (user_id, changed_at);

-- ---------- VIEW: live contest standings ----------
-- first AC per (contest, user, problem) -> points + time penalty -> RANK()
CREATE VIEW contest_standings AS
WITH first_ac AS (
    SELECT DISTINCT ON (s.contest_id, s.user_id, s.problem_id)
           s.contest_id, s.user_id, s.problem_id, s.submitted_at
    FROM submissions s
    WHERE s.verdict = 'AC' AND s.contest_id IS NOT NULL
    ORDER BY s.contest_id, s.user_id, s.problem_id, s.submitted_at
)
SELECT f.contest_id,
       f.user_id,
       u.username,
       COUNT(*)                                                             AS solved,
       SUM(cp.points)                                                       AS score,
       ROUND(SUM(EXTRACT(EPOCH FROM (f.submitted_at - c.start_time)) / 60)) AS penalty_min,
       RANK() OVER (PARTITION BY f.contest_id
                    ORDER BY SUM(cp.points) DESC,
                             SUM(EXTRACT(EPOCH FROM (f.submitted_at - c.start_time))) ASC) AS standing
FROM first_ac f
JOIN contest_problems cp ON cp.contest_id = f.contest_id AND cp.problem_id = f.problem_id
JOIN contests c          ON c.contest_id  = f.contest_id
JOIN users u             ON u.user_id     = f.user_id
GROUP BY f.contest_id, f.user_id, u.username;
