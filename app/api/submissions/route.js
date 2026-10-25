import { NextResponse } from 'next/server';
import { pool, mongo } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { judge } from '@/lib/judge';
import { handle, bad } from '@/lib/http';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const u = await requireUser();
  const { rows } = await pool.query(
    `SELECT s.submission_id, p.title, s.contest_id, s.language, s.verdict, s.runtime_ms, s.submitted_at
     FROM submissions s JOIN problems p ON p.problem_id = s.problem_id
     WHERE s.user_id=$1 ORDER BY s.submitted_at DESC LIMIT 50`, [u.id]);
  return NextResponse.json(rows);
});

export const POST = handle(async (req) => {
  const u = await requireUser();
  const { problem_id, contest_id = null, language, code } = await req.json();
  if (!problem_id || !language || !code) throw bad('problem_id, language, code required');

  const { rows: [pr] } = await pool.query(
    'SELECT time_limit_ms, memory_limit_kb FROM problems WHERE problem_id=$1', [problem_id]);
  if (!pr) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  // DB triggers enforce: registered, inside contest window, problem belongs to contest
  const { rows: [s] } = await pool.query(
    `INSERT INTO submissions(user_id,problem_id,contest_id,language,code) VALUES($1,$2,$3,$4,$5) RETURNING submission_id`,
    [u.id, problem_id, contest_id, language, code]);

  const db = await mongo();
  const tc = await db.collection('test_cases').findOne({ problem_id });
  if (!tc) return NextResponse.json({ error: 'Problem has no test cases' }, { status: 500 });

  const r = await judge({ code, language, cases: tc.cases, timeLimitMs: pr.time_limit_ms, memoryKb: pr.memory_limit_kb });

  await pool.query('UPDATE submissions SET verdict=$1, runtime_ms=$2 WHERE submission_id=$3',
    [r.verdict, r.runtimeMs, s.submission_id]);
  await db.collection('execution_logs').insertOne({
    submission_id: Number(s.submission_id), compile_output: r.compileOutput, per_case: r.perCase, judged_at: new Date() });

  return NextResponse.json({ submission_id: s.submission_id, verdict: r.verdict, runtime_ms: r.runtimeMs,
    compile_output: r.compileOutput, cases: r.perCase.map(({ case_idx, verdict }) => ({ case_idx, verdict })) });
});
