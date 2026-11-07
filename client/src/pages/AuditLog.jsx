import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { when } from '../components/ui.jsx';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api('/audit').then((d) => setLogs(d.logs)); }, []);
  return (
    <>
      <h2>Audit log</h2>
      <p className="muted">Security-relevant activity on your account. Failed logins and refresh-token reuse show up here.</p>
      <div className="card">
        <table>
          <thead><tr><th>Time</th><th>Action</th><th>IP</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l._id} className={l.action.includes('failed') || l.action.includes('reuse') ? 'alert' : ''}>
                <td>{when(l.createdAt)}</td><td><code>{l.action}</code></td><td className="muted">{l.ip}</td>
                <td className="muted small">{l.meta ? JSON.stringify(l.meta) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
