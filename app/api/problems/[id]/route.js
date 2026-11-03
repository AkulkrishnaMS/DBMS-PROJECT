import { NextResponse } from 'next/server';
import { pool, mongo } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, bad } from '@/lib/http';
export const dynamic = 'force-dynamic';

export const GET = handle(async (_req, { params }) => {
  const { rows } = await pool.query(
    `SELECT problem_id, title, statement, difficulty, time_limit_ms, memory_limit_kb FROM problems WHERE problem_id=$1`, [params.id]);
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const doc = await (await mongo()).collection('test_cases').findOne({ problem_id: rows[0].problem_id });
  return NextResponse.json({ ...rows[0], samples: (doc?.cases || []).filter((c) => c.is_sample) }); // hidden cases never leave the server
});

// Admin only. UPDATE: change any of title, statement, difficulty, time_limit_ms, memory_limit_kb.
// Fields left out keep their value (COALESCE). Test cases are not changed here.
// The CHECK constraints in 01_schema.sql still apply (e.g. difficulty 800..3500 -> 400 error).
// search_tsv is a GENERATED column, so full-text search updates by itself.
// The embedding was computed from the old text, so it is cleared when the title or statement
// changes; `npm run embed` fills it again (it only fills problems whose embedding is NULL).
export const PATCH = handle(async (req, { params }) => {
  await requireUser('admin');
  if (!/^\d+$/.test(params.id)) throw bad('Invalid id');
  const b = await req.json();
  const fields = ['title', 'statement', 'difficulty', 'time_limit_ms', 'memory_limit_kb'];
  if (!fields.some((f) => b[f] !== undefined && b[f] !== null)) throw bad('Nothing to update');
  if (b.title !== undefined && !String(b.title).trim()) throw bad('Title cannot be empty');
  if (b.statement !== undefined && !String(b.statement).trim()) throw bad('Statement cannot be empty');

  // On the right-hand side of SET, column names mean the OLD values of the row.
  const { rows: [p] } = await pool.query(
    `UPDATE problems SET
        title           = COALESCE($2::varchar, title),
        statement       = COALESCE($3::text, statement),
        difficulty      = COALESCE($4::int, difficulty),
        time_limit_ms   = COALESCE($5::int, time_limit_ms),
        memory_limit_kb = COALESCE($6::int, memory_limit_kb),
        embedding       = CASE WHEN COALESCE($2::varchar, title) = title
                                AND COALESCE($3::text, statement) = statement
                               THEN embedding ELSE NULL END
     WHERE problem_id = $1
     RETURNING problem_id, title, difficulty, time_limit_ms, memory_limit_kb,
               embedding IS NULL AS needs_embedding`,
    [params.id, b.title?.trim() ?? null, b.statement ?? null,
     b.difficulty ?? null, b.time_limit_ms ?? null, b.memory_limit_kb ?? null]);
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(p);
});

// Admin only. DELETE: only a problem that was never used can be deleted.
// submissions.problem_id and contest_problems.problem_id are ON DELETE RESTRICT, so Postgres itself
// refuses (error 23503) when a submission or contest still points at the problem. That keeps
// everyone's submission history and old contest results complete.
export const DELETE = handle(async (_req, { params }) => {
  await requireUser('admin');
  if (!/^\d+$/.test(params.id)) throw bad('Invalid id');
  let rowCount;
  try {
    ({ rowCount } = await pool.query('DELETE FROM problems WHERE problem_id = $1', [params.id]));
  } catch (e) {
    if (e.code === '23503')
      return NextResponse.json(
        { error: 'This problem has submissions or is part of a contest, so it cannot be deleted.' },
        { status: 409 });
    throw e;
  }
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The Postgres row is gone. Removing the test cases from MongoDB is cleanup: if it fails,
  // the leftover document is harmless (nothing can reach it without the problem row).
  try {
    await (await mongo()).collection('test_cases').deleteOne({ problem_id: Number(params.id) });
  } catch (e) { console.error('test_cases cleanup failed for problem', params.id, e.message); }
  return NextResponse.json({ ok: true });
});
