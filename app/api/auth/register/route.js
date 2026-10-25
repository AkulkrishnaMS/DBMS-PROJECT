import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { handle, bad } from '@/lib/http';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const { username, email, password } = await req.json();
  if (!username || !email || !password) throw bad('username, email, password required');
  if (password.length < 8) throw bad('Password must be at least 8 characters');
  const hash = await bcrypt.hash(password, 10);
  // role is always 'contestant' here; admins are created with `npm run create-admin`
  const { rows } = await pool.query(
    `INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING user_id, username, role`,
    [username, email, hash]);
  return NextResponse.json(rows[0], { status: 201 });
});
