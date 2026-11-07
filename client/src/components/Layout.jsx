import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.js';
import { Icon, Logo } from './ui.jsx';

export default function Layout() {
  const { user, signOut } = useAuth();
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand"><Logo /><div><b>SecureScope</b><small>Security posture</small></div></div>
        <nav>
          <span className="nav-label">Monitor</span>
          <NavLink to="/" end><Icon name="globe" />Targets</NavLink>
          <NavLink to="/audit"><Icon name="list" />Audit log</NavLink>
        </nav>
        <div className="side-foot">
          <div className="tip">
            <Icon name="lock" size={16} />
            <p>Only scan sites you own. Ownership is verified before every scan.</p>
          </div>
          <div className="user">
            <span className="avatar">{initials}</span>
            <div><b>{user.name}</b><small>{user.email}</small></div>
            <button onClick={signOut} title="Sign out" aria-label="Sign out"><Icon name="logout" size={17} /></button>
          </div>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
