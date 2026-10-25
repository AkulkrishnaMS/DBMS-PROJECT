import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Calls the transactional stored function: ratings + status + (trigger) global ranks, all or nothing.
export const POST = handle(async (_req, { params }) => {
  await requireUser('admin');
  try {
    const { rows } = await pool.query('SELECT finalize_contest($1) AS rated', [params.id]);
    return NextResponse.json({ users_rated: rows[0].rated });
  } catch (e) {
    if (e.code === 'P0001') return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
});
