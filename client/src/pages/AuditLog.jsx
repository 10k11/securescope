import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Empty, Icon, PageHeader, when } from '../components/ui.jsx';

const META = {
  'auth.login': ['user', 'ok', 'Signed in'],
  'auth.register': ['user', 'ok', 'Account created'],
  'auth.login_failed': ['alert', 'bad', 'Failed sign-in attempt'],
  'auth.refresh_reuse_detected': ['alert', 'bad', 'Refresh-token reuse detected — sessions revoked'],
  'target.add': ['plus', 'info', 'Target added'],
  'target.delete': ['trash', 'warn', 'Target deleted'],
  'target.verified': ['checkCircle', 'ok', 'Ownership verified'],
  'scan.start': ['scan', 'info', 'Scan started'],
};

export default function AuditLog() {
  const [logs, setLogs] = useState(null);
  useEffect(() => { api('/audit').then((d) => setLogs(d.logs)); }, []);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Security-relevant activity on your account. Suspicious events are highlighted." />
      <section className="panel flush">
        {logs?.length === 0 && <Empty icon="list" title="Nothing here yet" text="Account activity will appear here." />}
        <ul className="timeline">
          {logs?.map((l) => {
            const [icon, tone, label] = META[l.action] || ['list', 'info', l.action];
            return (
              <li key={l._id} className={tone}>
                <span className="t-icon"><Icon name={icon} size={16} /></span>
                <div className="t-main">
                  <b>{label}</b>
                  {l.meta && <small>{Object.entries(l.meta).map(([k, v]) => `${k}: ${v}`).join(' · ')}</small>}
                </div>
                <div className="t-side"><span>{when(l.createdAt)}</span><code>{l.ip}</code></div>
              </li>
            );
          })}
        </ul>
        {!logs && <p className="muted pad">Loading…</p>}
      </section>
    </>
  );
}
