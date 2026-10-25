import { NextResponse } from 'next/server';
import { pool, mongo } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, bad } from '@/lib/http';
export const dynamic = 'force-dynamic';

// GET /api/problems?q=graph&min=800&max=1600   (full-text search + difficulty filter)
export const GET = handle(async (req) => {
  const sp = new URL(req.url).searchParams;
  const { rows } = await pool.query(
    `SELECT problem_id, title, difficulty FROM problems
     WHERE ($1::text IS NULL OR search_tsv @@ websearch_to_tsquery('english', $1::text))
       AND ($2::int IS NULL OR difficulty >= $2::int)
       AND ($3::int IS NULL OR difficulty <= $3::int)
     ORDER BY CASE WHEN $1::text IS NULL THEN 0
                   ELSE -ts_rank(search_tsv, websearch_to_tsquery('english', $1::text)) END, difficulty`,
    [sp.get('q') || null, sp.get('min') || null, sp.get('max') || null]);
  return NextResponse.json(rows);
});

// Admin only. Postgres row + Mongo test cases; if Mongo fails, the Postgres row is rolled back manually.
export const POST = handle(async (req) => {
  const u = await requireUser('admin');
  const b = await req.json();
  if (!b.title || !b.statement || !Array.isArray(b.cases) || !b.cases.length)
    throw bad('title, statement and at least one test case required');
  const { rows: [p] } = await pool.query(
    `INSERT INTO problems(author_id,title,statement,difficulty,time_limit_ms,memory_limit_kb)
     VALUES($1,$2,$3,$4,COALESCE($5,2000),COALESCE($6,262144)) RETURNING problem_id`,
    [u.id, b.title, b.statement, b.difficulty, b.time_limit_ms ?? null, b.memory_limit_kb ?? null]);
  try {
    const db = await mongo();
    await db.collection('test_cases').insertOne({
      problem_id: p.problem_id,
      cases: b.cases.map((c) => ({ input: String(c.input), expected_output: String(c.expected_output), is_sample: !!c.is_sample, weight: 1 })),
    });
  } catch (e) {
    await pool.query('DELETE FROM problems WHERE problem_id=$1', [p.problem_id]);
    throw e;
  }
  return NextResponse.json(p, { status: 201 });
});
