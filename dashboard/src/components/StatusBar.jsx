import React from 'react';
import { useStatus } from '../hooks/useStatus.js';

const STATUS_LABELS = {
  healthy:     'Healthy',
  degraded:    'Degraded',
  unreachable: 'Unreachable',
  unknown:     'Unknown',
};

function MetricPill({ label, value }) {
  return (
    <div style={{
      background: 'rgba(79,142,247,0.08)',
      border:     '1px solid rgba(79,142,247,0.15)',
      borderRadius: 'var(--radius-sm)',
      padding:    '4px 10px',
      display:    'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1,
      minWidth: 80,
    }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

export function StatusBar() {
  const { data, loading, error } = useStatus(5000);

  const demoApi = data?.services?.['demo-api'];
  const api     = data?.services?.api;
  const status  = demoApi?.status ?? 'unknown';
  const metrics = demoApi?.metrics;

  return (
    <div className="glass-card" style={{ padding: 'var(--space-5) var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 18 }}>📡</span>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Service Monitor</span>
        </div>
        {data && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Updated {new Date(data.ts).toLocaleTimeString()}
          </span>
        )}
      </div>

      {loading && !data && (
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {[120, 80, 80, 80].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 44, width: w }} />
          ))}
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--color-high)', fontSize: 13, background: 'var(--color-high-bg)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
          ⚠ Cannot reach api — is it running? ({error})
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)' }}>
          {/* demo-api status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '8px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <span className={`status-dot ${status}`} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>demo-api</div>
              <div style={{ fontSize: 11, color: `var(--color-${status === 'healthy' ? 'healthy' : status === 'degraded' ? 'degraded' : 'unreachable'})` }}>
                {STATUS_LABELS[status]} {demoApi?.latencyMs != null ? `· ${demoApi.latencyMs}ms` : ''}
              </div>
            </div>
          </div>

          {/* api status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '8px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <span className="status-dot healthy" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>opsmate-api</div>
              <div style={{ fontSize: 11, color: 'var(--color-healthy)' }}>
                Healthy · up {api?.uptime ? `${Math.floor(api.uptime / 60)}m ${api.uptime % 60}s` : '—'}
              </div>
            </div>
          </div>

          {/* Metrics pills */}
          {metrics && typeof metrics.requestCount !== 'undefined' && (
            <>
              <MetricPill label="Requests"  value={metrics.requestCount} />
              <MetricPill label="Errors"    value={metrics.errorCount} />
              <MetricPill label="Avg Lat."  value={`${metrics.avgLatencyMs}ms`} />
            </>
          )}

          {/* Log buffer indicator */}
          {api?.logBuffer != null && (
            <MetricPill label="Log Buffer" value={`${api.logBuffer}`} />
          )}
        </div>
      )}
    </div>
  );
}
