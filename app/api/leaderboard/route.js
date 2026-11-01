import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Global leaderboard: rating order with a window function, plus contests played (LEFT JOIN + GROUP BY).
// Only contestants appear (admins are problem setters). ?limit=50 (1..100)
export const GET = handle(async (req) => {
  const limit = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('limit')) || 50, 1), 100);
  const { rows } = await pool.query(
    `SELECT RANK() OVER (ORDER BY u.global_rating DESC) AS position,
            u.user_id, u.username, u.global_rating, u.global_rank,
            COUNT(rh.rating_id) AS contests_played
     FROM users u LEFT JOIN ratings_history rh ON rh.user_id = u.user_id
     WHERE u.role = 'contestant'
     GROUP BY u.user_id
     ORDER BY u.global_rating DESC, u.username
     LIMIT $1`, [limit]);
  return NextResponse.json(rows);
});
