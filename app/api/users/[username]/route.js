import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Public profile: rating, rank, solved count and rating history (JOIN ratings_history -> contests).
// Never returns email or code.
export const GET = handle(async (_req, { params }) => {
  const { rows: [p] } = await pool.query(
    `SELECT u.user_id, u.username, u.role, u.global_rating, u.global_rank, u.created_at,
            (SELECT COUNT(DISTINCT s.problem_id) FROM submissions s
              WHERE s.user_id = u.user_id AND s.verdict = 'AC') AS problems_solved
     FROM users u WHERE u.username = $1`, [params.username]);
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: history } = await pool.query(
    `SELECT c.contest_id, c.name AS contest, rh.old_rating, rh.new_rating,
            rh.new_rating - rh.old_rating AS delta, rh.changed_at
     FROM ratings_history rh JOIN contests c ON c.contest_id = rh.contest_id
     WHERE rh.user_id = $1 ORDER BY rh.changed_at`, [p.user_id]);
  return NextResponse.json({ ...p, history });
});
