# TASKS: who does what

Team: **Akul** (backend and database focus) and **Partner** (frontend focus).
Rule from the project guidelines: each member must contribute to **both** database and application work, and commits must show individual contributions. So every person below has SQL work and app work.

Fill in your real names, the deadline, and the project title at the bottom.

## 1. Status today

| Area | State |
|---|---|
| PostgreSQL schema, constraints, indexes, standings view, 4 triggers, `finalize_contest()` | Done. Smoke test passes (7 PASS) on Akul's machine. |
| MongoDB collections with validators and indexes | Done (created and in use). |
| Auth (bcrypt, JWT cookie, admin/contestant), problems, contests, registration, submissions, standings APIs | Done and run by hand with curl. |
| Docker sandbox judge | Done for Python and C++. All six verdicts (AC, WA, TLE, RE, CE, MLE) seen working. |
| Contest finalization (ratings and ranks) | Written. Not yet run on real data. |
| Web UI | Not started. |
| Embeddings and similar problems | Not started. |
| Mongo aggregation, important-queries file | Not started. |
| ER diagram redraw, relational schema, data dictionary, documentation | Not started. |
| UPDATE and DELETE features visible in the app | Not built (the app currently only inserts and reads). |

## 2. Akul's tasks (backend, database)

| # | Task | Touches | Done when |
|---|---|---|---|
| A1 | Bad JSON returns 400, not 500, in `lib/http.js` | app | `curl -d 'not json'` gives 400 `Invalid JSON` |
| A2 | Finalize a real contest and keep the evidence | DB | ratings and ranks match the formula; a second finalize is rejected; screenshots saved |
| A3 | `db/queries/important_queries.sql`: JOIN, GROUP BY, HAVING, ORDER BY, aggregates, subquery, CTE, window function, plus one `EXPLAIN` showing an index used | DB | file runs without errors; output screenshots saved |
| A4 | MongoDB aggregation (for example verdict counts and average case time per problem from `execution_logs`) exposed as a script or endpoint | DB + app | returns correct numbers for known submissions |
| A5 | Real embeddings for problem statements, `GET /api/problems/:id/similar` using `find_similar_problems()` | DB + app | similar problems are sensible for 10+ problems (needs P5) |
| A6 | Full-text search demo queries with `ts_rank` | DB | screenshots saved |
| A7 | Security pass: upgrade Next.js to a patched version, check rate limiting, review cookie settings | app | `npm audit` result recorded and explained |
| A8 | Judge hardening (optional): recover `PENDING` submissions, more accurate time limit | app | documented limitation either fixed or explained |
| A9 | Docs: relational schema, data dictionary, why SQL vs Mongo vs vector, SQL and Mongo implementation, important queries, testing results | docs | sections written with screenshots |

## 3. Partner's tasks (frontend, plus their own SQL)

| # | Task | Touches | Done when |
|---|---|---|---|
| P1 | Clone, set up from `README.md`, run the smoke test | setup | 7 PASS on Partner's machine |
| P2 | UI pages: register and login; problem list with search and difficulty filter; problem page with statement, samples, code editor, language choice and submit button showing the verdict; my submissions; contests list with register button; contest standings; admin forms (create problem, create contest, finalize) | app | each page works against the real API |
| P3 | New read endpoints, written with their own SQL: `/api/me`, contest details with its problems, global leaderboard (by rating and rank), submission detail with logs from Mongo, user profile with rating history | DB + app | endpoints documented in the README table |
| P4 | UPDATE and DELETE features: admin edits a problem (PATCH), and either deletes a problem or a user unregisters from a contest (DELETE), visible in the UI | DB + app | both operations demonstrable, with the DB rules (FK actions) explained |
| P5 | Add at least 10 problems with test cases and varied topics (graphs, strings, math, dp...) through the admin form or a seed script | data | problems exist for the demo and for A5 |
| P6 | Redraw the ER diagram (see section 5) | docs | diagram matches `01_schema.sql` |
| P7 | Docs: problem statement, objectives, scope, functional requirements, system architecture diagram, application screenshots, conclusion and future work | docs | sections written |

## 4. Shared

- Pick the **project title** (must be unique within the section) and confirm the **2-member team** with the course instructor.
- Prepare the **demo script** (problem statement, ER diagram, schema, queries, UI, advanced features, test cases, each person's contribution).
- Each person must be able to explain every part of the project, not only their own.

## 5. ER diagram corrections (for P6)

- HAS_RATING: the cardinality labels are flipped. One user has many rating-history rows (USERS 1 to N RATINGS_HISTORY).
- SCOPED_IN: also flipped. One contest has many submissions (CONTESTS 1 to N SUBMISSIONS), and participation is partial (practice submissions have no contest).
- CONTAINS (contests to problems) and REGISTERS (users to contests) are M:N, so they become the tables `contest_problems` and `contest_registrations`.
- Add the missing attributes: users (`email`, `password_hash`, `global_rating`, `global_rank`, `created_at`), problems (`statement`, `time_limit_ms`, `memory_limit_kb`, `embedding`), contests (`organizer_id`, `start_time`, `end_time`, `status`, `ratings_applied`), submissions (`language`, `code`, `runtime_ms`, `memory_kb`).
- Test cases and execution logs are MongoDB collections, not part of the relational ER diagram. Document them separately.

## 6. Working agreements

1. Work on branches (`git checkout -b feature/short-name`), open a pull request, and let the **other person** review it before merging into `main`.
2. Commit small and often, with messages that say what changed. Commits are how individual contribution is shown.
3. Never commit `.env`, `node_modules/`, `.next/`, or cookie files (`*.txt`). Check `git status` before each commit.
4. **Schema changes:** edit the SQL files, add new objects in a new numbered file (for example `db/postgres/03_something.sql`), and tell the other person in chat before merging. The SQL files run only when the database volume is first created, so everyone applies the change either by running the new file with `psql` or by `docker compose down -v && docker compose up -d` (which wipes data; use a seed script to refill).
5. **API changes:** update the API table in `README.md` in the same pull request.
6. Run `db/tests/smoke_test.sql` before merging any database change.
7. Postgres id gaps (1, 2, 4...) are normal: a rolled-back or rejected insert still uses a sequence number.

## 7. Guidelines checklist (from the DBMS Level 3 document)

| # | Requirement | Status |
|---|---|---|
| 1 | Unique project title, real-world problem, more than CRUD | Open: choose the title |
| 2 | Team of 2 approved by the instructor, clear responsibilities | Open: get approval; this file defines responsibilities |
| 3 | At least two database paradigms | Postgres + MongoDB done; vector search pending embeddings |
| 4 | ER diagram, relational schema, NoSQL data model documented | Open (P6, A9) |
| 5 | DDL: CREATE, ALTER, DROP, keys, constraints, indexes, views | Done (`db/postgres/*`, `db/demo/ddl_demo.sql`) |
| 6 | DML plus JOIN, GROUP BY, HAVING, ORDER BY, aggregates, subqueries | Partly: INSERT/SELECT/UPDATE in use; DELETE (P4) and the queries file (A3) pending |
| 7 | At least four advanced concepts | Done: transactions, views, stored function, triggers, indexing (plus full-text and vector to demonstrate) |
| 8 | Vector search (optional, recommended) | Open (A5) |
| 9 | Next.js web interface | Open (P2) |
| 10 | App talks to DB through an API layer, config in environment variables | Done |
| 11 | Authentication and at least 2 roles | Done (admin, contestant) |
| 12 | Validation and integrity at the database level | Done (CHECK, UNIQUE, FK, triggers) |
| 13 | Security: no plain-text passwords or hard-coded credentials | Done for passwords and credentials; A7 pending |
| 14 | Documentation (14 sections) | Open (A9, P7) |
| 15 | Git/GitHub with individual commits and a README | README done; repo push and commits pending |
| 16 | Final demonstration | Open (section 4) |
| 17 | Originality | Keep notes on our own design decisions |
| 18 | Level 3 expectation: beyond CRUD, choices justified by the data | Justification table is in `README.md`; expand in the docs |

## 8. To fill in

- Deadline / demo date: ________
- Project title: ________
- Instructor approval received: ________
- Embedding model for A5 (a small local model or an API): ________
