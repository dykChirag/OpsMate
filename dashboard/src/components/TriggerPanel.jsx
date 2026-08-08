import React, { useState } from 'react';
import { apiFetch } from '../api.js';

const TRIGGERS = [
  {
    id:      'slow',
    label:   'Slow Endpoint',
    icon:    '🐢',
    desc:    'Artificial 5–8s delay',
    variant: 'btn-warning',
    path:    '/simulate/slow',
    demoBase: true,
  },
  {
    id:      'crash',
    label:   'Crash (500)',
    icon:    '💥',
    desc:    'Throws unhandled error',
    variant: 'btn-danger',
    path:    '/simulate/crash',
    demoBase: true,
  },
  {
    id:      'bad-query',
    label:   'Bad DB Query',
    icon:    '🗄️',
    desc:    'Simulated SQL failure',
    variant: 'btn-danger',
    path:    '/simulate/bad-query',
    demoBase: true,
  },
];

// demo-api is either same origin on port 3001 (local) or its public Zerops URL
const DEMO_API_BASE = typeof __DEMO_API_URL__ !== 'undefined' && __DEMO_API_URL__
  ? __DEMO_API_URL__
  : 'http://localhost:3001';

export function TriggerPanel({ onTriggered }) {
  const [states, setStates] = useState({}); // { [id]: 'idle' | 'loading' | 'ok' | 'err' }

  async function trigger(t) {
    setStates((s) => ({ ...s, [t.id]: 'loading' }));
    try {
      const res = await fetch(`${DEMO_API_BASE}${t.path}`, { method: 'GET' });
      const body = await res.json().catch(() => ({}));
      setStates((s) => ({ ...s, [t.id]: res.ok ? 'ok' : 'err' }));
      if (typeof onTriggered === 'function') onTriggered({ trigger: t.id, status: res.status, body });
    } catch (err) {
      setStates((s) => ({ ...s, [t.id]: 'err' }));
      if (typeof onTriggered === 'function') onTriggered({ trigger: t.id, error: err.message });
    } finally {
      setTimeout(() => setStates((s) => ({ ...s, [t.id]: 'idle' })), 3000);
    }
  }

  return (
    <div className="glass-card" style={{ padding: 'var(--space-5) var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Failure Simulator</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
            Trigger real failures in demo-api — OpsMate will detect and diagnose them live
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {TRIGGERS.map((t) => {
          const state = states[t.id] ?? 'idle';
          return (
            <button
              key={t.id}
              id={`trigger-${t.id}`}
              className={`btn ${t.variant}`}
              onClick={() => trigger(t)}
              disabled={state === 'loading'}
              data-tooltip={t.desc}
              style={{ minWidth: 140, justifyContent: 'center', position: 'relative' }}
            >
              {state === 'loading' ? (
                <><span className="spinner" style={{ width: 13, height: 13 }} />{t.label}</>
              ) : state === 'ok' ? (
                <><span>✓</span>{t.label}</>
              ) : state === 'err' ? (
                <><span>⚡</span>{t.label} (sent)</>
              ) : (
                <><span>{t.icon}</span>{t.label}</>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 'var(--space-3)', fontSize: 11, color: 'var(--color-text-muted)' }}>
        After triggering, watch the incident feed below — a new diagnosis should appear within ~5s
      </div>
    </div>
  );
}
