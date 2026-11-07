import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Badge, Grade, SEVERITIES, when } from '../components/ui.jsx';

export default function Dashboard() {
  const [targets, setTargets] = useState(null);
  const [stats, setStats] = useState(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const load = () => Promise.all([api('/targets'), api('/stats')]).then(([t, s]) => { setTargets(t.targets); setStats(s); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    try { await api('/targets', { method: 'POST', body: { url } }); setUrl(''); load(); } catch (err) { setError(err.message); }
  }

  return (
    <>
      {stats && (
        <section className="stats">
          <div className="card stat"><b>{stats.targets}</b><span>Targets</span></div>
          <div className="card stat"><b>{stats.verified}</b><span>Verified</span></div>
          <div className="card stat"><b>{stats.averageScore ?? '—'}</b><span>Avg score</span></div>
          {SEVERITIES.slice(0, 4).map((s) => (
            <div key={s} className="card stat"><b>{stats.openFindings[s]}</b><span><Badge sev={s} /></span></div>
          ))}
        </section>
      )}

      <form className="card row" onSubmit={add}>
        <input placeholder="example.com or https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} required />
        <button className="btn">Add target</button>
      </form>
      <p className="muted small">You can only scan sites you own — you'll prove ownership after adding one.</p>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <table>
          <thead><tr><th>Target</th><th>Status</th><th>Grade</th><th>Last scan</th><th /></tr></thead>
          <tbody>
            {targets?.map((t) => (
              <tr key={t._id}>
                <td><Link to={`/targets/${t._id}`}>{t.url}</Link></td>
                <td>{t.verified ? <span className="pill ok">verified · {t.verifiedMethod}</span> : <span className="pill warn">unverified</span>}</td>
                <td><Grade grade={t.lastGrade} score={t.lastScore} size="sm" /></td>
                <td className="muted">{when(t.lastScanAt)}</td>
                <td><Link className="btn ghost" to={`/targets/${t._id}`}>Open</Link></td>
              </tr>
            ))}
            {targets?.length === 0 && <tr><td colSpan="5" className="muted">No targets yet. Add your first site above.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
