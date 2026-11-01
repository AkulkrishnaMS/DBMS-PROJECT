import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Current user + a few personal stats (one query, two scalar subqueries).
export const GET = handle(async () => {
  const u = await requireUser();
  const { rows: [me] } = await pool.query(
    `SELECT u.user_id, u.username, u.email, u.role, u.global_rating, u.global_rank, u.created_at,
            (SELECT COUNT(*) FROM submissions s WHERE s.user_id = u.user_id) AS submissions,
            (SELECT COUNT(DISTINCT s.problem_id) FROM submissions s
              WHERE s.user_id = u.user_id AND s.verdict = 'AC') AS problems_solved
     FROM users u WHERE u.user_id = $1`, [u.id]);
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(me);
});
