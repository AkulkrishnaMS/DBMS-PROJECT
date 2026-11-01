'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProblemForm from './ProblemForm';
import ContestForm from './ContestForm';
import FinalizeForm from './FinalizeForm';

// Admin hub. Three tabs, each one just calls an API route Akul already wrote.
// The routes check the admin role themselves; the check here only decides what to show.
const TABS = [
  { key: 'problem', label: 'New problem' },
  { key: 'contest', label: 'New contest' },
  { key: 'finalize', label: 'Finalize contest' },
];

export default function AdminPage() {
  const [me, setMe] = useState(undefined); // undefined = still asking, null = not logged in
  const [tab, setTab] = useState('problem');

  useEffect(() => {
    fetch('/api/me').then((r) => (r.ok ? r.json() : null)).then(setMe).catch(() => setMe(null));
  }, []);

  if (me === undefined) return <p className="muted">Loading…</p>;
  if (me === null) return <main><h1>Admin</h1><p>Please <Link href="/login">log in</Link> first.</p></main>;
  if (me.role !== 'admin') return <main><h1>Admin</h1><p className="muted">This area is for admins only.</p></main>;

  return (
    <main>
      <h1>Admin</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'problem' && <ProblemForm />}
      {tab === 'contest' && <ContestForm />}
      {tab === 'finalize' && <FinalizeForm />}
    </main>
  );
}
