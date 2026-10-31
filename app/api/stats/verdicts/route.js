import { NextResponse } from 'next/server';
import { mongo } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Admin dashboard data: how often each verdict occurs over all test-case runs (MongoDB aggregation).
export const GET = handle(async () => {
  await requireUser('admin');
  const db = await mongo();
  const rows = await db.collection('execution_logs').aggregate([
    { $unwind: '$per_case' },
    { $group: { _id: '$per_case.verdict', runs: { $sum: 1 },
                avg_ms: { $avg: '$per_case.time_ms' }, max_ms: { $max: '$per_case.time_ms' } } },
    { $sort: { runs: -1 } },
  ]).toArray();
  return NextResponse.json(rows.map((r) => ({
    verdict: r._id, runs: r.runs, avg_ms: Math.round(r.avg_ms), max_ms: r.max_ms })));
});
