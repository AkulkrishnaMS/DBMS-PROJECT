'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Top bar. Asks /api/me who is logged in (401 = nobody) and shows the matching links.
export default function Nav() {
  const [user, setUser] = useState(undefined); // undefined = still loading, null = logged out

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';   // full reload so every page forgets the old user
  }

  return (
    <header className="nav">
      <nav className="nav-inner">
        <Link href="/" className="brand">CP Judge</Link>
        <div className="nav-links">
          <Link href="/problems">Problems</Link>
          <Link href="/contests">Contests</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          {user && <Link href="/submissions">My submissions</Link>}
        </div>
        <div className="nav-user">
          {user === undefined ? null : user ? (
            <>
              <span>{user.username}{user.role === 'admin' ? ' (admin)' : ''} · {user.global_rating}</span>
              <button className="btn btn-plain" onClick={logout}>Log out</button>
            </>
          ) : (
            <Link href="/login">Log in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
