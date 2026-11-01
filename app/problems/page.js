'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Difficulty bands match the 800..3000 scale used in the seed data.
const BANDS = [
  { label: 'Any difficulty', min: '', max: '' },
  { label: '800 to 1000', min: 800, max: 1000 },
  { label: '1100 to 1300', min: 1100, max: 1300 },
  { label: '1400 and above', min: 1400, max: '' },
];

export default function ProblemsPage() {
  const [q, setQ] = useState('');
  const [band, setBand] = useState(0);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  // Re-query the API shortly after the user stops typing.
  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set('q', q.trim());
      if (BANDS[band].min !== '') sp.set('min', BANDS[band].min);
      if (BANDS[band].max !== '') sp.set('max', BANDS[band].max);
      try {
        const r = await fetch('/api/problems?' + sp);
        if (!r.ok) throw new Error();
        setRows(await r.json()); setError('');
      } catch { setError('Could not load problems.'); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, band]);

  return (
    <main>
      <h1>Problems</h1>
      <div className="toolbar">
        <input placeholder="Search by title or statement…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={band} onChange={(e) => setBand(Number(e.target.value))}>
          {BANDS.map((b, i) => <option key={i} value={i}>{b.label}</option>)}
        </select>
      </div>

      {error && <div className="error">{error}</div>}
      {rows === null ? <p className="muted">Loading…</p> : rows.length === 0 ? (
        <p className="muted">No problems match.</p>
      ) : (
        <table>
          <thead><tr><th>#</th><th>Title</th><th>Difficulty</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.problem_id}>
                <td>{p.problem_id}</td>
                <td><Link href={`/problems/${p.problem_id}`}>{p.title}</Link></td>
                <td><span className="badge">{p.difficulty}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
