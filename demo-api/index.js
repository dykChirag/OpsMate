'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const axios = require('axios');
const { Pool } = require('pg');

const PORT = parseInt(process.env.PORT || '3001', 10);
const METRICS_PORT = parseInt(process.env.METRICS_PORT || process.env.ZEROPS_PROMETHEUS_PORT || '9090', 10);
const SERVICE_NAME = process.env.SERVICE_NAME || 'demo';
const API_INGEST_URL = process.env.API_INGEST_URL || 'http://api:8080/ingest';
const DB_URL = process.env.DATABASE_URL;
/** Organic (non-chaos) demo signals — less frequent than health probes (~90s default). */
const ORGANIC_INTERVAL_MS = parseInt(process.env.ORGANIC_INTERVAL_MS || '90000', 10);
/** Disable with ORGANIC_DEMO=0 if needed. */
const ORGANIC_ENABLED = process.env.ORGANIC_DEMO !== '0';

const pool = DB_URL ? new Pool({ connectionString: DB_URL }) : null;

let requestCount = 0;
let errorCount = 0;
let totalLatency = 0;
let latencyCount = 0;
let organicTimer = null;
let organicTick = 0;

function recordRequest(latencyMs, isError = false) {
  requestCount++;
  totalLatency += latencyMs;
  latencyCount++;
  if (isError) errorCount++;
}

function avgLatency() {
  return latencyCount === 0 ? 0 : Math.round(totalLatency / latencyCount);
}

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    level,
    message,
    ...meta,
  };
  // Preserve skipDiagnose if set (simulate / secondary pipeline noise)
  if (meta.skipDiagnose === true) {
    entry.skipDiagnose = true;
  }
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](JSON.stringify(entry));
  axios.post(API_INGEST_URL, entry, { timeout: 3000 }).catch(() => {});
}

/** Chaos simulate logs always skip ingest diagnose — OpsMate Chaos lab owns the incident. */
function logSimulate(level, message, meta = {}) {
  log(level, message, { ...meta, skipDiagnose: true });
}

function renderMetrics() {
  return [
    '# HELP request_count Total HTTP requests received',
    '# TYPE request_count counter',
    `request_count{service="${SERVICE_NAME}"} ${requestCount}`,
    '',
    '# HELP error_count Total HTTP 5xx errors',
    '# TYPE error_count counter',
    `error_count{service="${SERVICE_NAME}"} ${errorCount}`,
    '',
    '# HELP avg_latency_ms Rolling average response latency in milliseconds',
    '# TYPE avg_latency_ms gauge',
    `avg_latency_ms{service="${SERVICE_NAME}"} ${avgLatency()}`,
    '',
  ].join('\n');
}

/**
 * Emit application-level events that are NOT labelled chaos/SIMULATE.
 * Rotates between latency budget, dependency timeout, and resource pressure
 * so the demo feed can show genuine diagnosis depth without self-inflicted spam.
 */
async function runOrganicWorkload() {
  organicTick += 1;
  const phase = organicTick % 3;

  if (phase === 1) {
    // Real slow path in the process (metrics will reflect it; one diagnose-worthy log)
    const delayMs = 2200 + Math.floor(Math.random() * 900);
    const t0 = process.hrtime.bigint();
    await new Promise((r) => setTimeout(r, delayMs));
    const elapsed = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
    recordRequest(elapsed, false);
    log('warn', 'GET /api/data latency exceeded budget', {
      kind: 'app_latency',
      route: '/api/data',
      latencyMs: elapsed,
      budgetMs: 800,
    });
    return;
  }

  if (phase === 2) {
    log('error', 'Upstream dependency timeout while calling billing.internal:8080', {
      kind: 'dep_timeout',
      dependency: 'billing.internal',
      timeoutMs: 3000,
      error: 'ETIMEDOUT',
    });
    recordRequest(3000, true);
    return;
  }

  // phase 0
  log('warn', 'Process memory pressure crossed soft threshold', {
    kind: 'resource',
    metric: 'heapUsedMb',
    value: 384 + Math.floor(Math.random() * 80),
    thresholdMb: 360,
  });
}

const app = express();
app.use(express.json());

// Allow dashboard (other port/origin) to hit chaos endpoints in the browser
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  req._startAt = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - req._startAt) / 1e6;
    recordRequest(ms, res.statusCode >= 500);
  });
  next();
});

app.get('/', (_req, res) => {
  log('info', 'Health probe OK');
  res.json({ status: 'ok', service: SERVICE_NAME, ts: new Date().toISOString() });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.get('/api/data', async (_req, res) => {
  try {
    let rows;
    if (pool) {
      const result = await pool.query(`SELECT NOW() AS server_time, $1::text AS source`, [SERVICE_NAME]);
      rows = result.rows;
    } else {
      rows = [{ server_time: new Date().toISOString(), source: `${SERVICE_NAME} (no-db)` }];
    }
    log('info', 'GET /api/data success', { rowCount: rows.length });
    res.json({ ok: true, data: rows });
  } catch (err) {
    log('error', 'GET /api/data failed', { error: err.message, kind: 'app_db' });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(renderMetrics());
});

// ─── Chaos (manual only via Chaos lab) ──
// All simulate logs are skipDiagnose — OpsMate `/sandbox/chaos` creates the incident.

app.get('/simulate/slow', async (_req, res) => {
  const delayMs = 700 + Math.floor(Math.random() * 500);
  logSimulate('warn', 'SIMULATE: slow endpoint triggered', { delayMs, chaos: 'slow' });
  await new Promise((r) => setTimeout(r, delayMs));
  logSimulate('warn', 'SIMULATE: slow endpoint resolved after delay', {
    delayMs,
    chaos: 'slow',
  });
  res.json({ ok: true, message: `Responded after ${delayMs}ms`, delayMs });
});

app.get('/simulate/crash', (_req, _res, next) => {
  logSimulate('error', 'SIMULATE: crash endpoint triggered — throwing intentional error', {
    chaos: 'crash',
  });
  next(new Error('Intentional crash: unhandled exception for OpsMate demo'));
});

app.get('/simulate/bad-query', async (_req, res, next) => {
  logSimulate('error', 'SIMULATE: bad-query endpoint triggered', { chaos: 'bad-query' });
  try {
    if (pool) {
      await pool.query('SELECT * FROM table_that_does_not_exist_xyzabc WHERE id = $1', [1]);
    } else {
      throw new Error('DB connection not configured — simulated: relation "orders_legacy" does not exist');
    }
  } catch (err) {
    logSimulate('error', 'SIMULATE: database query failed', {
      error: err.message,
      code: err.code || 'SIM_DB_ERROR',
      chaos: 'bad-query',
    });
    return next(err);
  }
});

app.get('/simulate/error-storm', async (_req, res) => {
  logSimulate('error', 'SIMULATE: error storm triggered — burst of 5xx responses', {
    chaos: 'error-storm',
    count: 12,
  });
  for (let i = 0; i < 12; i++) {
    recordRequest(40 + i * 5, true);
  }
  logSimulate('error', 'SIMULATE: error storm sample', {
    chaos: 'error-storm',
    sample: 'upstream returned 502 Bad Gateway',
  });
  res.status(502).json({
    ok: false,
    message: 'Simulated error storm (12 failed requests recorded)',
    chaos: 'error-storm',
  });
});

app.get('/simulate/dep-timeout', async (_req, res) => {
  const timeoutMs = 450 + Math.floor(Math.random() * 250);
  logSimulate('error', 'SIMULATE: dependency timeout triggered', {
    chaos: 'dep-timeout',
    dependency: 'billing.internal:8080',
    timeoutMs,
  });
  await new Promise((r) => setTimeout(r, timeoutMs));
  logSimulate('error', 'SIMULATE: dependency timeout resolved (client aborted)', {
    chaos: 'dep-timeout',
    error: 'ETIMEDOUT',
  });
  res.status(504).json({
    ok: false,
    error: 'ETIMEDOUT',
    dependency: 'billing.internal',
    chaos: 'dep-timeout',
  });
});

app.get('/simulate/memory', (_req, res) => {
  const heap = process.memoryUsage();
  const heapUsedMb = Math.round(heap.heapUsed / 1024 / 1024);
  logSimulate('warn', 'SIMULATE: memory pressure signal', {
    chaos: 'memory',
    kind: 'resource',
    heapUsedMb,
    thresholdMb: Math.max(64, heapUsedMb - 20),
    rssMb: Math.round(heap.rss / 1024 / 1024),
  });
  res.json({
    ok: true,
    message: 'Simulated memory pressure log (no real OOM)',
    heapUsedMb,
    chaos: 'memory',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logSimulate('error', 'Unhandled error in request pipeline', {
    error: err.message,
    stack: err.stack?.split('\n').slice(0, 4).join(' | '),
  });
  res.status(500).json({
    ok: false,
    error: err.message,
    hint: 'Intentional failure for OpsMate demo.',
  });
});

const metricsApp = express();
metricsApp.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(renderMetrics());
});
metricsApp.get('/', (_req, res) => res.type('text/plain').send('metrics only\n'));

const metricsServer = http.createServer(metricsApp);
metricsServer.on('error', (err) => {
  console.warn(JSON.stringify({
    service: SERVICE_NAME,
    level: 'warn',
    message: `metrics port ${METRICS_PORT}: ${err.message} — /metrics still on ${PORT}`,
  }));
});
metricsServer.listen(METRICS_PORT, '0.0.0.0', () => {
  log('info', `metrics listening on ${METRICS_PORT}`);
});

app.listen(PORT, '0.0.0.0', () => {
  log('info', `${SERVICE_NAME} started`, { port: PORT, apiIngestUrl: API_INGEST_URL });

  if (ORGANIC_ENABLED) {
    // First organic event after a short warm-up so demos see real signals without waiting forever
    const warmMs = Math.min(ORGANIC_INTERVAL_MS, 18_000);
    setTimeout(() => {
      runOrganicWorkload().catch(() => {});
      organicTimer = setInterval(() => {
        runOrganicWorkload().catch(() => {});
      }, ORGANIC_INTERVAL_MS);
    }, warmMs);
    log('info', 'Organic demo workload scheduled', {
      warmMs,
      intervalMs: ORGANIC_INTERVAL_MS,
    });
  }
});

process.on('SIGTERM', () => {
  if (organicTimer) clearInterval(organicTimer);
  log('info', `${SERVICE_NAME} shutting down (SIGTERM)`);
  process.exit(0);
});
