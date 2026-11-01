import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Contest details + its problems (JOIN contest_problems -> problems), ordered by position.
// If the caller is logged in, `registered` says whether they joined.
export const GET = handle(async (_req, { params }) => {
  const u = await getUser();
  const { rows: [c] } = await pool.query(
    `SELECT c.contest_id, c.name, c.start_time, c.end_time, c.status, c.ratings_applied,
            CASE WHEN c.status='finished' THEN 'finished'
                 WHEN now() < c.start_time THEN 'upcoming'
                 WHEN now() <= c.end_time THEN 'running' ELSE 'ended' END AS phase,
            o.username AS organizer,
            (SELECT COUNT(*) FROM contest_registrations r WHERE r.contest_id = c.contest_id) AS registered,
            EXISTS (SELECT 1 FROM contest_registrations r
                    WHERE r.contest_id = c.contest_id AND r.user_id = $2) AS is_registered
     FROM contests c JOIN users o ON o.user_id = c.organizer_id
     WHERE c.contest_id = $1`, [params.id, u?.id ?? null]);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Problem list is hidden until the contest starts (so nobody sees problems early).
  let problems = [];
  if (c.phase !== 'upcoming') {
    ({ rows: problems } = await pool.query(
      `SELECT cp.position, cp.points, p.problem_id, p.title, p.difficulty
       FROM contest_problems cp JOIN problems p ON p.problem_id = cp.problem_id
       WHERE cp.contest_id = $1 ORDER BY cp.position`, [params.id]));
  }
  return NextResponse.json({ ...c, problems });
});
