import React, { useState } from 'react';
import { useIncidents } from '../hooks/useIncidents.js';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function SeverityIcon({ severity }) {
  const icons = { high: '🔴', medium: '🟡', low: '🟢' };
  return <span style={{ fontSize: 12 }}>{icons[severity] ?? '⚪'}</span>;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)  return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function IncidentRow({ incident, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const { severity, service_name, explanation, suggested_fix, created_at } = incident;

  return (
    <div
      className={`fade-in`}
      style={{
        background:   `var(--color-${severity}-bg)`,
        border:       `1px solid var(--color-${severity}-glow)`,
        borderRadius: 'var(--radius-md)',
        overflow:     'hidden',
        transition:   'box-shadow var(--transition)',
        boxShadow:    isNew ? `0 0 20px var(--color-${severity}-glow)` : 'none',
      }}
    >
      {/* Row header */}
      <button
        onClick={() => setExpanded((x) => !x)}
        style={{
          width:      '100%',
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          padding:    'var(--space-3) var(--space-4)',
          display:    'flex',
          alignItems: 'center',
          gap:        'var(--space-3)',
          textAlign:  'left',
        }}
      >
        <SeverityIcon severity={severity} />
        <span className={`badge badge-${severity}`} style={{ flexShrink: 0 }}>{severity}</span>
        <span style={{
          fontSize:   13,
          fontWeight: 500,
          color:      'var(--color-text-primary)',
          flex:       1,
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {explanation || 'Diagnosis pending…'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {service_name} · {timeAgo(created_at)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div className="section-label" style={{ marginBottom: 'var(--space-1)' }}>Root Cause</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>{explanation}</div>
          </div>
          {suggested_fix && (
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)' }}>
              <div className="section-label" style={{ marginBottom: 'var(--space-1)' }}>💡 Suggested Fix</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{suggested_fix}</div>
            </div>
          )}
          <div style={{ marginTop: 'var(--space-2)', fontSize: 11, color: 'var(--color-text-muted)' }}>
            Incident #{incident.id} · {new Date(created_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

export function IncidentFeed() {
  const { incidents, loading, error } = useIncidents(4000);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? incidents
    : incidents.filter((i) => i.severity === filter);

  return (
    <div className="glass-card" style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>⚡</span>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>
          Incident Feed
          {incidents.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 400 }}>
              ({incidents.length} total)
            </span>
          )}
        </span>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {['all', 'high', 'medium', 'low'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background:   filter === f ? 'var(--color-accent-dim)' : 'transparent',
                border:       `1px solid ${filter === f ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color:        filter === f ? 'var(--color-accent)' : 'var(--color-text-muted)',
                borderRadius: '99px',
                padding:      '3px 10px',
                fontSize:     11,
                fontWeight:   600,
                cursor:       'pointer',
                textTransform: 'capitalize',
                transition:   'all var(--transition)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', overflowY: 'auto', maxHeight: 480 }}>
        {loading && incidents.length === 0 && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--radius-md)' }} />
          ))
        )}

        {error && (
          <div style={{ color: 'var(--color-high)', fontSize: 13, padding: 'var(--space-3)' }}>
            ⚠ Error loading incidents: {error}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 'var(--space-2)' }}>✅</div>
            <div style={{ fontSize: 14 }}>No incidents yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Trigger a failure above to generate one</div>
          </div>
        )}

        {filtered.map((incident, i) => (
          <IncidentRow key={incident.id} incident={incident} isNew={i === 0} />
        ))}
      </div>
    </div>
  );
}
