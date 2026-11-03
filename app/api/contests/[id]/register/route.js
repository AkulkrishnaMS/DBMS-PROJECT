import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Register. Trigger T5 (03_registration_rules.sql) rejects it once the contest has ended.
export const POST = handle(async (_req, { params }) => {
  const u = await requireUser();
  await pool.query('INSERT INTO contest_registrations(contest_id,user_id) VALUES($1,$2)', [params.id, u.id]);
  return NextResponse.json({ ok: true }, { status: 201 });
});

// Unregister. Only allowed BEFORE the contest starts; otherwise a player doing badly could
// leave mid-contest to avoid a rating loss. The condition is inside the DELETE itself
// (DELETE ... USING contests ... AND now() < start_time), so check and delete are one atomic statement.
export const DELETE = handle(async (_req, { params }) => {
  const u = await requireUser();
  const { rowCount } = await pool.query(
    `DELETE FROM contest_registrations r
     USING contests c
     WHERE c.contest_id = r.contest_id
       AND r.contest_id = $1 AND r.user_id = $2
       AND now() < c.start_time`, [params.id, u.id]);
  if (rowCount) return NextResponse.json({ ok: true });

  // Nothing was deleted: find out why, to give a clear message.
  const { rows: [c] } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM contest_registrations
                    WHERE contest_id = c.contest_id AND user_id = $2) AS registered
     FROM contests c WHERE c.contest_id = $1`, [params.id, u.id]);
  if (!c) return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
  if (!c.registered) return NextResponse.json({ error: 'You are not registered for this contest' }, { status: 404 });
  return NextResponse.json({ error: 'The contest has already started, so you can no longer unregister' }, { status: 409 });
});
