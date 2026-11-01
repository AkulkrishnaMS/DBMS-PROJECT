import { NextResponse } from 'next/server';
import { pool, mongo } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, bad } from '@/lib/http';
export const dynamic = 'force-dynamic';

// One submission: row from Postgres + raw sandbox log from MongoDB.
// Owner or admin only. Expected outputs of hidden tests are never in this log, only the user's own stdout.
export const GET = handle(async (_req, { params }) => {
  const u = await requireUser();
  if (!/^\d+$/.test(params.id)) throw bad('Invalid id');
  const { rows: [s] } = await pool.query(
    `SELECT s.submission_id, s.user_id, us.username, s.problem_id, p.title, s.contest_id,
            s.language, s.code, s.verdict, s.runtime_ms, s.memory_kb, s.submitted_at
     FROM submissions s
     JOIN problems p ON p.problem_id = s.problem_id
     JOIN users us ON us.user_id = s.user_id
     WHERE s.submission_id = $1`, [params.id]);
  // 404 (not 403) for other people's submissions, so ids cannot be probed
  if (!s || (s.user_id !== u.id && u.role !== 'admin'))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const log = await (await mongo()).collection('execution_logs')
    .findOne({ submission_id: Number(s.submission_id) }, { projection: { _id: 0 } });
  return NextResponse.json({ ...s, log: log ?? null });
});
