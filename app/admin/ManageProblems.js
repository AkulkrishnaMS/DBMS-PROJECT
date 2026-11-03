'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DiffBadge from '../components/DiffBadge';

// UPDATE and DELETE for problems.
//   Edit   -> PATCH  /api/problems/:id  (title, difficulty, time limit, statement; test cases stay)
//   Delete -> DELETE /api/problems/:id  (Postgres refuses with ON DELETE RESTRICT if the problem
//                                        has submissions or is in a contest; we show its message)
export default function ManageProblems() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);   // the problem being edited, or null
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);           // { ok: bool, text: string }

  const load = useCallback(() => {
    fetch('/api/problems').then((r) => (r.ok ? r.json() : [])).then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  async function startEdit(id) {
    setMsg(null);
    const r = await fetch(`/api/problems/${id}`);
    if (!r.ok) return setMsg({ ok: false, text: 'Could not load the problem.' });
    const p = await r.json();
    setEditing({ problem_id: p.problem_id, title: p.title, statement: p.statement,
                 difficulty: p.difficulty, time_limit_ms: p.time_limit_ms });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/problems/${editing.problem_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editing.title.trim(),
        statement: editing.statement,
        difficulty: Number(editing.difficulty),
        time_limit_ms: Number(editing.time_limit_ms),
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      setMsg({ ok: true, text: `Saved "${data.title}".` +
        (data.needs_embedding ? ' The text changed, so run `npm run embed` to refresh similar problems.' : '') });
      setEditing(null);
      load();
    } else setMsg({ ok: false, text: data.error || 'Could not save.' });
    setBusy(false);
  }

  async function remove(p) {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/problems/${p.problem_id}`, { method: 'DELETE' });
    const data = await r.json().catch(() => ({}));
    if (r.ok) { setMsg({ ok: true, text: `Deleted "${p.title}".` }); load(); }
    else setMsg({ ok: false, text: data.error || 'Could not delete.' });
    setBusy(false);
  }

  const set = (field, value) => setEditing({ ...editing, [field]: value });

  if (rows === null) return <p className="muted">Loading…</p>;

  if (editing) return (
    <form className="form-wrap" onSubmit={save}>
      <h3>Edit problem #{editing.problem_id}</h3>
      <label htmlFor="e-title">Title</label>
      <input id="e-title" value={editing.title} onChange={(e) => set('title', e.target.value)} required />

      <div className="form-row">
        <div>
          <label htmlFor="e-diff">Difficulty (800 to 3500)</label>
          <input id="e-diff" type="number" min="800" max="3500" step="100" value={editing.difficulty}
                 onChange={(e) => set('difficulty', e.target.value)} required />
        </div>
        <div>
          <label htmlFor="e-time">Time limit (ms)</label>
          <input id="e-time" type="number" min="100" max="10000" step="100" value={editing.time_limit_ms}
                 onChange={(e) => set('time_limit_ms', e.target.value)} required />
        </div>
      </div>

      <label htmlFor="e-stmt">Statement</label>
      <textarea id="e-stmt" className="field" rows={8} value={editing.statement}
                onChange={(e) => set('statement', e.target.value)} required />
      <p className="muted">Test cases are not changed here.</p>

      {msg && !msg.ok && <div className="error" role="status">{msg.text}</div>}
      <p style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className="btn btn-plain" onClick={() => { setEditing(null); setMsg(null); }}>Cancel</button>
      </p>
    </form>
  );

  return (
    <div>
      {msg && <div className={msg.ok ? 'success' : 'error'} role="status" style={{ marginBottom: 12 }}>{msg.text}</div>}
      {rows.length === 0 ? <div className="empty">No problems yet.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Title</th><th>Difficulty</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.problem_id}>
                  <td>{p.problem_id}</td>
                  <td><Link href={`/problems/${p.problem_id}`}>{p.title}</Link></td>
                  <td><DiffBadge d={p.difficulty} /></td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-plain" onClick={() => startEdit(p.problem_id)} disabled={busy}>Edit</button>{' '}
                    <button className="btn btn-plain btn-danger" onClick={() => remove(p)} disabled={busy}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">A problem that has submissions or is part of a contest cannot be deleted. The database refuses it (ON DELETE RESTRICT), so history stays complete.</p>
    </div>
  );
}
