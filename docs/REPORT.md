# CP Judge: Project Documentation

DBMS Experiential Learning, Level 3 Project

**Team:** Akulkrishna M S, Harsh M
**Project title:** _(to fill in)_

---

## 1. Problem statement

_(to write)_

## 2. Objectives

_(to write)_

## 3. Scope

_(to write)_

## 4. Functional requirements

_(to write)_

## 5. ER diagram

![ER diagram](er_diagram.png)

The ER diagram uses Chen notation: rectangles are entities, diamonds are relationships, ellipses are attributes (underlined = primary key, dashed = derived), and a double line means total participation. There are five entities: USERS, PROBLEMS, CONTESTS, SUBMISSIONS and RATINGS_HISTORY. Two relationships are M:N (REGISTERS between users and contests, CONTAINS between contests and problems); the others are 1:N. SCOPED_IN is partial because practice submissions do not belong to a contest. global_rank is derived from ratings by a trigger, and search_tsv is generated from the title and statement.

## 6. Relational schema

![Relational schema](schema_diagram.png)

The ER diagram was converted to tables with these rules: each entity became a table with its own primary key; each 1:N relationship became a foreign key on the N side (for example problems.author_id); each M:N relationship became a junction table with a composite primary key (contest_registrations, contest_problems), and relationship attributes became its columns (registered_at, points, position). Total participation became NOT NULL, and partial participation allows NULL (submissions.contest_id, where NULL means a practice submission). Delete rules follow the meaning of the data: RESTRICT protects problems and authors that are still referenced, CASCADE removes rows that mean nothing without their parent, and SET NULL keeps a deleted contest’s submissions as practice submissions. UNIQUE constraints enforce real rules, for example one rating change per user per contest.
## 7. Database choice and justification

**PostgreSQL (structured data).** Users, problems, contests, submissions and ratings have a fixed format and are closely connected; for example, a submission belongs to a user, a problem and possibly a contest. This data must stay correct, so we use PostgreSQL: foreign keys keep the links valid, CHECK constraints and triggers reject bad data (for example, registering after a contest has ended), transactions make finalizing a contest all-or-nothing, and JOINs produce results like the contest standings.

**MongoDB (semi-structured data).** Test cases and judge logs have a known shape, but their number and size vary a lot from problem to problem. They never need JOINs, and the judge always reads all test cases of one problem at once. MongoDB stores them as one document per problem, fetched in a single read by `problem_id`. Validators still enforce the shape of each document.

**pgvector (meaning-based search).** To find similar problems, each problem statement is turned into an embedding of 384 numbers, so statements with similar meaning have nearby vectors. We use pgvector inside PostgreSQL, so the vector is stored in the same row as the problem and similarity search can be combined with normal SQL filters, with no extra service.

**How they connect.** PostgreSQL is the source of truth. MongoDB documents refer to it by ID (`test_cases.problem_id`, `execution_logs.submission_id`).

"Why not one database for everything?”
Users and submissions are connected data. In PostgreSQL each fact is stored once and linked by foreign keys (normalization), and the database enforces rules across tables with constraints and triggers. In MongoDB we’d have to copy data into documents (update anomalies) and couldn’t enforce links between collections.

## 8. Data dictionary / schema description

## 8. Data dictionary / schema description

Key: **PK** primary key, **FK** foreign key, **UQ** unique, **NN** NOT NULL. Every column marked NN cannot be empty.
All rules below are enforced by the database itself (constraints and triggers), not only by the application.

### 8.1 PostgreSQL tables

#### `users`: everyone who uses the platform

| Column | Type | Constraints | Description |
|---|---|---|---|
| user_id | SERIAL | PK | Auto-generated user number |
| username | VARCHAR(30) | NN, UQ, CHECK 3–30 letters, digits or `_` | Login name, shown on standings |
| email | VARCHAR(255) | NN, UQ, CHECK email format | Contact email, one account per email |
| password_hash | TEXT | NN | bcrypt hash; the plain password is never stored |
| role | VARCHAR(12) | NN, DEFAULT `'contestant'`, CHECK `admin` or `contestant` | Decides what the user may do |
| global_rating | INT | NN, DEFAULT 1200, CHECK 0–4000 | Current rating, changed only by `finalize_contest()` |
| global_rank | INT | CHECK ≥ 1 | Position on the leaderboard; **derived**, kept up to date by a trigger |
| created_at | TIMESTAMPTZ | NN, DEFAULT now() | When the account was created |

#### `problems`: programming problems

| Column | Type | Constraints | Description |
|---|---|---|---|
| problem_id | SERIAL | PK | Auto-generated problem number |
| author_id | INT | NN, FK → users, ON DELETE RESTRICT | Admin who wrote it (trigger checks the author is an admin) |
| title | VARCHAR(150) | NN, UQ | Problem name |
| statement | TEXT | NN | Full problem text |
| difficulty | INT | NN, CHECK 800–3500 | Difficulty rating |
| time_limit_ms | INT | NN, DEFAULT 2000, CHECK 100–10000 | Maximum run time per test case |
| memory_limit_kb | INT | NN, DEFAULT 262144, CHECK 16384–1048576 | Maximum memory |
| embedding | vector(384) | NULL until computed | Meaning of title + statement, used for similar problems |
| search_tsv | tsvector | GENERATED ALWAYS (STORED) | Words of the title (weight A) and statement (weight B) for full-text search |
| created_at | TIMESTAMPTZ | NN, DEFAULT now() | When it was added |

#### `contests`: timed contests

| Column | Type | Constraints | Description |
|---|---|---|---|
| contest_id | SERIAL | PK | Auto-generated contest number |
| organizer_id | INT | NN, FK → users, ON DELETE RESTRICT | Admin who created it |
| name | VARCHAR(150) | NN, UQ | Contest name |
| start_time | TIMESTAMPTZ | NN | Start (stored in UTC) |
| end_time | TIMESTAMPTZ | NN, CHECK end_time > start_time | End |
| status | VARCHAR(10) | NN, DEFAULT `'upcoming'`, CHECK `upcoming`, `running`, `finished` | Set to `finished` when finalized |
| ratings_applied | BOOLEAN | NN, DEFAULT FALSE | TRUE after finalize; stops ratings being applied twice |

#### `contest_problems`: which problems are in which contest (M:N, from CONTAINS)

| Column | Type | Constraints | Description |
|---|---|---|---|
| contest_id | INT | PK (part), FK → contests, ON DELETE CASCADE | The contest |
| problem_id | INT | PK (part), FK → problems, ON DELETE RESTRICT | The problem |
| points | INT | NN, DEFAULT 100, CHECK > 0 | Points for solving it in this contest |
| position | INT | NN, CHECK > 0, UQ with contest_id | Order in the contest (A, B, C…); no two problems share a position |

#### `contest_registrations`: who joined which contest (M:N, from REGISTERS)

| Column | Type | Constraints | Description |
|---|---|---|---|
| contest_id | INT | PK (part), FK → contests, ON DELETE CASCADE | The contest |
| user_id | INT | PK (part), FK → users, ON DELETE CASCADE | The user; the composite PK stops double registration |
| registered_at | TIMESTAMPTZ | NN, DEFAULT now() | When they registered (a trigger rejects registration after the contest ends) |

#### `submissions`: every code submission

| Column | Type | Constraints | Description |
|---|---|---|---|
| submission_id | BIGSERIAL | PK | Auto-generated; BIGSERIAL because this table grows fastest |
| user_id | INT | NN, FK → users, ON DELETE CASCADE | Who submitted |
| problem_id | INT | NN, FK → problems, ON DELETE RESTRICT | Which problem |
| contest_id | INT | FK → contests, ON DELETE SET NULL | The contest, or **NULL for a practice submission** (trigger checks registration and contest time) |
| language | VARCHAR(20) | NN, CHECK `python`, `cpp`, `c`, `java`, `javascript` | Programming language |
| code | TEXT | NN, CHECK length 1–65536 | Source code |
| verdict | VARCHAR(10) | NN, DEFAULT `'PENDING'`, CHECK `PENDING`, `RUNNING`, `AC`, `WA`, `TLE`, `MLE`, `RE`, `CE` | Judge result |
| runtime_ms | INT | CHECK ≥ 0 | Slowest test case time; NULL until judged |
| memory_kb | INT | CHECK ≥ 0 | Memory used; NULL until judged |
| submitted_at | TIMESTAMPTZ | NN, DEFAULT now() | Submission time, used for contest penalty and ordering |

#### `ratings_history`: one row per user per rated contest

| Column | Type | Constraints | Description |
|---|---|---|---|
| rating_id | SERIAL | PK | Auto-generated |
| user_id | INT | NN, FK → users, ON DELETE CASCADE | Whose rating changed |
| contest_id | INT | NN, FK → contests, ON DELETE CASCADE | Which contest caused it |
| old_rating | INT | NN, CHECK 0–4000 | Rating before |
| new_rating | INT | NN, CHECK 0–4000 | Rating after (a trigger copies it to `users.global_rating`) |
| changed_at | TIMESTAMPTZ | NN, DEFAULT now() | When it was applied |
| | | UQ (user_id, contest_id) | At most one rating change per user per contest |

#### View `contest_standings`

Not a table: a saved query that joins `submissions`, `contest_problems` and `contest_registrations` and ranks users in each contest by score, then by solve time. The standings page and `finalize_contest()` both read it, so they always agree.

### 8.2 MongoDB collections

Each document refers to PostgreSQL by ID. A `$jsonSchema` validator checks the shape of every document.

#### `test_cases`: one document per problem

| Field | Type | Rules | Description |
|---|---|---|---|
| problem_id | int | required, ≥ 1, **unique index** | Links to `problems.problem_id` |
| cases | array | required, at least 1 item | All test cases of the problem |
| cases[].input | string | required | Input given to the program |
| cases[].expected_output | string | required | Correct output |
| cases[].is_sample | bool | | TRUE = shown on the problem page; FALSE = hidden, never sent to the browser |
| cases[].weight | int or double | | Weight of the case |

#### `execution_logs`: one document per judged submission

| Field | Type | Rules | Description |
|---|---|---|---|
| submission_id | int or long | required, **unique index** | Links to `submissions.submission_id` |
| compile_output | string or null | | Compiler errors (for C, C++, Java) |
| per_case | array | | One entry per test case run: `case_idx`, `verdict`, `time_ms`, `stdout` (first 500 characters), `stderr`; judging stops at the first failing case |
| judged_at | date | required, indexed | When judging finished |

## 9. SQL / NoSQL / vector database implementation



### 9.1 SQL: DDL

| Statement | Where | What it shows |
|---|---|---|
| CREATE TABLE | `db/postgres/01_schema.sql` | 7 tables with primary keys, foreign keys (with RESTRICT / CASCADE / SET NULL), NOT NULL, UNIQUE, CHECK and DEFAULT |
| CREATE VIEW | `01_schema.sql` | `contest_standings` (see 9.3) |
| CREATE INDEX | `01_schema.sql` | 8 indexes (table below) |
| CREATE FUNCTION / TRIGGER | `02_functions_triggers.sql`, `03_registration_rules.sql`, `04_fair_rating.sql` | triggers and stored functions (see 9.3) |
| ALTER / DROP | `db/demo/ddl_demo.sql` | adds a column and a CHECK constraint to `users`, adds an array column with a GIN index to `problems`, then drops all of them again |

**Indexes and why each exists**

| Index | Type | Used by |
|---|---|---|
| `idx_submissions_user (user_id, submitted_at DESC)` | B-tree | "My submissions", newest first |
| `idx_submissions_contest_user (contest_id, user_id) WHERE contest_id IS NOT NULL` | partial B-tree | standings and the registration check; practice submissions are left out, so the index stays small |
| `idx_submissions_problem (problem_id, verdict)` | B-tree | solve counts per problem |
| `idx_problems_difficulty (difficulty)` | B-tree | filtering problems by difficulty |
| `idx_users_rating (global_rating DESC)` | B-tree | leaderboard |
| `idx_ratings_user (user_id, changed_at)` | B-tree | a user's rating history on the profile |
| `idx_problems_fts` on `search_tsv` | GIN | full-text search |
| `idx_problems_embedding` on `embedding` | HNSW (`vector_cosine_ops`) | similar problems |

### 9.2 SQL: DML in the application

| Operation | Example in the app |
|---|---|
| INSERT | register a user, create a problem, register for a contest, store a submission |
| SELECT | problem list with search, standings, leaderboard, profile, submission history (JOINs, GROUP BY, window functions) |
| UPDATE | the judge stores the verdict on the submission; an admin edits a problem (`PATCH /api/problems/:id`); finalize marks a contest finished |
| DELETE | an admin deletes an unused problem (refused by `ON DELETE RESTRICT` if it has submissions or is in a contest); a user unregisters before a contest starts (`DELETE ... USING contests ... AND now() < start_time`) |

All queries use parameters (`$1`, `$2`), never string concatenation, which prevents SQL injection.

### 9.3 Advanced database features

**Triggers** (rules the database enforces on every insert, whoever does it)

| Trigger | Fires | Rule |
|---|---|---|
| T1 `trg_problems_author_admin`, `trg_contests_organizer_admin` | BEFORE INSERT / UPDATE | only admins can author problems or organize contests |
| T2 `trg_submissions_validate` | BEFORE INSERT on `submissions` | a contest submission must be from a registered user, inside the contest time, for a problem in that contest (practice submissions skip this) |
| T3 `trg_ratings_apply` | AFTER INSERT on `ratings_history` | copies the new rating to `users.global_rating` |
| T4 `trg_contest_finished` | AFTER UPDATE OF status on `contests`, only when it changes to `finished` | recalculates `global_rank` for all contestants with `RANK()` |
| T5 `trg_registrations_validate` | BEFORE INSERT on `contest_registrations` | rejects registration after the contest has ended |

These rules need data from other tables (for example the contest's end time), which a CHECK constraint cannot read; that is why they are triggers.

**Stored functions**

- `finalize_contest(contest_id)` applies the ratings for a finished contest (see Transactions).
- `find_similar_problems(problem_id, k)` returns the k most similar problems (see 9.5).
- `fn_refresh_global_ranks()` recalculates every contestant's rank.

**Transactions**

`finalize_contest()` runs as **one transaction**: either every step happens or none does.

1. `SELECT ... FOR UPDATE` locks the contest row, so two admins clicking "finalize" at the same time cannot both run it.
2. It refuses if the contest is unknown, already finalized (`ratings_applied`), or not ended yet.
3. It inserts one `ratings_history` row per participant. Each insert fires T3, which updates the user's rating.
4. It sets the contest to `finished` and `ratings_applied = TRUE`, which fires T4 to recalculate ranks.

If anything fails in between (a constraint, a crash), PostgreSQL rolls everything back, so ratings are never half applied. `UNIQUE (user_id, contest_id)` in `ratings_history` is a second safety net against double rating.

Rating rule: only participants (registered users with at least one submission) are rated. They are ordered like the standings; tied players share the average of their places, and the change is `ROUND(60 × ((n + 1) / 2 − place) / n)`, so the changes add up to zero.

Creating a contest is also a transaction in the API (`BEGIN`, insert the contest, insert its problems, `COMMIT`, or `ROLLBACK` on any error), so a contest is never saved without its problems.

**View**

`contest_standings` computes live results: for each user it takes the **first accepted** submission per problem (`DISTINCT ON`), adds up the points (`SUM`), adds up the solve times as penalty, and ranks users in each contest with `RANK() OVER (PARTITION BY contest_id ORDER BY score DESC, time ASC)`. The standings page and `finalize_contest()` both read this view, so the page and the ratings always agree.

**Full-text search**

`search_tsv` is a generated column built from the title (weight A, more important) and the statement (weight B). The problem search uses `search_tsv @@ websearch_to_tsquery('english', ...)` and orders results by `ts_rank`. Because of stemming, searching "graphs" also finds "graph". The GIN index makes it fast.

### 9.4 MongoDB implementation

**Collections:** `test_cases` (one document per problem) and `execution_logs` (one document per judged submission); fields are in section 8.2.

**Integrity in MongoDB**

- `$jsonSchema` validators: required fields and types (for example `cases` must be an array with at least one item).
- Unique indexes on `test_cases.problem_id` and `execution_logs.submission_id`: one document per problem and per submission.
- An index on `execution_logs.judged_at` for time-based queries.
- Hidden test cases never leave the server: the API sends only cases with `is_sample = true`.

**Aggregation pipelines** (`db/mongo/queries/aggregations.js`)

| # | Question | Stages |
|---|---|---|
| 1 | How often does each verdict happen across all test-case runs, and how fast? | `$unwind` the `per_case` array, `$group` by verdict with `$sum`, `$avg`, `$max`, then `$sort` |
| 2 | Which five submissions took the longest in total? | `$project` with `$size`, `$sum`, `$max`, then `$sort`, `$limit` |
| 3 | How many sample and hidden test cases does each problem have? | `$project` with `$filter`, `$addFields` with `$subtract`, `$sort` |

Pipeline 1 is also used in the app: `GET /api/stats/verdicts` (admin only) feeds the admin dashboard.

### 9.5 Vector similarity search

| Question (from the guidelines) | Answer |
|---|---|
| What data is converted into embeddings? | each problem's title and statement, joined as one text |
| Which embedding model? | `all-MiniLM-L6-v2` (sentence-transformer, run locally through `@huggingface/transformers` in `scripts/embed.js`), mean pooling, normalized vectors |
| How are vectors stored? | in the `problems.embedding` column, type `vector(384)` (pgvector), in the same row as the problem |
| Similarity metric | cosine distance (`<=>`); similarity shown to users = `1 − distance` |
| How are results retrieved? | `find_similar_problems(id, k)` orders all other problems by distance to the chosen problem's vector and returns the top k; the HNSW index makes this nearest-neighbour search fast. `GET /api/problems/:id/similar` calls it for the problem page. |

Keeping vectors up to date: `npm run embed` fills every problem whose embedding is NULL. When an admin edits a problem's title or statement, the embedding is set to NULL so the next run recomputes it.

### 9.6 How the three databases work together: one submission

1. **PostgreSQL:** `INSERT` into `submissions` with verdict `PENDING`. Trigger T2 checks registration, contest time and contest problem; if any check fails, nothing is saved.
2. **MongoDB:** the server reads the problem's test cases from `test_cases` in one read.
3. The judge runs the code in an isolated Docker container against each case and stops at the first failure.
4. **PostgreSQL:** `UPDATE` the submission with the final verdict and runtime.
5. **MongoDB:** insert the detailed per-case log into `execution_logs`.
6. **PostgreSQL view:** the standings now include the result automatically.

## 10. Important queries

_(to write)_

## 11. System architecture

_(to write)_

## 12. Application screenshots

_(to add)_

## 13. Testing results

_(to write)_

## 14. Conclusion and future enhancements

_(to write)_
