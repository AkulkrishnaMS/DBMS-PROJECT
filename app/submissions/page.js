'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Verdict from '../components/Verdict';

export default function SubmissionsPage() {
  const [rows, setRows] = useState(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    fetch('/api/submissions').then(async (r) => {
      if (r.status === 401) return setNeedLogin(true);
      setRows(r.ok ? await r.json() : []);
    });
  }, []);

  if (needLogin) return <main><h1>My submissions</h1><p>Please <Link href="/login">log in</Link> to see your submissions.</p></main>;

  return (
    <main>
      <h1>My submissions</h1>
      {rows === null ? <p className="muted">Loading…</p> : rows.length === 0 ? (
        <div className="empty">Nothing submitted yet. <Link href="/problems">Pick a problem</Link>.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Problem</th><th>Language</th><th>Verdict</th><th>Time</th><th>Submitted</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.submission_id}>
                  <td><Link href={`/submissions/${s.submission_id}`}>{s.submission_id}</Link></td>
                  <td>{s.title}</td>
                  <td>{s.language === 'cpp' ? 'C++' : 'Python'}</td>
                  <td><Verdict v={s.verdict} /></td>
                  <td>{s.runtime_ms != null ? `${s.runtime_ms} ms` : '-'}</td>
                  <td className="muted">{new Date(s.submitted_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
