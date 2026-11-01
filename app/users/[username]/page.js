'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const { username } = useParams();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${encodeURIComponent(username)}`).then(async (r) => {
      if (!r.ok) return setMissing(true);
      setP(await r.json());
    });
  }, [username]);

  if (missing) return <main><h1>User not found</h1><Link href="/leaderboard">Back to the leaderboard</Link></main>;
  if (!p) return <p className="muted">Loading…</p>;

  return (
    <main>
      <h1>{p.username}{p.role === 'admin' && <span className="muted" style={{ fontSize: 16 }}> (admin)</span>}</h1>
      <div className="meta">
        <span>Rating: <strong>{p.global_rating}</strong></span>
        <span>Rank: <strong>{p.global_rank ?? '-'}</strong></span>
        <span>Problems solved: <strong>{p.problems_solved}</strong></span>
        <span>Joined: <strong>{new Date(p.created_at).toLocaleDateString()}</strong></span>
      </div>

      <h3>Rating history</h3>
      {p.history.length === 0 ? (
        <div className="empty">No rated contests yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Contest</th><th className="num">Before</th><th className="num">After</th><th className="num">Change</th><th>Date</th></tr></thead>
            <tbody>
              {p.history.map((h) => (
                <tr key={h.contest_id}>
                  <td><Link href={`/contests/${h.contest_id}`}>{h.contest}</Link></td>
                  <td className="num">{h.old_rating}</td>
                  <td className="num">{h.new_rating}</td>
                  <td className="num" style={{ color: h.delta >= 0 ? 'var(--ok)' : 'var(--danger)', fontWeight: 600 }}>
                    {h.delta > 0 ? '+' : ''}{h.delta}
                  </td>
                  <td className="muted">{new Date(h.changed_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
