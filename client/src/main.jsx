import React, { useEffect, useState } from 'react';
import { AuthCtx } from './auth.js';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api, refresh, setToken } from './api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TargetDetail from './pages/TargetDetail.jsx';
import AuditLog from './pages/AuditLog.jsx';
import './styles.css';


function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking session

  useEffect(() => {
    refresh().then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  const signIn = (d) => { setToken(d.accessToken); setUser(d.user); };
  const signOut = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setToken(null); setUser(null); };

  if (user === undefined) return <div className="center muted">Loading…</div>;

  return (
    <AuthCtx.Provider value={{ user, signIn, signOut }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route element={user ? <Layout /> : <Navigate to="/login" />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/targets/:id" element={<TargetDetail />} />
            <Route path="/audit" element={<AuditLog />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
