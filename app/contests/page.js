'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Phase from '../components/Phase';

const fmt = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function ContestsPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/contests')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setRows)
      .catch(() => setError('Could not load contests.'));
  }, []);

  return (
    <main>
      <h1>Contests</h1>
      {error && <div className="error">{error}</div>}
      {rows === null && !error ? <p className="muted">Loading…</p> : rows && rows.length === 0 ? (
        <div className="empty">No contests yet.</div>
      ) : rows && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>State</th><th>Starts</th><th>Ends</th><th className="num">Problems</th><th className="num">Registered</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.contest_id}>
                  <td><Link href={`/contests/${c.contest_id}`}>{c.name}</Link></td>
                  <td><Phase p={c.phase} /></td>
                  <td className="muted">{fmt(c.start_time)}</td>
                  <td className="muted">{fmt(c.end_time)}</td>
                  <td className="num">{c.problems}</td>
                  <td className="num">{c.registered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
