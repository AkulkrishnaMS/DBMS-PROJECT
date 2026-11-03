# ER diagram and relational schema

- `er_diagram.png`: conceptual ER diagram (Chen notation). Source: `er_diagram.dot`.
- `schema_diagram.png`: the actual PostgreSQL tables with keys and delete rules. Source: `schema_diagram.dot`.

Re-render after a change (needs Graphviz):

```bash
dot -Kneato -Tpng docs/er_diagram.dot -o docs/er_diagram.png
dot -Tpng docs/schema_diagram.dot -o docs/schema_diagram.png
```

## ER notation

| Shape | Meaning |
|---|---|
| rectangle | entity |
| diamond | relationship |
| ellipse | attribute; underlined = primary key |
| dashed ellipse | derived attribute: `global_rank` (computed from ratings by a trigger), `search_tsv` (generated from title and statement) |
| double line | total participation: every row of that entity takes part |
| 1, M, N | cardinality |

Foreign keys are not drawn as attributes in the ER diagram: they are what the relationships turn into.
MongoDB collections (`test_cases`, `execution_logs`) are not part of the relational model.

## Relationships

| Relationship | Entities | Cardinality | Participation | Becomes |
|---|---|---|---|---|
| AUTHORS | USERS, PROBLEMS | 1 : N | total on PROBLEMS | `problems.author_id` NOT NULL |
| ORGANIZES | USERS, CONTESTS | 1 : N | total on CONTESTS | `contests.organizer_id` NOT NULL |
| REGISTERS | USERS, CONTESTS | M : N | partial | table `contest_registrations` (+ `registered_at`) |
| CONTAINS | CONTESTS, PROBLEMS | M : N | partial | table `contest_problems` (+ `points`, `position`) |
| SUBMITS | USERS, SUBMISSIONS | 1 : N | total on SUBMISSIONS | `submissions.user_id` NOT NULL |
| ATTEMPTS | PROBLEMS, SUBMISSIONS | 1 : N | total on SUBMISSIONS | `submissions.problem_id` NOT NULL |
| SCOPED_IN | CONTESTS, SUBMISSIONS | 1 : N | partial (practice submissions) | `submissions.contest_id` NULL allowed |
| HAS_RATING | USERS, RATINGS_HISTORY | 1 : N | total on RATINGS_HISTORY | `ratings_history.user_id` NOT NULL |
| AFFECTS | CONTESTS, RATINGS_HISTORY | 1 : N | total on RATINGS_HISTORY | `ratings_history.contest_id` NOT NULL |

## Mapping rules used

| ER concept | Relational result |
|---|---|
| entity | table, its key becomes the primary key |
| 1 : N relationship | foreign key on the N side |
| M : N relationship | junction table with a composite primary key of both foreign keys |
| relationship attribute | column of the junction table |
| total participation | foreign key is NOT NULL |
| partial participation | foreign key may be NULL |

## Delete rules (why each one)

| Rule | Where | Why |
|---|---|---|
| RESTRICT | `problems.author_id`, `contests.organizer_id` | an admin who wrote problems or ran contests cannot be deleted |
| RESTRICT | `submissions.problem_id`, `contest_problems.problem_id` | a problem that was used cannot be deleted, so history stays complete |
| CASCADE | registrations, ratings, a user's submissions | these rows mean nothing without their parent |
| CASCADE | `contest_problems.contest_id` | deleting a contest removes its problem list, not the problems |
| SET NULL | `submissions.contest_id` | deleting a contest keeps its submissions as practice submissions |

## Corrections from the first draft

- HAS_RATING and SCOPED_IN had their cardinalities flipped; both are 1 : N from the USERS / CONTESTS side.
- SCOPED_IN is partial, because practice submissions have no contest.
- CONTAINS and REGISTERS are M : N and became junction tables.
- Missing attributes added (`email`, `password_hash`, `global_rating`, `global_rank`, limits, `embedding`, `status`, `ratings_applied`, `language`, `code`, `runtime_ms`, `memory_kb`).
