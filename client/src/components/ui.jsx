export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

export const Badge = ({ sev }) => <span className={`badge ${sev}`}>{sev}</span>;

export function Grade({ grade, score, size = 'md' }) {
  if (!grade) return <span className="muted">—</span>;
  return (
    <span className={`grade g-${grade} ${size}`} title={`${score}/100`}>
      {grade}
      <small>{score}</small>
    </span>
  );
}

export function TrendChart({ scans }) {
  const pts = [...scans].filter((s) => s.status === 'completed').reverse();
  if (pts.length < 2) return <p className="muted">Run at least two scans to see the trend.</p>;
  const W = 600, H = 120, P = 10;
  const x = (i) => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (v) => H - P - (v / 100) * (H - 2 * P);
  const d = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.score)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label="Score trend">
      {[0, 50, 100].map((v) => <line key={v} x1={P} x2={W - P} y1={y(v)} y2={y(v)} className="grid" />)}
      <path d={d} className="line" />
      {pts.map((s, i) => <circle key={s._id} cx={x(i)} cy={y(s.score)} r="3.5" className="dot"><title>{`${s.score} — ${new Date(s.createdAt).toLocaleString()}`}</title></circle>)}
    </svg>
  );
}

export const when = (d) => (d ? new Date(d).toLocaleString() : 'never');
