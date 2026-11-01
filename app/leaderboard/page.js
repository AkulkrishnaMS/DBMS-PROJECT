'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [rows, setRows] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/leaderboard?limit=100')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setRows)
      .catch(() => setError('Could not load the leaderboard.'));
    fetch('/api/me').then((r) => (r.ok ? r.json() : null)).then(setMe).catch(() => {});
  }, []);

  return (
    <main>
      <h1>Leaderboard</h1>
      <p className="muted">Contestants ranked by rating. Ratings change when a contest is finalized.</p>
      {error && <div className="error">{error}</div>}
      {rows === null && !error ? <p className="muted">Loading…</p> : rows && rows.length === 0 ? (
        <div className="empty">No contestants yet.</div>
      ) : rows && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>User</th><th className="num">Rating</th><th className="num">Contests</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id} className={me && me.user_id === u.user_id ? 'me-row' : ''}>
                  <td>{u.position}</td>
                  <td><Link href={`/users/${u.username}`}>{u.username}</Link></td>
                  <td className="num">{u.global_rating}</td>
                  <td className="num">{u.contests_played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
