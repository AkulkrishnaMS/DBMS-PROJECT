# CP Judge: Competitive Programming Judge (DBMS Level 3 project)

Users solve programming problems and join timed contests. Submitted code runs inside a Docker sandbox, gets a verdict (AC, WA, TLE, MLE, RE, CE), and contest results update ratings and ranks.

Stack: Next.js (API route handlers) · PostgreSQL + pgvector · MongoDB · Docker sandbox.

## Why three data stores
| Data | Store | Reason |
|---|---|---|
| users, problems, contests, submissions, ratings | PostgreSQL | relational data, constraints, triggers, transactions |
| test cases, per-case execution logs | MongoDB | bulky, variable-length documents, read by id, no joins needed |
| problem embeddings (planned) | pgvector (inside Postgres) | similarity search combined with normal SQL filters |

## Requirements
- Linux with Docker, and your user in the `docker` group (`sudo usermod -aG docker $USER`, then log out and in, or run `newgrp docker`). The app starts Docker containers to judge code, so run `npm run dev` from a shell where `docker ps` works without sudo.
- Node.js 20 or newer.
- Tested only on Linux. Windows/macOS are untested.

## Setup
```bash
git clone <repo-url> && cd cp-judge
cp .env.example .env              # then edit .env (passwords; JWT_SECRET: openssl rand -hex 32)
docker compose up -d              # PostgreSQL+pgvector on host port 5433, MongoDB on 27017
docker pull python:3.12-slim && docker pull gcc:13     # sandbox images, one time
npm install
npm run create-admin -- admin admin@test.com 'Admin@12345'
npm run dev                       # http://localhost:3000
```
Notes:
- Postgres is published on host port **5433** (container port 5432) because many machines already run Postgres on 5432. In `docker-compose.yml` the line must read `"5433:5432"`.
- The SQL in `db/postgres/` and the script `db/mongo/init.js` run **only when the database volume is first created**. To re-run them after a schema change: `docker compose down -v && docker compose up -d` (this **deletes all data**).
- Never commit `.env`. `.env.example` is the template.
- Judge0 services are in `docker-compose.yml` behind `--profile judge` but are **not used**: Judge0 1.13.1 could not build its sandbox on a cgroup v2 host. We built our own Docker sandbox (`lib/judge.js`).

## Verify the database layer
```bash
set -a; source .env; set +a
docker exec -i judge_postgres psql -U "$PG_USER" -d "$PG_DB" < db/tests/smoke_test.sql
```
Expect 7 `PASS` notices and a final `ROLLBACK` (the test saves nothing).

## Try the whole flow with curl
Cookie files (`*.txt`) are git-ignored; they contain login tokens.
```bash
# 1. log in as admin, save the cookie
curl -c admin.txt -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345"}'

# 2. create a problem (Postgres row + MongoDB test cases)
curl -b admin.txt -X POST localhost:3000/api/problems -H 'Content-Type: application/json' -d '{
 "title":"Double It","statement":"Read n, print 2n.","difficulty":800,
 "cases":[{"input":"21\n","expected_output":"42\n","is_sample":true},{"input":"5\n","expected_output":"10\n"}]}'

# 3. submit a solution (use the returned problem_id)
curl -b admin.txt -X POST localhost:3000/api/submissions -H 'Content-Type: application/json' \
  -d '{"problem_id":1,"language":"python","code":"print(int(input())*2)"}'
```
Expected: `"verdict":"AC"`. Try `print(1)` (WA), `while True: pass` (TLE), a syntax error (RE), invalid C++ (CE).

## API reference
JSON in and out. Login sets an httpOnly cookie named `token` (valid 8 hours).

| Method and path | Who | Body / query | Returns |
|---|---|---|---|
| POST `/api/auth/register` | anyone | `username, email, password` (min 8 chars) | 201 `{user_id, username, role}` |
| POST `/api/auth/login` | anyone | `username, password` | `{user_id, username, role}` + cookie |
| POST `/api/auth/logout` | anyone | | `{ok:true}` |
| GET `/api/problems` | anyone | `?q=text&min=800&max=1600` | `[{problem_id, title, difficulty}]` |
| POST `/api/problems` | admin | `title, statement, difficulty, time_limit_ms?, memory_limit_kb?, cases:[{input, expected_output, is_sample}]` | 201 `{problem_id}` |
| GET `/api/problems/:id` | anyone | | problem + sample cases only (hidden cases never leave the server) |
| GET `/api/contests` | anyone | | contests with `phase` (upcoming/running/ended/finished), `registered`, `problems` |
| POST `/api/contests` | admin | `name, start_time, end_time` (ISO, UTC), `problems:[{problem_id, points}]` | 201 `{contest_id}` (created in one transaction) |
| POST `/api/contests/:id/register` | logged in | | 201 `{ok:true}` |
| GET `/api/contests/:id/standings` | anyone | | `[{standing, username, solved, score, penalty_min}]` |
| POST `/api/contests/:id/finalize` | admin | | `{users_rated}`; only after the contest has ended |
| POST `/api/submissions` | logged in | `problem_id, contest_id?, language` (`python` or `cpp`), `code` | `{submission_id, verdict, runtime_ms, compile_output, cases[]}` |
| GET `/api/submissions` | logged in | | the caller's 50 latest submissions |

Errors are `{"error": "message"}` with: 400 bad input or a database rule (the message says which), 401 not logged in, 403 wrong role, 404 not found, 409 conflict (duplicate, contest not ended, already finalized), 500 server error.

Gotcha for the UI: Postgres `COUNT`, `SUM`, `RANK` and `BIGSERIAL` values arrive as **strings** (for example `"score":"100"`). Convert them in the frontend.

Not written yet (the UI will probably need them): current user (`/api/me`), contest details with its problems, global leaderboard, submission detail with logs, similar problems, edit/delete problem.

## Roles and rules enforced by the database
- Two roles: `admin` and `contestant`. Registration always creates a contestant; admins are created with `npm run create-admin`.
- Triggers: only admins can author problems or organize contests; a contest submission must come from a registered user, inside the contest time window, for a problem that belongs to that contest; a finished contest recalculates global ranks.
- `finalize_contest()` runs as one transaction: it locks the contest row, writes rating changes for all registered users, and marks the contest finished. A second call is rejected.

## Project layout
```
db/postgres/01_schema.sql              tables, constraints, indexes, contest_standings view
db/postgres/02_functions_triggers.sql  4 triggers, finalize_contest(), find_similar_problems()
db/mongo/init.js                       test_cases and execution_logs (validators, indexes)
db/tests/smoke_test.sql                self-rolling-back database tests
db/demo/ddl_demo.sql                   ALTER / DROP demonstration
lib/db.js  lib/auth.js  lib/http.js    connections, JWT + role checks, error mapping
lib/judge.js                           Docker sandbox runner (python, cpp)
app/api/**/route.js                    one file per endpoint
scripts/create-admin.js                creates the first admin
```

## Known limitations
- The time limit is enforced as `limit + 1500 ms` of wall-clock time (container start-up overhead), so a solution slightly over the limit can still pass.
- MLE is inferred from exit code 137, not confirmed through the container's out-of-memory flag.
- A crash between inserting a submission and saving its verdict leaves it `PENDING`; there is no recovery job yet.
- PostgreSQL and MongoDB cannot share a transaction; problem creation deletes the Postgres row by hand if the Mongo write fails.
- `contests.status` is only ever set to `finished` (by `finalize_contest`); upcoming/running is derived from the times.
- Docker isolation is not a perfect security boundary (shared kernel), and `docker` group membership is effectively root on the host.
- `npm audit` reports advisories for Next.js 14.x; upgrade to a patched major version before any public deployment.
- No rate limiting yet.

## Team and tasks
See `TASKS.md`.
