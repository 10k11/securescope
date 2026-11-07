import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Empty, Grade, Icon, PageHeader, SeverityBar, ago } from '../components/ui.jsx';

function Stat({ icon, tone, label, value, hint }) {
  return (
    <div className="stat">
      <span className={`stat-icon ${tone}`}><Icon name={icon} size={20} /></span>
      <div><small>{label}</small><b>{value}</b>{hint && <em>{hint}</em>}</div>
    </div>
  );
}

export default function Dashboard() {
  const [targets, setTargets] = useState(null);
  const [stats, setStats] = useState(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([api('/targets'), api('/stats')])
    .then(([t, s]) => { setTargets(t.targets); setStats(s); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await api('/targets', { method: 'POST', body: { url } }); setUrl(''); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const f = stats?.openFindings;
  return (
    <>
      <PageHeader title="Targets" subtitle="Websites you monitor, their security grade and latest scan." />

      <section className="stats">
        <Stat icon="globe" tone="indigo" label="Targets" value={stats?.targets ?? '–'} hint={stats ? `${stats.verified} verified` : ''} />
        <Stat icon="shield" tone="green" label="Average score" value={stats?.averageScore ?? '–'} hint="across scanned targets" />
        <Stat icon="alert" tone="red" label="Critical & high" value={f ? f.critical + f.high : '–'} hint="open findings" />
        <Stat icon="clock" tone="amber" label="Medium & low" value={f ? f.medium + f.low : '–'} hint="open findings" />
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Findings by severity</h3><small>Latest scan of every target</small></div>
        <SeverityBar counts={f} />
      </section>

      <section className="panel add-panel">
        <form onSubmit={add}>
          <div className="input-icon">
            <Icon name="globe" size={18} />
            <input placeholder="Add a website — example.com" value={url} onChange={(e) => setUrl(e.target.value)} required />
          </div>
          <button className="btn primary" disabled={busy}><Icon name="plus" size={17} />{busy ? 'Adding…' : 'Add target'}</button>
        </form>
        {error && <div className="alert-box"><Icon name="alert" size={17} />{error}</div>}
      </section>

      <section className="panel flush">
        <div className="panel-head pad"><h3>Your websites</h3><small>{targets?.length ?? 0} total</small></div>
        {targets && targets.length === 0 ? (
          <Empty icon="globe" title="No websites yet" text="Add your first site above. You'll verify ownership, then run your first scan." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Website</th><th>Status</th><th>Grade</th><th>Auto-scan</th><th>Last scan</th><th /></tr></thead>
              <tbody>
                {targets?.map((t) => (
                  <tr key={t._id}>
                    <td><Link to={`/targets/${t._id}`} className="site"><span className="favicon">{t.hostname[0].toUpperCase()}</span><div><b>{t.hostname}</b><small>{t.url}</small></div></Link></td>
                    <td>{t.verified
                      ? <span className="pill ok"><Icon name="checkCircle" size={14} />Verified</span>
                      : <span className="pill warn"><Icon name="alert" size={14} />Needs verification</span>}</td>
                    <td><Grade grade={t.lastGrade} score={t.lastScore} /></td>
                    <td className="muted">{t.scanIntervalHours ? `Every ${t.scanIntervalHours >= 24 ? `${t.scanIntervalHours / 24}d` : `${t.scanIntervalHours}h`}` : 'Off'}</td>
                    <td className="muted">{ago(t.lastScanAt)}</td>
                    <td className="right"><Link to={`/targets/${t._id}`} className="btn subtle sm">Open<Icon name="arrow" size={15} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!targets && <p className="muted pad">Loading…</p>}
      </section>
    </>
  );
}
