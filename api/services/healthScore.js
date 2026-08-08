'use strict';

/**
 * Deployment health scoring.
 *
 * overall = round( sum(earned) / sum(weight of scorable checks) * 100 )
 * Informational rows (weight 0) never affect the denominator.
 */

const axios = require('axios');
const logBuffer = require('./logBuffer');
const metricPoller = require('./metricPoller');
const { isHealthyStatus, isPendingDeploy } = require('./projectInsights');

const INCIDENT_WEIGHT = 10;

/** Severity → points deducted from the open-incidents budget (per open incident). */
const SEVERITY_DEDUCTION = {
  critical: 5,
  high: 3,
  medium: 1.5,
  low: 0.25,
};

async function probe(url, timeoutMs = 2800) {
  const t0 = Date.now();
  try {
    const r = await axios.get(url, { timeout: timeoutMs, validateStatus: () => true });
    return { ok: r.status >= 200 && r.status < 400, status: r.status, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: err.message };
  }
}

/** Proportional credit for active application services. */
function scoreAppServices(activeCount, totalCount, weight) {
  if (totalCount <= 0) return 0;
  return (activeCount / totalCount) * weight;
}

function normalizeSeverity(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'low' || s === 'medium' || s === 'high' || s === 'critical') return s;
  // Unclassified / missing → MEDIUM (over-count risk preferred over under-count)
  return 'medium';
}

/**
 * True when an incident should not cost health points:
 * resolved/non-open, explicit no_action flag, or "no action needed" diagnosis text.
 */
function isExcludedFromHealthScoring(inc) {
  if (!inc || typeof inc !== 'object') return true;
  const status = String(inc.status || 'open').toLowerCase();
  if (status && status !== 'open') return true;
  if (inc.no_action === true || inc.noAction === true || inc.informational === true) {
    return true;
  }
  const blob = `${inc.title || ''} ${inc.explanation || ''} ${inc.suggested_fix || ''} ${inc.suggestedFix || ''}`;
  return /no action needed|no immediate action|nothing to do|deliberate chaos|expected chaos test|monitor for recurrence only/i.test(
    blob
  );
}

/**
 * Graduated open-incident score against a 10-pt budget.
 * Severity-weighted with diminishing marginal returns so volume alone
 * cannot zero the check (pure sum of LOW/MEDIUM still floored 0/10).
 *
 * @param {array|number} incidents open rows or bare count
 * @param {number} [weight=10]
 * @returns {{ earned: number, deduction: number, scored: object[], excluded: object[] }}
 */
function scoreOpenIncidents(incidents, weight = INCIDENT_WEIGHT) {
  let list = [];
  if (typeof incidents === 'number') {
    const n = Math.max(0, Math.floor(incidents));
    list = Array.from({ length: n }, () => ({ severity: 'medium', status: 'open' }));
  } else if (Array.isArray(incidents)) {
    list = incidents;
  }

  const scored = [];
  const excluded = [];
  for (const inc of list) {
    // Resolve rows must never reach here; exclude if they leak through
    if (isExcludedFromHealthScoring(inc)) excluded.push(inc);
    else scored.push(inc);
  }

  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  const ordered = [...scored].sort((a, b) => {
    const ra = rank[normalizeSeverity(a.severity)] ?? 2;
    const rb = rank[normalizeSeverity(b.severity)] ?? 2;
    return ra - rb;
  });

  // Full cost for the most severe events; geometric decay for the rest of the pile
  let raw = 0;
  ordered.forEach((inc, i) => {
    const base = SEVERITY_DEDUCTION[normalizeSeverity(inc.severity)] ?? SEVERITY_DEDUCTION.medium;
    raw += base * Math.pow(0.62, i);
  });

  // Soft cap: leave at least 10% of the budget so the check degrades gracefully
  // (true critical clusters can still nearly empty the bar).
  const softCap = weight * 0.9;
  const deduction = Math.min(softCap, raw);

  return {
    earned: Math.round(Math.max(0, weight - deduction) * 1000) / 1000,
    deduction: Math.round(deduction * 1000) / 1000,
    scored,
    excluded,
  };
}

function statusFromEarned(earned, weight) {
  if (weight <= 0) return 'info';
  if (earned <= 0) return 'fail';
  if (earned >= weight - 1e-9) return 'pass';
  return 'partial';
}

function pushCheck(checks, { id, label, weight, earned, message, pass, informational }) {
  if (informational || weight === 0) {
    checks.push({
      id,
      label,
      weight: 0,
      earned: 0,
      status: 'info',
      pass: true,
      informational: true,
      message,
    });
    return;
  }

  const e = typeof earned === 'number' ? earned : pass ? weight : 0;
  const status = statusFromEarned(e, weight);
  checks.push({
    id,
    label,
    weight,
    earned: Math.round(e * 1000) / 1000,
    status,
    pass: status === 'pass',
    informational: false,
    message,
  });
}

/**
 * Public-surface TLS / reachability — proportional across known sub-items when multi.
 * Live: fraction of public-facing services that are ACTIVE (Zerops L7 SSL covers them).
 * Sandbox: single platform fact (local agent already scored via demo patient + OpsMate API —
 * do not double-penalize those surfaces here).
 */
function scoreTlsSurface({ live, userServices, weight }) {
  if (live && userServices.length) {
    const publicish = userServices.filter((s) => {
      const n = String(s.name || '').toLowerCase();
      return /api|web|dash|front|ui|gateway|proxy|http|public|edge|static|www/.test(n);
    });
    const pool = publicish.length ? publicish : userServices;
    const passed = pool.filter((s) => isHealthyStatus(s.status)).length;
    const total = pool.length;
    const earned = total ? (passed / total) * weight : weight;
    return {
      earned,
      message:
        total === 0
          ? `Zerops L7 SSL available for httpSupport ports · ${weight}/${weight} pts`
          : `Public-facing fleet ${passed}/${total} ACTIVE (Zerops L7 TLS) · ${earned.toFixed(1)}/${weight} pts`,
    };
  }

  return {
    earned: weight,
    message: `Zerops L7 SSL for public httpSupport ports (platform) · ${weight}/${weight} pts`,
  };
}

/**
 * When a Zerops project is selected, score is primarily from live stack health.
 * score = round( sum(earned) / sum(weight) * 100 )
 */
async function computeHealthScore(opts = {}) {
  const demoUrl = process.env.DEMO_API_URL || 'http://localhost:3001';
  const checks = [];
  const live = Array.isArray(opts.projectServices) && opts.projectServices.length > 0;
  const services = opts.projectServices || [];
  const userServices = services.filter(
    (s) => !s.isSystem && String(s.name || '').toLowerCase() !== 'core'
  );

  if (live) {
    const active = userServices.filter((s) => isHealthyStatus(s.status)).length;
    const pending = userServices.filter((s) => isPendingDeploy(s.status)).length;
    const totalApps = userServices.length;

    pushCheck(checks, {
      id: 'live_project_linked',
      label: 'Zerops connection',
      weight: 12,
      pass: true,
      message: `Linked to Zerops project (${services.length} stacks, ${totalApps} app services)`,
    });

    {
      const weight = 28;
      const earned = scoreAppServices(active, totalApps, weight);
      pushCheck(checks, {
        id: 'app_services_active',
        label: 'Application services',
        weight,
        earned,
        message: `${active}/${totalApps || 0} application services ACTIVE · ${earned.toFixed(1)}/${weight} pts`,
      });
    }

    // Graduated deploy state (not binary cliff for N pending of many)
    {
      const weight = 18;
      const total = Math.max(totalApps, 1);
      const notPending = totalApps - pending;
      const earned = totalApps === 0 ? 0 : (notPending / totalApps) * weight;
      pushCheck(checks, {
        id: 'no_pending_deploys',
        label: 'Deploy state',
        weight,
        earned,
        message:
          pending === 0
            ? `No services stuck in READY_TO_DEPLOY · ${weight}/${weight} pts`
            : `${notPending}/${totalApps} ready · ${pending} pending first deploy · ${earned.toFixed(1)}/${weight} pts`,
      });
    }

    {
      const weight = 12;
      const earned = scoreAppServices(active, totalApps, weight);
      const ratio = totalApps ? active / totalApps : 0;
      pushCheck(checks, {
        id: 'fleet_ratio',
        label: 'Fleet health',
        weight,
        earned,
        message: `Fleet health ${(ratio * 100).toFixed(0)}% ACTIVE · ${earned.toFixed(1)}/${weight} pts`,
      });
    }
  } else {
    // One informational row only — does not earn or cost points
    pushCheck(checks, {
      id: 'sandbox_mode',
      label: 'Sandbox mode (no live project connected)',
      weight: 0,
      informational: true,
      message:
        'Local OpsMate agent mode. Connect a Zerops project to score live fleet connection status.',
    });
  }

  const demo = await probe(`${demoUrl}/`);
  pushCheck(checks, {
    id: 'local_patient_or_edge',
    label: live ? 'Edge probe (optional)' : 'Demo patient',
    weight: live ? 6 : 16,
    pass: demo.ok || live,
    message: demo.ok
      ? `demo patient reachable locally (${demo.ms}ms)`
      : live
        ? 'Local demo probe skipped weight (live project mode)'
        : `Local demo unreachable (${demo.error || demo.status})`,
  });

  if (!live) {
    const metrics = await probe(`${demoUrl}/metrics`);
    pushCheck(checks, {
      id: 'metrics',
      label: 'Metrics scrape',
      weight: 10,
      pass: metrics.ok,
      message: metrics.ok ? 'Local /metrics OK' : 'Local metrics unreachable',
    });
  }

  const self = await probe(`http://127.0.0.1:${process.env.PORT || 8080}/`);
  pushCheck(checks, {
    id: 'opsmate_api',
    label: 'OpsMate API',
    weight: 10,
    pass: self.ok,
    message: self.ok ? 'OpsMate api healthy' : 'OpsMate api self-probe failed',
  });

  {
    const weight = 6;
    const tls = scoreTlsSurface({
      live,
      userServices,
      weight,
    });
    pushCheck(checks, {
      id: 'ssl_surface',
      label: 'TLS / public surface',
      weight,
      earned: tls.earned,
      message: tls.message,
    });
  }

  const llmKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
  pushCheck(checks, {
    id: 'llm',
    label: 'AI diagnosis',
    weight: 6,
    pass: Boolean(llmKey),
    message: llmKey ? 'LLM configured' : 'Rule engine only (no LLM key)',
  });

  const openList = Array.isArray(opts.openIncidentList)
    ? opts.openIncidentList
    : Array.isArray(opts.openIncidents)
      ? opts.openIncidents
      : null;
  const rawOpenCount =
    openList != null
      ? openList.length
      : typeof opts.openIncidents === 'number'
        ? opts.openIncidents
        : 0;

  {
    const weight = INCIDENT_WEIGHT;
    const result = scoreOpenIncidents(openList != null ? openList : rawOpenCount, weight);
    const scoredN = result.scored.length;
    const infoN = result.excluded.length;
    let message;
    if (scoredN === 0 && infoN === 0) {
      message = `No open incidents · ${weight}/${weight} pts`;
    } else if (scoredN === 0 && infoN > 0) {
      message = `0 scoring incidents · ${infoN} informational (no-action / self-resolved) · ${weight}/${weight} pts`;
    } else {
      message = `${scoredN} scoring open incident(s) (−${result.deduction} pts)`;
      if (infoN) message += ` · ${infoN} informational excluded`;
      message += ` · ${result.earned.toFixed(1)}/${weight} pts`;
    }
    pushCheck(checks, {
      id: 'incidents',
      label: 'Open incidents',
      weight,
      earned: result.earned,
      message,
    });
    // Optional visibility for excluded noise (weight 0)
    if (infoN > 0) {
      pushCheck(checks, {
        id: 'informational_events',
        label: 'Informational events',
        weight: 0,
        informational: true,
        message: `${infoN} open event(s) excluded from score (no-action / resolved noise)`,
      });
    }
  }

  let earnedSum = 0;
  let totalW = 0;
  for (const c of checks) {
    if (c.informational || c.weight <= 0) continue;
    totalW += c.weight;
    earnedSum += typeof c.earned === 'number' ? c.earned : c.pass ? c.weight : 0;
  }

  const finalScore = Math.round((earnedSum / Math.max(totalW, 1)) * 100);

  return {
    score: finalScore,
    earnedWeight: Math.round(earnedSum * 1000) / 1000,
    totalWeight: totalW,
    checks,
    mode: live ? 'live-project' : 'sandbox',
    metrics: metricPoller.getLatest(),
    logBufferSize: logBuffer.size,
    ts: new Date().toISOString(),
  };
}

module.exports = {
  computeHealthScore,
  probe,
  scoreAppServices,
  scoreOpenIncidents,
  isExcludedFromHealthScoring,
  normalizeSeverity,
  SEVERITY_DEDUCTION,
  INCIDENT_WEIGHT,
};
