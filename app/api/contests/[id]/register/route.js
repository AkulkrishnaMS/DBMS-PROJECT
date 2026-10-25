import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

export const POST = handle(async (_req, { params }) => {
  const u = await requireUser();
  await pool.query('INSERT INTO contest_registrations(contest_id,user_id) VALUES($1,$2)', [params.id, u.id]);
  return NextResponse.json({ ok: true }, { status: 201 });
});
