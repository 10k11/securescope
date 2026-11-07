import { useState } from 'react';

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
export const SEV_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

/* ---------- Icons (inline, stroke-based) ---------- */
const paths = {
  shield: <><path d="M12 3l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  alert: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  logout: <><path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4" /><path d="M16 8l4 4-4 4M20 12H9" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M7 5l12 7-12 7z" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V4h6v3" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>,
  refresh: <><path d="M20 11a8 8 0 00-14.5-4M4 13a8 8 0 0014.5 4" /><path d="M20 4v7h-7M4 20v-7h7" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  scan: <><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" /><path d="M4 12h16" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>,
};
export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
  );
}

export function Logo({ size = 34 }) {
  return (
    <span className="logo" style={{ width: size, height: size }}>
      <Icon name="shield" size={size * 0.62} />
    </span>
  );
}

/* ---------- Primitives ---------- */
export const Badge = ({ sev }) => <span className={`badge sev-${sev}`}><i />{SEV_LABEL[sev]}</span>;

export function PageHeader({ title, subtitle, children, back }) {
  return (
    <div className="page-header">
      <div>
        {back}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Empty({ icon = 'globe', title, text, children }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

export function CopyField({ value, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="copyfield">
      {label && <span className="cf-label">{label}</span>}
      <code>{value}</code>
      <button type="button" onClick={copy} aria-label="Copy">{done ? <Icon name="check" size={15} /> : <Icon name="copy" size={15} />}</button>
    </div>
  );
}

/* ---------- Data viz ---------- */
const GRADE_COLOR = { A: '#059669', B: '#65a30d', C: '#d97706', D: '#ea580c', F: '#dc2626' };
export const gradeColor = (g) => GRADE_COLOR[g] || '#94a3b8';

export function Grade({ grade, score }) {
  if (!grade) return <span className="muted">Not scanned</span>;
  return (
    <span className="grade-chip" style={{ '--c': gradeColor(grade) }} title={`${score}/100`}>
      <b>{grade}</b>
      <span>{score}</span>
    </span>
  );
}

export function ScoreRing({ score, grade, size = 150, label = 'Security score' }) {
  const r = (size - 16) / 2, c = 2 * Math.PI * r;
  const has = grade != null;
  const off = has ? c * (1 - score / 100) : c;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-val" stroke={gradeColor(grade)}
          strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-center">
        {has ? <><b>{score}</b><span style={{ color: gradeColor(grade) }}>Grade {grade}</span></> : <><b>—</b><span>No scan yet</span></>}
        <small>{label}</small>
      </div>
    </div>
  );
}

export function SeverityBar({ counts }) {
  const total = SEVERITIES.reduce((a, s) => a + (counts?.[s] || 0), 0);
  return (
    <div>
      <div className="sevbar">
        {total === 0 ? <span className="seg none" style={{ flex: 1 }} /> : SEVERITIES.map((s) => (counts[s] ? <span key={s} className={`seg sev-${s}`} style={{ flex: counts[s] }} title={`${SEV_LABEL[s]}: ${counts[s]}`} /> : null))}
      </div>
      <div className="sevlegend">
        {SEVERITIES.map((s) => <span key={s}><i className={`dot sev-${s}`} />{SEV_LABEL[s]} <b>{counts?.[s] || 0}</b></span>)}
      </div>
    </div>
  );
}

export function TrendChart({ scans }) {
  const pts = [...scans].filter((s) => s.status === 'completed').reverse();
  if (pts.length < 2) return <p className="muted pad">Run at least two scans to see your score trend.</p>;
  const W = 640, H = 170, L = 34, R = 12, T = 12, B = 22;
  const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v) => T + (1 - v / 100) * (H - T - B);
  const line = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.score).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label="Score trend over time">
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f46e5" stopOpacity=".22" /><stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{v}</text></g>
      ))}
      <path d={area} fill="url(#area)" />
      <path d={line} className="line" />
      {pts.map((s, i) => (
        <circle key={s._id} cx={x(i)} cy={y(s.score)} r="4.5" className="dot-pt"><title>{`${s.score} (${s.grade}) — ${new Date(s.createdAt).toLocaleString()}`}</title></circle>
      ))}
    </svg>
  );
}

export const when = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');
export function ago(d) {
  if (!d) return 'Never';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
