'use client';
import { useState } from 'react';
import Link from 'next/link';

// start with one sample case so the form is never empty
const blankCase = (sample = false) => ({ input: '', expected_output: '', is_sample: sample });

// the judge compares output line by line and the seed data always ends with a newline,
// so add one if the admin forgot it
const withNewline = (s) => (s.endsWith('\n') ? s : s + '\n');

export default function ProblemForm() {
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState(800);
  const [timeLimit, setTimeLimit] = useState(2000);
  const [statement, setStatement] = useState('');
  const [cases, setCases] = useState([blankCase(true)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const setCase = (i, field, value) =>
    setCases(cases.map((c, j) => (j === i ? { ...c, [field]: value } : c)));

  async function submit(e) {
    e.preventDefault();
    setError(''); setCreated(null);

    // the API only needs one case, but a problem with no hidden case is useless for judging
    if (cases.length < 2) return setError('Add at least two test cases (one sample, one hidden).');
    if (!cases.some((c) => c.is_sample)) return setError('Mark at least one case as a sample.');

    setBusy(true);
    try {
      const r = await fetch('/api/problems', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          statement,
          difficulty: Number(difficulty),
          time_limit_ms: Number(timeLimit),
          cases: cases.map((c) => ({ ...c, input: withNewline(c.input), expected_output: withNewline(c.expected_output) })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Could not create the problem.');
      setCreated(data.problem_id);
      // clear the form for the next one
      setTitle(''); setStatement(''); setCases([blankCase(true)]);
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <form className="form-wrap" onSubmit={submit}>
      <label htmlFor="p-title">Title</label>
      <input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} required />

      <div className="form-row">
        <div>
          <label htmlFor="p-diff">Difficulty (800 to 3500)</label>
          <input id="p-diff" type="number" min="800" max="3500" step="100" value={difficulty}
                 onChange={(e) => setDifficulty(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p-time">Time limit (ms)</label>
          <input id="p-time" type="number" min="100" max="10000" step="100" value={timeLimit}
                 onChange={(e) => setTimeLimit(e.target.value)} required />
        </div>
      </div>

      <label htmlFor="p-stmt">Statement</label>
      <textarea id="p-stmt" className="field" rows={8} value={statement}
                onChange={(e) => setStatement(e.target.value)} required
                placeholder={'What to solve.\n\nInput: ...\nOutput: ...'} />

      <h3>Test cases</h3>
      {cases.map((c, i) => (
        <div className="case-box" key={i}>
          <div className="case-head">
            <strong>Case {i + 1}</strong>
            <span>
              <label className="check">
                <input type="checkbox" checked={c.is_sample} onChange={(e) => setCase(i, 'is_sample', e.target.checked)} />
                Show as sample
              </label>{' '}
              {cases.length > 1 && (
                <button type="button" className="link-btn" onClick={() => setCases(cases.filter((_, j) => j !== i))}>Remove</button>
              )}
            </span>
          </div>
          <div className="form-row">
            <div>
              <label>Input</label>
              <textarea className="field mono" rows={3} value={c.input} onChange={(e) => setCase(i, 'input', e.target.value)} required />
            </div>
            <div>
              <label>Expected output</label>
              <textarea className="field mono" rows={3} value={c.expected_output} onChange={(e) => setCase(i, 'expected_output', e.target.value)} required />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-plain" onClick={() => setCases([...cases, blankCase()])}>+ Add case</button>

      {error && <div className="error" role="alert">{error}</div>}
      {created && <div className="success">Problem created. <Link href={`/problems/${created}`}>Open it</Link></div>}

      <div className="row-actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Create problem'}</button>
      </div>
    </form>
  );
}
