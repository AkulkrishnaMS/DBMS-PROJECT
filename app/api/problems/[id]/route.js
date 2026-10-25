import { NextResponse } from 'next/server';
import { pool, mongo } from '@/lib/db';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

export const GET = handle(async (_req, { params }) => {
  const { rows } = await pool.query(
    `SELECT problem_id, title, statement, difficulty, time_limit_ms, memory_limit_kb FROM problems WHERE problem_id=$1`, [params.id]);
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const doc = await (await mongo()).collection('test_cases').findOne({ problem_id: rows[0].problem_id });
  return NextResponse.json({ ...rows[0], samples: (doc?.cases || []).filter((c) => c.is_sample) }); // hidden cases never leave the server
});
