import { useState } from 'react';
import { api } from './api';

export default function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await (signup ? api.register : api.login)(email, password));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="mark">StudyTable</div>
        <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="sub">Your notes stay private to you.</p>
        <label>Email
          <input type="email" required autoFocus autoComplete="email"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Password
          <input type="password" required minLength={signup ? 8 : undefined}
                 autoComplete={signup ? 'new-password' : 'current-password'}
                 value={password} onChange={(e) => setPassword(e.target.value)} />
          {signup && <small>At least 8 characters</small>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'One moment…' : signup ? 'Create account' : 'Log in'}
        </button>
        <button type="button" className="link"
                onClick={() => { setMode(signup ? 'login' : 'signup'); setError(''); }}>
          {signup ? 'I already have an account' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
}
