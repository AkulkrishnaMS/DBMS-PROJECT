'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DiffBadge from '../../components/DiffBadge';

const STARTERS = {
  python: '# read from input(), print the answer\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
};

export default function ProblemPage() {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(STARTERS.python);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [needLogin, setNeedLogin] = useState(false);
  const [contestId, setContestId] = useState(null); // set when opened from a contest page (?contest=ID)

  useEffect(() => {
    setContestId(new URLSearchParams(window.location.search).get('contest'));
    fetch(`/api/problems/${id}`).then(async (r) => {
      if (!r.ok) return setNotFound(true);
      setProblem(await r.json());
    });
    fetch(`/api/problems/${id}/similar?k=3`).then((r) => (r.ok ? r.json() : [])).then(setSimilar).catch(() => {});
  }, [id]);

  // Switching language swaps the starter code only if the editor still holds an untouched starter.
  function changeLanguage(next) {
    if (code === STARTERS[language]) setCode(STARTERS[next]);
    setLanguage(next);
  }

  // Tab key inserts spaces instead of moving focus out of the editor.
  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const { selectionStart: s, selectionEnd: en } = e.target;
    const next = code.slice(0, s) + '    ' + code.slice(en);
    setCode(next);
    requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 4; });
  }

  async function submit() {
    setBusy(true); setError(''); setResult(null); setNeedLogin(false);
    try {
      const r = await fetch('/api/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: Number(id), language, code,
                               contest_id: contestId ? Number(contestId) : undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) setNeedLogin(true);
      else if (!r.ok) setError(data.error || 'Submission failed');
      else setResult(data);
    } catch { setError('Could not reach the server.'); }
    setBusy(false);
  }

  if (notFound) return <main><h1>Problem not found</h1><Link href="/problems">Back to problems</Link></main>;
  if (!problem) return <p className="muted">Loading…</p>;

  const ok = result?.verdict === 'AC';

  return (
    <main>
      <p><Link href="/problems">← All problems</Link></p>
      <h1>{problem.title} <DiffBadge d={problem.difficulty} /></h1>
      <p className="muted">Time limit {problem.time_limit_ms} ms · Memory limit {Math.round(problem.memory_limit_kb / 1024)} MB</p>

      <div className="layout">
        <section>
          <div className="statement">{problem.statement}</div>

          <h3>Samples</h3>
          {problem.samples.length === 0 && <p className="muted">No samples.</p>}
          {problem.samples.map((s, i) => (
            <div className="sample" key={i}>
              <b>Input</b><pre>{s.input}</pre>
              <b>Output</b><pre>{s.expected_output}</pre>
            </div>
          ))}

          {similar.length > 0 && (
            <>
              <h3>Similar problems</h3>
              <ul>
                {similar.map((p) => (
                  <li key={p.problem_id}><Link href={`/problems/${p.problem_id}`}>{p.title}</Link>{' '}
                    <span className="muted">({p.difficulty})</span></li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          {contestId && <p className="notice">Submitting in <Link href={`/contests/${contestId}`}>contest #{contestId}</Link></p>}
          <div className="editor-bar">
            <select value={language} onChange={(e) => changeLanguage(e.target.value)}>
              <option value="python">Python 3</option>
              <option value="cpp">C++ (g++ 13)</option>
            </select>
            <button className="btn" onClick={submit} disabled={busy || !code.trim()}>
              {busy ? 'Judging…' : 'Submit'}
            </button>
          </div>
          <textarea className="code" spellCheck={false} value={code}
                    onChange={(e) => setCode(e.target.value)} onKeyDown={onKeyDown} />

          {needLogin && <div className="error">Please <Link href="/login">log in</Link> to submit.</div>}
          {error && <div className="error" role="alert">{error}</div>}

          {result && (
            <div className={'verdict ' + (ok ? 'ok' : 'fail')}>
              <div className="big">{result.verdict}</div>
              <div className="muted">
                {result.runtime_ms} ms · submission <Link href={`/submissions/${result.submission_id}`}>#{result.submission_id}</Link>
              </div>
              {result.cases.length > 0 && (
                <div className="cases">
                  {result.cases.map((c) => <span key={c.case_idx} className={'case v-' + c.verdict}>Test {c.case_idx + 1}: {c.verdict}</span>)}
                </div>
              )}
              {result.compile_output && <div className="compile">{result.compile_output}</div>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
