'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Verdict from '../../components/Verdict';

export default function SubmissionPage() {
  const { id } = useParams();
  const [s, setS] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | login | missing

  useEffect(() => {
    fetch(`/api/submissions/${id}`).then(async (r) => {
      if (r.status === 401) return setState('login');
      if (!r.ok) return setState('missing');
      setS(await r.json()); setState('ok');
    });
  }, [id]);

  if (state === 'loading') return <p className="muted">Loading…</p>;
  if (state === 'login') return <main><h1>Submission #{id}</h1><p>Please <Link href="/login">log in</Link> to view this.</p></main>;
  if (state === 'missing') return <main><h1>Submission not found</h1><p className="muted">It may not exist, or it belongs to someone else.</p><Link href="/submissions">Back to my submissions</Link></main>;

  const cases = s.log?.per_case || [];

  return (
    <main>
      <p><Link href="/submissions">← My submissions</Link></p>
      <h1>Submission #{s.submission_id}</h1>
      <div className="meta">
        <span>Problem: <strong><Link href={`/problems/${s.problem_id}`}>{s.title}</Link></strong></span>
        <span>Language: <strong>{s.language === 'cpp' ? 'C++' : 'Python'}</strong></span>
        <span>Verdict: <Verdict v={s.verdict} /></span>
        <span>Time: <strong>{s.runtime_ms != null ? `${s.runtime_ms} ms` : '-'}</strong></span>
        <span>Submitted: <strong>{new Date(s.submitted_at).toLocaleString()}</strong></span>
        {s.contest_id && <span>Contest: <strong><Link href={`/contests/${s.contest_id}`}>#{s.contest_id}</Link></strong></span>}
      </div>

      {s.log?.compile_output && (
        <>
          <h3>Compiler output</h3>
          <pre className="codeblock" style={{ color: 'var(--danger)' }}>{s.log.compile_output}</pre>
        </>
      )}

      {cases.length > 0 && (
        <>
          <h3>Test cases</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Test</th><th>Verdict</th><th>Time</th><th>Your output</th></tr></thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.case_idx}>
                    <td>{c.case_idx + 1}</td>
                    <td><Verdict v={c.verdict} /></td>
                    <td>{c.time_ms} ms</td>
                    <td className="mono">{(c.stdout || c.stderr || '').trim() || '(empty)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>Code</h3>
      <pre className="codeblock">{s.code}</pre>
    </main>
  );
}
