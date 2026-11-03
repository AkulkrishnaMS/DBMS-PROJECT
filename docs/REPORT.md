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

_(explanation: see Lesson 2)_

## 6. Relational schema

![Relational schema](schema_diagram.png)

_(explanation: see Lesson 2)_

## 7. Database choice and justification

**PostgreSQL (structured data).** Users, problems, contests, submissions and ratings have a fixed format and are closely connected; for example, a submission belongs to a user, a problem and possibly a contest. This data must stay correct, so we use PostgreSQL: foreign keys keep the links valid, CHECK constraints and triggers reject bad data (for example, registering after a contest has ended), transactions make finalizing a contest all-or-nothing, and JOINs produce results like the contest standings.

**MongoDB (semi-structured data).** Test cases and judge logs have a known shape, but their number and size vary a lot from problem to problem. They never need JOINs, and the judge always reads all test cases of one problem at once. MongoDB stores them as one document per problem, fetched in a single read by `problem_id`. Validators still enforce the shape of each document.

**pgvector (meaning-based search).** To find similar problems, each problem statement is turned into an embedding of 384 numbers, so statements with similar meaning have nearby vectors. We use pgvector inside PostgreSQL, so the vector is stored in the same row as the problem and similarity search can be combined with normal SQL filters, with no extra service.

**How they connect.** PostgreSQL is the source of truth. MongoDB documents refer to it by ID (`test_cases.problem_id`, `execution_logs.submission_id`).

## 8. Data dictionary / schema description

_(to write)_

## 9. SQL / NoSQL / vector database implementation

_(to write)_

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
