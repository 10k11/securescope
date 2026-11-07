import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.js';

export default function Layout() {
  const { user, signOut } = useAuth();
  return (
    <>
      <header className="nav">
        <div className="brand">🛡️ SecureScope</div>
        <nav>
          <NavLink to="/" end>Targets</NavLink>
          <NavLink to="/audit">Audit log</NavLink>
        </nav>
        <div className="spacer" />
        <span className="muted">{user.email}</span>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </header>
      <main className="container"><Outlet /></main>
    </>
  );
}
