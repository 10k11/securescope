import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  Badge, CopyField, Empty, Grade, Icon, PageHeader, SEVERITIES, SEV_LABEL, ScoreRing, SeverityBar, TrendChart, when,
} from '../components/ui.jsx';

function Verification({ target, onVerified }) {
  const v = target.verification;
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true); setMsg('');
    try { onVerified((await api(`/targets/${target._id}/verify`, { method: 'POST' })).target); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <section className="panel verify">
      <div className="verify-head">
        <span className="stat-icon amber"><Icon name="key" size={20} /></span>
        <div>
          <h3>Verify you own {target.hostname}</h3>
          <p className="muted">Scanning stays locked until you prove control of this domain. Complete <b>any one</b> method, then click verify.</p>
        </div>
      </div>
      <div className="methods">
        <div className="method">
          <span className="m-num">1</span><h4>DNS TXT record</h4>
          <p>Add a TXT record on <code>{v.dns.host}</code>:</p>
          <CopyField value={v.dns.value} />
        </div>
        <div className="method">
          <span className="m-num">2</span><h4>Well-known file</h4>
          <p>Serve this exact text at <code>{v.file.path}</code>:</p>
          <CopyField value={v.file.content} />
        </div>
        <div className="method">
          <span className="m-num">3</span><h4>HTML meta tag</h4>
          <p>Add inside your homepage <code>&lt;head&gt;</code>:</p>
          <CopyField value={v.meta.tag} />
        </div>
      </div>
      {msg && <div className="alert-box"><Icon name="alert" size={17} />{msg}</div>}
      <button className="btn primary" onClick={check} disabled={busy}><Icon name="checkCircle" size={17} />{busy ? 'Checking…' : 'Verify ownership'}</button>
    </section>
  );
}

function Findings({ scan }) {
  const [filter, setFilter] = useState('all');
  if (!scan) return null;
  if (scan.status === 'running') {
    return <section className="panel scanning"><span className="spinner" /><div><h3>Scan in progress</h3><p className="muted">Checking headers, cookies, TLS and exposed files…</p></div></section>;
  }
  if (scan.status === 'failed') {
    return <section className="panel"><div className="alert-box"><Icon name="alert" size={17} />Scan failed: {scan.error}</div></section>;
  }
  const list = SEVERITIES.flatMap((s) => scan.findings.filter((f) => f.severity === s)).filter((f) => filter === 'all' || f.severity === filter);
  const counts = scan.counts || {};
  return (
    <section className="panel flush">
      <div className="panel-head pad">
        <div><h3>Findings</h3><small>From scan on {when(scan.createdAt)} · {scan.durationMs} ms</small></div>
        <div className="chips">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All {scan.findings.length}</button>
          {SEVERITIES.filter((s) => counts[s]).map((s) => (
            <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>{SEV_LABEL[s]} {counts[s]}</button>
          ))}
        </div>
      </div>
      {scan.findings.length === 0 && <Empty icon="checkCircle" title="No issues found" text="This site passed every check. Nice work." />}
      <div className="findings">
        {list.map((f) => (
          <details key={f.id} className={`finding sev-${f.severity}`}>
            <summary>
              <Badge sev={f.severity} />
              <span className="f-title">{f.title}</span>
              <span className="f-cat">{f.category}</span>
              <Icon name="chevron" size={16} className="f-chev" />
            </summary>
            <div className="f-body">
              <p>{f.description}</p>
              {f.evidence && <div className="f-evidence"><small>Evidence</small><code>{f.evidence}</code></div>}
              <div className="f-fix"><Icon name="checkCircle" size={17} /><div><small>How to fix</small><p>{f.remediation}</p></div></div>
            </div>
          </details>
        ))}
      </div>
    </section>
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

  async function setAuto(h) {
    setTarget((await api(`/targets/${id}`, { method: 'PATCH', body: { scanIntervalHours: Number(h) } })).target);
  }

  async function remove() {
    if (!confirm(`Delete ${target.url} and all its scan history?`)) return;
    await api(`/targets/${id}`, { method: 'DELETE' });
    nav('/');
  }

  if (!target) return error ? <div className="alert-box"><Icon name="alert" size={17} />{error}</div> : <p className="muted">Loading…</p>;

  const running = current?.status === 'running';
  const done = current?.status === 'completed' ? current : null;

  return (
    <>
      <PageHeader
        back={<Link to="/" className="back">← All targets</Link>}
        title={target.hostname}
        subtitle={<><a href={target.url} target="_blank" rel="noreferrer noopener" className="ext">{target.url}<Icon name="external" size={13} /></a>
          {target.verified && <span className="pill ok inline"><Icon name="checkCircle" size={13} />Verified via {target.verifiedMethod}</span>}</>}
      >
        {target.verified && (
          <>
            <label className="select-wrap"><Icon name="clock" size={16} />
              <select value={target.scanIntervalHours} onChange={(e) => setAuto(e.target.value)} aria-label="Auto-scan interval">
                <option value={0}>Auto-scan: Off</option><option value={6}>Every 6 hours</option><option value={24}>Daily</option><option value={168}>Weekly</option>
              </select>
            </label>
            <button className="btn primary" onClick={scan} disabled={running}><Icon name="play" size={15} />{running ? 'Scanning…' : 'Run scan'}</button>
          </>
        )}
        <button className="btn icon-btn danger" onClick={remove} title="Delete target" aria-label="Delete target"><Icon name="trash" size={17} /></button>
      </PageHeader>

      {error && <div className="alert-box"><Icon name="alert" size={17} />{error}</div>}
      {!target.verified && <Verification target={target} onVerified={setTarget} />}

      {target.verified && (
        <section className="overview">
          <div className="panel score-panel">
            <ScoreRing score={target.lastScore} grade={target.lastGrade} />
            <p className="muted small">Last scanned {when(target.lastScanAt)}</p>
          </div>
          <div className="panel sev-panel">
            <div className="panel-head"><h3>Issue breakdown</h3><small>Latest completed scan</small></div>
            <SeverityBar counts={done?.counts || {}} />
            <div className="mini-stats">
              <div><b>{done ? done.findings.length : '–'}</b><small>Total findings</small></div>
              <div><b>{done ? (done.counts?.critical || 0) + (done.counts?.high || 0) : '–'}</b><small>Critical + high</small></div>
              <div><b>{scans.length}</b><small>Scans run</small></div>
            </div>
          </div>
        </section>
      )}

      {target.verified && !current && <Empty icon="scan" title="No scans yet" text="Run your first scan to get a security grade and a prioritised list of fixes." />}
      <Findings scan={current} />

      {target.verified && scans.length > 0 && (
        <section className="panel flush">
          <div className="panel-head pad"><h3>Score history</h3><small>{scans.length} scans</small></div>
          <div className="pad no-top"><TrendChart scans={scans} /></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Grade</th><th>Trigger</th><th>Status</th><th /></tr></thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s._id} className={current?._id === s._id ? 'selected' : ''}>
                    <td>{when(s.createdAt)}</td>
                    <td><Grade grade={s.grade} score={s.score} /></td>
                    <td className="muted capitalize">{s.trigger}</td>
                    <td><span className={`status ${s.status}`}>{s.status}</span></td>
                    <td className="right"><button className="btn subtle sm" onClick={() => open(s._id)}>View report</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
