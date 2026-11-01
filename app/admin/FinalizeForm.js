'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Phase from '../components/Phase';

// Finalizing runs finalize_contest() in postgres: ratings, contest status and (through a trigger)
// everyone's global rank, all in one transaction. It refuses contests that haven't ended or
// were already finalized, so the button is only live for the "ended" ones.
export default function FinalizeForm() {
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);   // { ok: bool, text: string }

  const load = useCallback(() => {
    fetch('/api/contests').then((r) => (r.ok ? r.json() : [])).then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  async function finalize(c) {
    if (!window.confirm(`Finalize "${c.name}"? Ratings will be applied and this cannot be undone.`)) return;
    setBusyId(c.contest_id); setMsg(null);
    const r = await fetch(`/api/contests/${c.contest_id}/finalize`, { method: 'POST' });
    const data = await r.json().catch(() => ({}));
    if (r.ok) setMsg({ ok: true, text: `Done. ${data.users_rated} user(s) rated.` });
    else setMsg({ ok: false, text: data.error || 'Could not finalize.' });
    setBusyId(null);
    load();
  }

  if (rows === null) return <p className="muted">Loading…</p>;
  if (rows.length === 0) return <div className="empty">No contests yet.</div>;

  return (
    <div>
      {msg && <div className={msg.ok ? 'success' : 'error'} role="status" style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Contest</th><th>State</th><th className="num">Registered</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.contest_id}>
                <td><Link href={`/contests/${c.contest_id}`}>{c.name}</Link></td>
                <td><Phase p={c.phase} /></td>
                <td className="num">{c.registered}</td>
                <td className="num">
                  {c.phase === 'ended' ? (
                    <button className="btn" onClick={() => finalize(c)} disabled={busyId === c.contest_id}>
                      {busyId === c.contest_id ? 'Working…' : 'Finalize'}
                    </button>
                  ) : (
                    <span className="muted">{c.phase === 'finished' ? 'Already finalized' : 'Not ended yet'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
