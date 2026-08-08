import React, { useState } from 'react';
import { apiFetch, setAuthPat, clearAuth, setAuthProject } from '../api.js';

/**
 * Optional legacy connect panel (main UI is App.jsx Connect view).
 * PAT stays in browser sessionStorage + Authorization header on API calls —
 * never written to Postgres.
 */
export function ConnectPanel() {
  const [open,       setOpen]       = useState(false);
  const [token,      setToken]      = useState('');
  const [status,     setStatus]     = useState('idle'); // idle | loading | connected | error
  const [user,       setUser]       = useState(null);
  const [projects,   setProjects]   = useState(null);
  const [error,      setError]      = useState(null);

  async function connect(e) {
    e.preventDefault();
    if (!token.trim()) return;
    setStatus('loading');
    setError(null);
    try {
      const raw = token.trim();
      setAuthPat(raw);
      setAuthProject(null);
      const res = await apiFetch('/zerops/connect', {
        method: 'POST',
        body:   JSON.stringify({ token: raw }),
      });
      setUser(res.user);
      setToken('');
      setStatus('connected');
      await loadProjects();
    } catch (err) {
      clearAuth();
      setStatus('error');
      setError(err.message);
    }
  }

  async function loadProjects() {
    try {
      const res = await apiFetch('/zerops/projects');
      setProjects(res.projects ?? []);
    } catch (err) {
      setError(`Could not load projects: ${err.message}`);
    }
  }

  async function disconnect() {
    await apiFetch('/zerops/disconnect', { method: 'POST' }).catch(() => {});
    clearAuth();
    setStatus('idle');
    setUser(null);
    setProjects(null);
    setError(null);
  }

  return (
    <div style={{
      borderRadius: 'var(--radius-lg)',
      border:       '1px dashed rgba(99, 153, 255, 0.2)',
      background:   'rgba(8, 13, 22, 0.6)',
      overflow:     'hidden',
    }}>
      {/* Collapsed toggle header */}
      <button
        onClick={() => setOpen((x) => !x)}
        style={{
          width:      '100%',
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          padding:    'var(--space-4) var(--space-6)',
          display:    'flex',
          alignItems: 'center',
          gap:        'var(--space-3)',
          textAlign:  'left',
        }}
      >
        <span style={{ fontSize: 16 }}>🔗</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Connect Your Zerops Account
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
            Optional · see your real projects
          </span>
        </div>
        {status === 'connected' && (
          <span style={{ fontSize: 11, color: 'var(--color-healthy)', background: 'var(--color-low-bg)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--color-low-glow)' }}>
            ✓ Connected as {user?.email ?? 'unknown'}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Expandable body */}
      {open && (
        <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-5)', borderTop: '1px solid var(--color-border)' }}>
          {status !== 'connected' ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
                Paste a <strong style={{ color: 'var(--color-text-secondary)' }}>Zerops Personal Access Token</strong> to browse your real projects and services.
                The token is used only for this browser session and is <strong style={{ color: 'var(--color-healthy)' }}>never stored in the database</strong>.
              </div>
              <form onSubmit={connect} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  id="zerops-token-input"
                  className="input"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="zdX_your_personal_access_token…"
                  disabled={status === 'loading'}
                  autoComplete="off"
                />
                <button
                  id="zerops-connect-btn"
                  type="submit"
                  className="btn btn-ghost"
                  disabled={status === 'loading' || !token.trim()}
                  style={{ flexShrink: 0 }}
                >
                  {status === 'loading' ? <><span className="spinner" style={{ width: 13, height: 13 }} />Validating</> : 'Connect'}
                </button>
              </form>
              {error && (
                <div style={{ marginTop: 'var(--space-2)', fontSize: 12, color: 'var(--color-high)' }}>
                  ⚠ {error}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: 13 }}>
                  Connected as <strong>{user?.fullName ?? user?.email}</strong>
                </div>
                <button className="btn btn-ghost" onClick={disconnect} style={{ fontSize: 12, padding: '5px 12px' }}>
                  Disconnect
                </button>
              </div>

              {projects === null && <div className="skeleton" style={{ height: 80 }} />}

              {projects && projects.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: 'var(--space-4)', textAlign: 'center' }}>
                  No Zerops projects found in this account.
                </div>
              )}

              {projects && projects.map((proj) => (
                <div key={proj.id} style={{ marginBottom: 'var(--space-3)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{proj.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                    {proj.services.map((svc) => (
                      <span key={svc.id} style={{
                        fontSize:     11,
                        padding:      '2px 8px',
                        borderRadius: 99,
                        background:   'var(--color-accent-dim)',
                        color:        'var(--color-accent)',
                        border:       '1px solid var(--color-border)',
                      }}>
                        {svc.name} · {svc.status}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
