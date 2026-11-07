import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import { Icon, Logo } from '../components/ui.jsx';

const FEATURES = [
  ['scan', 'Passive, safe checks', 'Headers, cookies, TLS and exposed files. No payloads, no exploitation.'],
  ['key', 'Ownership verified', 'Only scan domains you can prove you control.'],
  ['refresh', 'Continuous monitoring', 'Scheduled re-scans and score history catch regressions early.'],
];

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
    <div className="auth-page">
      <section className="auth-hero">
        <div className="hero-brand"><Logo size={38} /><b>SecureScope</b></div>
        <div className="hero-copy">
          <span className="eyebrow"><Icon name="bolt" size={14} /> Web security, simplified</span>
          <h1>Know your security posture <em>before attackers do.</em></h1>
          <p>Continuous, passive monitoring for the sites you own — scored, explained and tracked over time.</p>
          <ul>
            {FEATURES.map(([icon, t, d]) => (
              <li key={t}><span><Icon name={icon} size={18} /></span><div><b>{t}</b><small>{d}</small></div></li>
            ))}
          </ul>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="hc-top"><span>shop.example.com</span><i>Verified</i></div>
          <div className="hc-main">
            <div className="hc-ring"><b>92</b><small>Grade A</small></div>
            <div className="hc-rows">
              <p><i className="s-crit" />0 critical</p><p><i className="s-med" />2 medium</p><p><i className="s-low" />3 low</p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">{mode === 'login' ? 'Sign in to view your security dashboard.' : 'Start monitoring your sites in minutes.'}</p>

          {mode === 'register' && (
            <label className="field"><span>Full name</span>
              <input placeholder="Ada Lovelace" value={form.name} onChange={set('name')} required autoComplete="name" /></label>
          )}
          <label className="field"><span>Email</span>
            <input type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
          <label className="field"><span>Password</span>
            <input type="password" placeholder="••••••••••" value={form.password} onChange={set('password')} required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'register' && <small>At least 10 characters with upper case, lower case and a number.</small>}
          </label>

          {error && <div className="alert-box"><Icon name="alert" size={17} />{error}</div>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>

          <p className="switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
          <div className="secure-note"><Icon name="lock" size={14} />Protected by rotating httpOnly sessions, rate limiting and account lockout.</div>
        </form>
      </section>
    </div>
  );
}
