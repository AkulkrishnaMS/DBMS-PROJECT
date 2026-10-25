import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const { username, password } = await req.json();
  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username || '']);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const res = NextResponse.json({ user_id: u.user_id, username: u.username, role: u.role });
  res.cookies.set('token', await signToken(u), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600, path: '/' });
  return res;
});
