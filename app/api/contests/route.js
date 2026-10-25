import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, bad } from '@/lib/http';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const { rows } = await pool.query(
    `SELECT c.contest_id, c.name, c.start_time, c.end_time,
            CASE WHEN c.status='finished' THEN 'finished'
                 WHEN now() < c.start_time THEN 'upcoming'
                 WHEN now() <= c.end_time THEN 'running' ELSE 'ended' END AS phase,
            COUNT(DISTINCT cr.user_id) AS registered, COUNT(DISTINCT cp.problem_id) AS problems
     FROM contests c
     LEFT JOIN contest_registrations cr ON cr.contest_id = c.contest_id
     LEFT JOIN contest_problems cp ON cp.contest_id = c.contest_id
     GROUP BY c.contest_id ORDER BY c.start_time DESC`);
  return NextResponse.json(rows);
});

// Admin only. Contest + its problems are created in ONE transaction.
export const POST = handle(async (req) => {
  const u = await requireUser('admin');
  const { name, start_time, end_time, problems } = await req.json();
  if (!name || !start_time || !end_time || !Array.isArray(problems) || !problems.length)
    throw bad('name, start_time, end_time and problems[] required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [c] } = await client.query(
      'INSERT INTO contests(organizer_id,name,start_time,end_time) VALUES($1,$2,$3,$4) RETURNING contest_id',
      [u.id, name, start_time, end_time]);
    for (const [i, p] of problems.entries())
      await client.query('INSERT INTO contest_problems(contest_id,problem_id,points,position) VALUES($1,$2,$3,$4)',
        [c.contest_id, p.problem_id, p.points ?? 100, i + 1]);
    await client.query('COMMIT');
    return NextResponse.json(c, { status: 201 });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
});
