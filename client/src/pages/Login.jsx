import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.js';

export default function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const body = mode === 'login' ? { email: form.email, password: form.password } : form;
      signIn(await api(`/auth/${mode}`, { method: 'POST', body }));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="center">
      <form className="card auth" onSubmit={submit}>
        <h1>🛡️ SecureScope</h1>
        <p className="muted">Continuous, passive security posture monitoring for the sites you own.</p>
        {mode === 'register' && <input placeholder="Name" value={form.name} onChange={set('name')} required />}
        <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required autoComplete="email" />
        <input type="password" placeholder="Password" value={form.password} onChange={set('password')} required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {mode === 'register' && <small className="muted">10+ characters with upper, lower case and a digit.</small>}
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
