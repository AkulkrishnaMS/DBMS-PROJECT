import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

export const GET = handle(async (_req, { params }) => {
  const { rows } = await pool.query(
    `SELECT standing, username, solved, score, penalty_min FROM contest_standings
     WHERE contest_id=$1 ORDER BY standing, username`, [params.id]);
  return NextResponse.json(rows);
});
