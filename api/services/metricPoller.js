'use strict';

const axios     = require('axios');
const logBuffer = require('./logBuffer');

// ─── Config ─────────────────────────────────────────────────────────────────
const DEMO_API_URL    = process.env.DEMO_API_URL || 'http://demo:3001';
const POLL_INTERVAL   = parseInt(process.env.METRICS_POLL_MS || '10000', 10);

// Thresholds for anomaly detection
const LATENCY_SPIKE_MS    = 2000;   // avg_latency_ms > 2 000 ms → anomaly
const ERROR_RATE_THRESHOLD = 0.10;  // error_count/request_count > 10% → anomaly

// ─── State ───────────────────────────────────────────────────────────────────
/** @type {{ requestCount: number, errorCount: number, avgLatencyMs: number, ts: string } | null} */
let latestSnapshot = null;
let prevSnapshot   = null;
let timer          = null;

/** Callback fired when a metric anomaly is detected */
let onAnomalyCallback = null;

// ─── Prometheus text parser ──────────────────────────────────────────────────
/**
 * Parse Prometheus text format into a plain object.
 * Handles: `metric_name{label="v"} value`
 */
function parsePrometheus(text) {
  const result = {};
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*?)(?:\{[^}]*\})?\s+([\d.eE+-]+)/);
    if (match) {
      result[match[1]] = parseFloat(match[2]);
    }
  }
  return result;
}

// ─── Anomaly detection ───────────────────────────────────────────────────────
function detectAnomalies(current, previous) {
  const anomalies = [];

  if (current.avg_latency_ms > LATENCY_SPIKE_MS) {
    anomalies.push({
      type:    'latency_spike',
      value:   current.avg_latency_ms,
      message: `High average latency detected: ${current.avg_latency_ms}ms (threshold: ${LATENCY_SPIKE_MS}ms)`,
    });
  }

  if (previous && current.request_count > previous.request_count) {
    const newRequests = current.request_count - previous.request_count;
    const newErrors   = (current.error_count  - previous.error_count) || 0;
    if (newRequests > 0 && newErrors / newRequests > ERROR_RATE_THRESHOLD) {
      anomalies.push({
        type:    'error_rate_spike',
        value:   newErrors / newRequests,
        message: `Elevated error rate: ${(newErrors / newRequests * 100).toFixed(1)}% in last poll window`,
      });
    }
  }

  return anomalies;
}

// ─── Poll loop ───────────────────────────────────────────────────────────────
async function poll() {
  try {
    const res  = await axios.get(`${DEMO_API_URL}/metrics`, { timeout: 5000 });
    const data = parsePrometheus(res.data);

    const snapshot = {
      requestCount:  data.request_count  ?? 0,
      errorCount:    data.error_count    ?? 0,
      avgLatencyMs:  data.avg_latency_ms ?? 0,
      ts:            new Date().toISOString(),
    };

    prevSnapshot   = latestSnapshot;
    latestSnapshot = snapshot;

    // Push a synthetic log entry so the buffer has metric context too
    logBuffer.push({
      service:   process.env.DEMO_SERVICE_NAME || 'demo',
      level:     'info',
      message:   'metrics poll',
      timestamp: snapshot.ts,
      metrics:   snapshot,
    });

    // Anomaly detection
    const anomalies = detectAnomalies(
      { request_count: snapshot.requestCount, error_count: snapshot.errorCount, avg_latency_ms: snapshot.avgLatencyMs },
      prevSnapshot
        ? { request_count: prevSnapshot.requestCount, error_count: prevSnapshot.errorCount }
        : null
    );

    for (const anomaly of anomalies) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(), service: 'api', level: 'warn',
        message: `Metric anomaly: ${anomaly.type}`, ...anomaly,
      }));
      if (typeof onAnomalyCallback === 'function') {
        // Map metric types into `kind` so diagnosis treats them as real signals, not chaos
        onAnomalyCallback({
          anomaly: { ...anomaly, kind: anomaly.type },
          snapshot,
        });
      }
    }
  } catch (err) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'warn',
      message: 'Metrics poll failed (demo-api unreachable?)', error: err.message,
    }));
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
function start(onAnomaly) {
  if (timer) return;  // already running
  onAnomalyCallback = onAnomaly;
  poll();             // immediate first poll
  timer = setInterval(poll, POLL_INTERVAL);
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), service: 'api', level: 'info',
    message: `Metric poller started`, intervalMs: POLL_INTERVAL, target: DEMO_API_URL,
  }));
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

function getLatest() { return latestSnapshot; }

module.exports = { start, stop, getLatest };
