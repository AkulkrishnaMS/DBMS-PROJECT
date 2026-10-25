import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const key = () => new TextEncoder().encode(process.env.JWT_SECRET);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const signToken = (u) =>
  new SignJWT({ role: u.role, username: u.username })
    .setSubject(String(u.user_id)).setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h').sign(key());

export async function getUser() {
  const t = cookies().get('token')?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key());
    return { id: Number(payload.sub), role: payload.role, username: payload.username };
  } catch { return null; }
}

// role optional: requireUser() = any logged-in user, requireUser('admin') = admins only
export async function requireUser(role) {
  const u = await getUser();
  if (!u) throw new HttpError(401, 'Login required');
  if (role && u.role !== role) throw new HttpError(403, 'Forbidden');
  return u;
}
