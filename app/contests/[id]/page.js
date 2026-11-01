'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Phase from '../../components/Phase';
import DiffBadge from '../../components/DiffBadge';

const fmt = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function ContestPage() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [me, setMe] = useState(null);
  const [standings, setStandings] = useState([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/contests/${id}`);
    if (!r.ok) return setMissing(true);
    setC(await r.json());
    const s = await fetch(`/api/contests/${id}/standings`);
    if (s.ok) setStandings(await s.json());
  }, [id]);

  useEffect(() => {
    load();
    fetch('/api/me').then((r) => (r.ok ? r.json() : null)).then(setMe).catch(() => {});
  }, [load]);

  async function register() {
    setBusy(true); setError('');
    const r = await fetch(`/api/contests/${id}/register`, { method: 'POST' });
    if (r.ok || r.status === 409) await load();
    else {
      const d = await r.json().catch(() => ({}));
      setError(d.error || 'Could not register.');
    }
    setBusy(false);
  }

  if (missing) return <main><h1>Contest not found</h1><Link href="/contests">Back to contests</Link></main>;
  if (!c) return <p className="muted">Loading…</p>;

  const open = c.phase === 'upcoming' || c.phase === 'running';

  return (
    <main>
      <p><Link href="/contests">← All contests</Link></p>
      <h1>{c.name} <Phase p={c.phase} /></h1>
      <div className="meta">
        <span>Starts: <strong>{fmt(c.start_time)}</strong></span>
        <span>Ends: <strong>{fmt(c.end_time)}</strong></span>
        <span>Organizer: <strong>{c.organizer}</strong></span>
        <span>Registered: <strong>{c.registered}</strong></span>
      </div>

      {me && c.is_registered && <div className="notice" style={{ borderLeftColor: 'var(--ok)' }}>You are registered for this contest.</div>}
      {me && !c.is_registered && open && (
        <p><button className="btn" onClick={register} disabled={busy}>{busy ? 'Registering…' : 'Register'}</button></p>
      )}
      {!me && open && <p className="muted"><Link href="/login">Log in</Link> to register.</p>}
      {error && <div className="error">{error}</div>}

      <h3>Problems</h3>
      {c.phase === 'upcoming' ? (
        <div className="notice">Problems are shown once the contest starts.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Title</th><th>Difficulty</th><th className="num">Points</th></tr></thead>
            <tbody>
              {c.problems.map((p) => (
                <tr key={p.problem_id}>
                  <td>{p.position}</td>
                  <td><Link href={`/problems/${p.problem_id}?contest=${c.contest_id}`}>{p.title}</Link></td>
                  <td><DiffBadge d={p.difficulty} /></td>
                  <td className="num">{p.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-head">
        <h3>Standings</h3>
        <button className="btn btn-plain" onClick={load}>Refresh</button>
      </div>
      {standings.length === 0 ? (
        <div className="empty">No accepted solutions yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rank</th><th>User</th><th className="num">Solved</th><th className="num">Score</th><th className="num">Penalty (min)</th></tr></thead>
            <tbody>
              {standings.map((r) => (
                <tr key={r.username} className={me && me.username === r.username ? 'me-row' : ''}>
                  <td>{r.standing}</td>
                  <td>{r.username}</td>
                  <td className="num">{r.solved}</td>
                  <td className="num">{r.score}</td>
                  <td className="num">{r.penalty_min}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {c.phase === 'finished' && c.ratings_applied && <p className="muted">Ratings for this contest have been applied.</p>}
    </main>
  );
}
