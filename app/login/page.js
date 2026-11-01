'use client';
import { useState } from 'react';

// One page for both login and register. Register logs you in right after.
export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function post(url, body) {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'register') {
        await post('/api/auth/register', form);
      }
      await post('/api/auth/login', { username: form.username, password: form.password });
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const isRegister = mode === 'register';

  return (
    <div className="card">
      <h1>{isRegister ? 'Create an account' : 'Log in'}</h1>
      <form onSubmit={submit}>
        <label htmlFor="username">Username</label>
        <input id="username" value={form.username} onChange={set('username')} required autoFocus />

        {isRegister && (
          <>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} onChange={set('email')} required />
          </>
        )}

        <label htmlFor="password">Password{isRegister ? ' (min 8 characters)' : ''}</label>
        <input id="password" type="password" value={form.password} onChange={set('password')}
               required minLength={isRegister ? 8 : undefined} />

        {error && <div className="error" role="alert">{error}</div>}

        <button className="btn btn-wide" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Register' : 'Log in'}
        </button>
      </form>

      <p className="switch">
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <button className="link-btn" type="button"
                onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}>
          {isRegister ? 'Log in' : 'Create an account'}
        </button>
      </p>
    </div>
  );
}
