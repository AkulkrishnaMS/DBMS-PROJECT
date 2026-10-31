import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

// GET /api/problems/5/similar?k=5  ->  the k problems whose embeddings are closest (cosine similarity) to problem 5
export const GET = handle(async (req, { params }) => {
  const k = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('k'), 10) || 5, 1), 20);
  const { rows } = await pool.query('SELECT * FROM find_similar_problems($1::int, $2::int)', [params.id, k]);
  return NextResponse.json(rows.map((r) => ({ ...r, similarity: Number(r.similarity.toFixed(3)) })));
});
