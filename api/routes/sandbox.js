'use strict';

/**
 * Sandbox-only chaos lab.
 * Always creates a diagnosis locally (reliable). Demo HTTP is best-effort only
 * so Windows/localhost / wrong DEMO_API_URL never fails the button silently.
 */
const { Router } = require('express');
const axios = require('axios');
const logBuffer = require('../services/logBuffer');
const metricPoller = require('../services/metricPoller');
const { diagnose } = require('../services/diagnosisEngine');

const router = Router();

const CHAOS = {
  slow: '/simulate/slow',
  crash: '/simulate/crash',
  'bad-query': '/simulate/bad-query',
  'error-storm': '/simulate/error-storm',
  'dep-timeout': '/simulate/dep-timeout',
  memory: '/simulate/memory',
};

function demoCandidates() {
  const primary = (process.env.DEMO_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  return [...new Set([primary, 'http://localhost:3001', 'http://127.0.0.1:3001'])];
}

const FALLBACK_LOGS = {
  slow: {
    level: 'warn',
    message: 'SIMULATE: slow endpoint triggered',
    meta: { delayMs: 900, chaos: 'slow' },
  },
  crash: {
    level: 'error',
    message: 'SIMULATE: crash endpoint triggered — throwing intentional error',
    meta: { chaos: 'crash' },
  },
  'bad-query': {
    level: 'error',
    message: 'SIMULATE: bad-query endpoint triggered',
    meta: { chaos: 'bad-query' },
  },
  'error-storm': {
    level: 'error',
    message: 'SIMULATE: error storm triggered — burst of 5xx responses',
    meta: { chaos: 'error-storm', count: 12 },
  },
  'dep-timeout': {
    level: 'error',
    message: 'SIMULATE: dependency timeout triggered',
    meta: {
      chaos: 'dep-timeout',
      dependency: 'billing.internal:8080',
      timeoutMs: 600,
    },
  },
  memory: {
    level: 'warn',
    message: 'SIMULATE: memory pressure signal',
    meta: { chaos: 'memory', kind: 'resource', heapUsedMb: 256, thresholdMb: 200 },
  },
};

/** Best-effort demo patient hit — never the source of truth for incidents. */
async function fireViaDemo(type, path) {
  const timeout = type === 'slow' || type === 'dep-timeout' ? 4_000 : 3_000;
  let lastErr = null;
  for (const base of demoCandidates()) {
    try {
      const r = await axios.get(`${base}${path}`, {
        timeout,
        validateStatus: () => true,
        family: 4,
        // Tell demo not to re-push diagnose (we handle it here)
        headers: { 'X-OpsMate-Diagnose': '0' },
      });
      return {
        via: 'demo',
        demoUrl: base,
        demoStatus: r.status,
        outcome: r.status >= 500 ? 'failure_simulated' : 'ok',
      };
    } catch (err) {
      lastErr = err;
    }
  }
  return {
    via: 'demo-miss',
    demoStatus: 0,
    outcome: 'unreachable',
    detail: lastErr?.message || 'Demo patient unreachable',
    tried: demoCandidates(),
  };
}

/**
 * Always create a sandbox incident for this chaos type.
 * forceNew: every lab click gets a fresh card (no silent cooldown dedupe).
 */
async function fireViaLocalDiagnose(type) {
  const spec = FALLBACK_LOGS[type];
  if (!spec) throw new Error(`Unknown chaos type ${type}`);
  const demoName = process.env.DEMO_SERVICE_NAME || 'demo';
  const labId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    timestamp: new Date().toISOString(),
    service: demoName,
    level: spec.level,
    message: spec.message,
    source: 'chaos-lab',
    labId,
    forceNew: true,
    ...spec.meta,
  };
  logBuffer.push(entry);

  // Await diagnosis so the API response is honest about success
  const incident = await diagnose({
    serviceName: demoName,
    logLines: logBuffer.recent(30, { service: demoName }),
    metrics: metricPoller.getLatest(),
    triggerLog: entry,
    source: 'chaos-lab',
    forceNew: true,
    skipLlm: true,
    projectId: 'sandbox',
    projectName: 'Local sandbox',
  });

  return {
    via: 'local-diagnose',
    incidentId: incident?.id || null,
    severity: incident?.severity || null,
    title: incident?.title || null,
    deduped: Boolean(incident?.deduped),
    labId,
  };
}

router.post('/chaos', async (req, res) => {
  const { getToken, getSelectedProject } = require('../services/reqAuth');
  const live =
    getToken(req) &&
    getSelectedProject(req) &&
    getSelectedProject(req) !== 'sandbox';
  if (live) {
    return res.status(403).json({
      ok: false,
      error: 'Chaos lab is disabled while a Zerops project is selected',
    });
  }

  const type = String(req.body?.type || req.body?.id || '').trim();
  if (!CHAOS[type]) {
    return res.status(400).json({
      ok: false,
      error: 'Unknown chaos type',
      allowed: Object.keys(CHAOS),
    });
  }

  // Local diagnose is required (rules path — fast). Demo patient is best-effort
  // background only so slow/unreachable demo never makes the button flaky.
  try {
    const local = await fireViaLocalDiagnose(type);

    if (!local.incidentId && !local.deduped) {
      return res.status(500).json({
        ok: false,
        error: 'Diagnosis did not create an incident',
        type,
        local,
      });
    }

    // Fire demo patient in background (metrics/logs drama); never block the response.
    void fireViaDemo(type, CHAOS[type]).then((demo) => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          service: 'api',
          level: 'info',
          message: 'Chaos lab demo patient result',
          type,
          demo,
        })
      );
    });

    return res.json({
      ok: true,
      type,
      triggered: true,
      via: 'local',
      outcome: 'diagnosed',
      incidentId: local.incidentId,
      title: local.title,
      severity: local.severity,
      local,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'api',
        level: 'error',
        message: 'Chaos lab fire failed',
        type,
        error: err.message,
      })
    );
    return res.status(502).json({
      ok: false,
      error: 'Chaos lab failed to diagnose',
      detail: err.message,
      type,
    });
  }
});

module.exports = router;
