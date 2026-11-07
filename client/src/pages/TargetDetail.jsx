import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Badge, Grade, SEVERITIES, TrendChart, when } from '../components/ui.jsx';

function Verification({ target, onVerified }) {
  const v = target.verification;
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true); setMsg('');
    try { onVerified((await api(`/targets/${target._id}/verify`, { method: 'POST' })).target); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="card">
      <h3>Prove you own {target.hostname}</h3>
      <p className="muted">Scanning is disabled until ownership is verified. Use <b>any one</b> of these:</p>
      <ol>
        <li>DNS <code>{v.dns.type}</code> record on <code>{v.dns.host}</code> with value <code>{v.dns.value}</code></li>
        <li>Serve <code>{v.file.content}</code> at <code>{v.file.path}</code></li>
        <li>Add to your homepage <code>&lt;head&gt;</code>: <code>{v.meta.tag}</code></li>
      </ol>
      <button className="btn" onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Verify now'}</button>
      {msg && <div className="error">{msg}</div>}
    </div>
  );
}

function Findings({ scan }) {
  if (!scan) return null;
  if (scan.status === 'running') return <div className="card muted">Scanning…</div>;
  if (scan.status === 'failed') return <div className="card error">Scan failed: {scan.error}</div>;
  return (
    <div className="card">
      <h3>Findings ({scan.findings.length})</h3>
      {scan.findings.length === 0 && <p>🎉 No issues found.</p>}
      {SEVERITIES.flatMap((s) => scan.findings.filter((f) => f.severity === s)).map((f) => (
        <details key={f.id} className="finding">
          <summary><Badge sev={f.severity} /> {f.title} <span className="muted small">· {f.category}</span></summary>
          <p>{f.description}</p>
          {f.evidence && <p className="small"><b>Evidence:</b> <code>{f.evidence}</code></p>}
          <p className="fix"><b>Fix:</b> {f.remediation}</p>
        </details>
      ))}
    </div>
  );
}

export default function TargetDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [target, setTarget] = useState(null);
  const [scans, setScans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef();

  const loadScans = useCallback(async () => {
    const { scans: list } = await api(`/targets/${id}/scans`);
    setScans(list);
    return list;
  }, [id]);

  const open = useCallback(async (scanId) => {
    const { scan } = await api(`/scans/${scanId}`);
    setCurrent(scan);
    return scan;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setTarget((await api(`/targets/${id}`)).target);
        const list = await loadScans();
        if (list[0]) open(list[0]._id);
      } catch (e) { setError(e.message); }
    })();
    return () => clearTimeout(timer.current);
  }, [id, loadScans, open]);

  function poll(scanId) {
    timer.current = setTimeout(async () => {
      const s = await open(scanId).catch(() => null);
      if (s?.status === 'running') poll(scanId);
      else { loadScans(); api(`/targets/${id}`).then((d) => setTarget(d.target)); }
    }, 1500);
  }

  async function scan() {
    setError('');
    try {
      const { scan: s } = await api(`/targets/${id}/scan`, { method: 'POST' });
      setCurrent(s); poll(s._id);
    } catch (e) { setError(e.message); }
  }

  async function setInterval_(h) {
    setTarget((await api(`/targets/${id}`, { method: 'PATCH', body: { scanIntervalHours: Number(h) } })).target);
  }

  async function remove() {
    if (!confirm(`Delete ${target.url} and all its scan history?`)) return;
    await api(`/targets/${id}`, { method: 'DELETE' });
    nav('/');
  }

  if (!target) return error ? <div className="error">{error}</div> : <p className="muted">Loading…</p>;

  return (
    <>
      <div className="row between">
        <div>
          <h2>{target.url}</h2>
          <span className="muted small">Last scan: {when(target.lastScanAt)}</span>
        </div>
        <Grade grade={target.lastGrade} score={target.lastScore} size="lg" />
      </div>

      {!target.verified ? <Verification target={target} onVerified={setTarget} /> : (
        <div className="card row">
          <button className="btn" onClick={scan} disabled={current?.status === 'running'}>{current?.status === 'running' ? 'Scanning…' : 'Run scan'}</button>
          <label className="row small">
            Auto-scan
            <select value={target.scanIntervalHours} onChange={(e) => setInterval_(e.target.value)}>
              <option value={0}>Off</option><option value={6}>Every 6h</option><option value={24}>Daily</option><option value={168}>Weekly</option>
            </select>
          </label>
          <div className="spacer" />
          <button className="btn danger" onClick={remove}>Delete</button>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      <Findings scan={current} />

      <div className="card">
        <h3>Score history</h3>
        <TrendChart scans={scans} />
        <table>
          <thead><tr><th>When</th><th>Grade</th><th>Trigger</th><th>Status</th><th /></tr></thead>
          <tbody>
            {scans.map((s) => (
              <tr key={s._id}>
                <td>{when(s.createdAt)}</td><td><Grade grade={s.grade} score={s.score} size="sm" /></td>
                <td className="muted">{s.trigger}</td><td className="muted">{s.status}</td>
                <td><button className="btn ghost" onClick={() => open(s._id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
