'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// datetime-local gives "2026-11-01T18:30" with no timezone, i.e. the admin's local time.
// new Date() reads it as local and toISOString() turns it into UTC, which is what postgres stores.
const toIso = (v) => new Date(v).toISOString();

export default function ContestForm() {
  const [all, setAll] = useState([]);          // every problem we could add
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [picked, setPicked] = useState([]);    // [{ problem_id, title, points }] in contest order
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  useEffect(() => {
    fetch('/api/problems').then((r) => (r.ok ? r.json() : [])).then(setAll).catch(() => {});
  }, []);

  const free = all.filter((p) => !picked.some((x) => x.problem_id === p.problem_id));

  function addProblem() {
    const p = all.find((x) => String(x.problem_id) === choice);
    if (!p) return;
    setPicked([...picked, { problem_id: p.problem_id, title: p.title, points: 100 }]);
    setChoice('');
  }

  const setPoints = (i, v) => setPicked(picked.map((x, j) => (j === i ? { ...x, points: v } : x)));

  async function submit(e) {
    e.preventDefault();
    setError(''); setCreated(null);
    if (new Date(end) <= new Date(start)) return setError('The contest has to end after it starts.');
    if (picked.length === 0) return setError('Pick at least one problem.');

    setBusy(true);
    try {
      const r = await fetch('/api/contests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          start_time: toIso(start),
          end_time: toIso(end),
          // the API numbers the problems by array position, so the order here is the contest order
          problems: picked.map((x) => ({ problem_id: x.problem_id, points: Number(x.points) })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Could not create the contest.');
      setCreated(data.contest_id);
      setName(''); setStart(''); setEnd(''); setPicked([]);
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <form className="form-wrap" onSubmit={submit}>
      <label htmlFor="c-name">Name</label>
      <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />

      <div className="form-row">
        <div>
          <label htmlFor="c-start">Starts</label>
          <input id="c-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="c-end">Ends</label>
          <input id="c-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>

      <h3>Problems</h3>
      {picked.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Problem</th><th className="num">Points</th><th /></tr></thead>
            <tbody>
              {picked.map((x, i) => (
                <tr key={x.problem_id}>
                  <td>{i + 1}</td>
                  <td>{x.title}</td>
                  <td className="num">
                    <input type="number" min="1" step="50" value={x.points} style={{ width: 90 }}
                           onChange={(e) => setPoints(i, e.target.value)} />
                  </td>
                  <td className="num">
                    <button type="button" className="link-btn" onClick={() => setPicked(picked.filter((_, j) => j !== i))}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="toolbar" style={{ marginTop: 12 }}>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} style={{ flex: 1 }}>
          <option value="">Choose a problem…</option>
          {free.map((p) => <option key={p.problem_id} value={p.problem_id}>{p.title} ({p.difficulty})</option>)}
        </select>
        <button type="button" className="btn btn-plain" onClick={addProblem} disabled={!choice}>Add</button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {created && <div className="success">Contest created. <Link href={`/contests/${created}`}>Open it</Link></div>}

      <div className="row-actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Create contest'}</button>
      </div>
    </form>
  );
}
