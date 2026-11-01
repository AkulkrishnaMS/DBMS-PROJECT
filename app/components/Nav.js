'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

// Top bar. Asks /api/me who is logged in (401 = nobody) and shows the matching links.
export default function Nav() {
  const [user, setUser] = useState(undefined); // undefined = still loading, null = logged out
  const path = usePathname();

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

  const link = (href, label) => (
    <Link href={href} className={path === href || path.startsWith(href + '/') ? 'active' : ''}>{label}</Link>
  );

  return (
    <header className="nav">
      <nav className="nav-inner">
        <Link href="/" className="brand">CP Judge</Link>
        <div className="nav-links">
          {link('/problems', 'Problems')}
          {link('/contests', 'Contests')}
          {link('/leaderboard', 'Leaderboard')}
          {user && link('/submissions', 'My submissions')}
          {user && user.role === 'admin' && link('/admin', 'Admin')}
        </div>
        <div className="nav-user">
          {user && (
            <>
              <span><Link href={`/users/${user.username}`}><strong>{user.username}</strong></Link>{user.role === 'admin' ? ' (admin)' : ''} · {user.global_rating}</span>
              <button className="btn btn-plain" onClick={logout}>Log out</button>
            </>
          )}
          {user === null && <Link href="/login" className="btn">Log in</Link>}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
