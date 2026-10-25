import { NextResponse } from 'next/server';
export const POST = async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('token', '', { maxAge: 0, path: '/' });
  return res;
};
