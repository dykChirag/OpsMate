'use strict';

/**
 * Turn live Zerops service statuses into ops insights / incidents.
 * This is the path for "real project" awareness without needing platform log export.
 */

function isHealthyStatus(status) {
  const s = String(status || '').toUpperCase();
  // ACTIVE is happy; READY alone is often READY_TO_DEPLOY which is NOT healthy
  if (s === 'ACTIVE' || s === 'RUNNING' || s === 'OK' || s === 'UP') return true;
  if (/^READY_TO_DEPLOY$/i.test(s)) return false;
  if (/ACTIVE|RUNNING/.test(s) && !/READY_TO_DEPLOY|FAILED|STOPPED/.test(s)) return true;
  return false;
}

function isFailedStatus(status) {
  const s = String(status || '').toUpperCase();
  return /FAIL|ERROR|CRASH|STOP|DEAD|DOWN/.test(s);
}

function isPendingDeploy(status) {
  const s = String(status || '').toUpperCase();
  return /READY_TO_DEPLOY|PENDING|BUILD|DEPLOYING|CREATING/.test(s);
}

/**
 * Non-persisted insight cards for UI.
 */
function buildInsights(services = [], projectName = null) {
  const insights = [];
  const list = Array.isArray(services) ? services : [];
  const userServices = list.filter((s) => !s.isSystem && String(s.name).toLowerCase() !== 'core');
  const active = userServices.filter((s) => isHealthyStatus(s.status));
  const pending = userServices.filter((s) => isPendingDeploy(s.status));
  const failed = userServices.filter((s) => isFailedStatus(s.status));

  for (const s of pending) {
    insights.push({
      id: `status-${s.id || s.name}-pending`,
      event_key: 'pending-deploy',
      service_name: s.name,
      service_id: s.id || null,
      severity: 'medium',
      title: `${s.name} not deployed`,
      explanation: `Service "${s.name}" is ${s.status} in project ${projectName || 'selected'}. Zero traffic / code may be missing — deploy with zcli push or Git pipeline.`,
      suggested_fix: `Open Zerops → service ${s.name} → deploy your code (zerops.yaml setup must match hostname "${s.name}").`,
      source: 'zerops-status',
      status: 'open',
      created_at: new Date().toISOString(),
    });
  }

  for (const s of failed) {
    const stopped = /STOP/i.test(String(s.status || ''));
    insights.push({
      id: `status-${s.id || s.name}-failed`,
      event_key: stopped ? 'stopped' : 'unhealthy',
      service_name: s.name,
      service_id: s.id || null,
      severity: 'high',
      title: `${s.name} unhealthy (${s.status})`,
      explanation: `Zerops reports "${s.name}" as ${s.status}. Runtime may be offline or pipeline failed.`,
      suggested_fix: `Check Zerops runtime logs for ${s.name}, last pipeline, then restart stack or redeploy.`,
      source: 'zerops-status',
      status: 'open',
      created_at: new Date().toISOString(),
    });
  }

  if (userServices.length >= 2 && active.length === userServices.length) {
    insights.push({
      id: 'status-project-healthy',
      event_key: 'all-active',
      service_name: projectName || 'project',
      severity: 'low',
      title: 'All user services ACTIVE',
      explanation: `${active.length}/${userServices.length} application services are ACTIVE in ${projectName || 'this project'}.`,
      suggested_fix: 'No immediate action needed — keep monitoring logs and metrics.',
      source: 'zerops-status',
      status: 'info',
      created_at: new Date().toISOString(),
    });
  }

  return {
    insights,
    summary: {
      total: list.length,
      userServices: userServices.length,
      active: active.length,
      pending: pending.length,
      failed: failed.length,
      projectName,
    },
  };
}

/**
 * Insert open incidents for degraded live services (deduped by fingerprint).
 */
/**
 * @param {object} db
 * @param {array} services
 * @param {string|null} projectName
 * @param {string} projectId  required — incidents are scoped per Zerops project
 */
async function syncStatusIncidents(db, services, projectName, projectId) {
  if (!projectId) return [];

  const { insights } = buildInsights(services, projectName);
  const actionable = insights.filter((i) => i.severity === 'medium' || i.severity === 'high');
  const created = [];

  for (const ins of actionable) {
    // Stable key: project + service + event class (NOT free-text title)
    const fingerprint = `zerops-status|${projectId}|${ins.service_name}|${ins.event_key || 'status'}`;
    try {
      // Dedup while any open incident exists (no rolling 2h re-open spam)
      const existing = await db.query(
        `SELECT id FROM incidents
         WHERE fingerprint = $1
           AND project_id IS NOT DISTINCT FROM $2
           AND COALESCE(status,'open') = 'open'
         LIMIT 1`,
        [fingerprint, projectId]
      );
      if (existing.rowCount) continue;

      const noAction = /no action needed|no immediate action|nothing to do/i.test(
        String(ins.suggested_fix || '')
      );
      const r = await db.query(
        `INSERT INTO incidents
           (service_name, severity, title, status, source, raw_context, explanation, suggested_fix, fingerprint, project_id, project_name, no_action)
         VALUES ($1,$2,$3,'open','zerops-status',$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, service_name, severity, title, explanation, suggested_fix, created_at, status, source, project_id, project_name, no_action`,
        [
          ins.service_name,
          ins.severity,
          ins.title,
          JSON.stringify({
            projectId,
            projectName,
            statusInsight: true,
            service_name: ins.service_name,
            service_id: ins.service_id || null,
            event_key: ins.event_key,
            title: ins.title,
            severity: ins.severity,
            explanation: ins.explanation,
            suggested_fix: ins.suggested_fix,
            no_action: noAction,
          }),
          ins.explanation,
          ins.suggested_fix,
          fingerprint,
          projectId,
          projectName || null,
          noAction,
        ]
      );
      created.push(r.rows[0]);
    } catch {
      /* best-effort */
    }
  }

  return created;
}

/**
 * Architecture-style review from live inventory (no yaml required).
 */
function reviewFromLiveServices(services = [], projectName = null) {
  const findings = [];
  const list = Array.isArray(services) ? services : [];
  const names = list.map((s) => s.name);
  const user = list.filter((s) => !s.isSystem && String(s.name).toLowerCase() !== 'core');

  const hasApi = names.some((n) => /api|backend/i.test(n));
  const hasDash = names.some((n) => /dash|web|front|ui/i.test(n));
  const hasDb = names.some((n) => /db|postgres|mysql|mongo/i.test(n));
  const hasDemo = names.some((n) => /demo/i.test(n));
  const pending = user.filter((s) => isPendingDeploy(s.status));
  const hyphens = names.filter((n) => String(n).includes('-'));

  if (hyphens.length) {
    findings.push({
      level: 'critical',
      title: 'Hyphen in hostname',
      detail: `Zerops hostnames cannot use "-": ${hyphens.join(', ')}`,
      fix: 'Rename services to alphanumeric hostnames (no hyphens) in Zerops.',
    });
  }

  for (const s of pending) {
    findings.push({
      level: 'warn',
      title: `${s.name}: ${s.status}`,
      detail: 'Service exists but has no successful deploy yet. Push code with matching setup name.',
      fix: `Deploy with zarop/zcli or Git pipeline — zerops.yaml setup must match hostname "${s.name}".`,
    });
  }

  if (hasApi && !hasDb) {
    findings.push({
      level: 'info',
      title: 'API without database service in project',
      detail: 'If the API needs persistence, add managed Postgres (or confirm external DB).',
      fix: 'Import a postgresql service named db and link DATABASE_URL into api.',
    });
  }

  if (hasDash && hasApi) {
    findings.push({
      level: 'info',
      title: 'Frontend + API present',
      detail: 'Good multi-service shape for Zerops private networking. Point dashboard public env to the api URL.',
      fix: 'Set PUBLIC_API_URL (or similar) on dashboard to the api public subdomain.',
    });
  }

  if (hasDemo && hasApi) {
    findings.push({
      level: 'info',
      title: 'Patient demo + brain api',
      detail: 'Ideal for OpsMate: demo generates signals; api diagnoses. Wire API_INGEST_URL=http://api:8080/ingest on demo.',
      fix: 'On demo env: API_INGEST_URL=http://api:8080/ingest',
    });
  }

  if (!hasDash && hasApi) {
    findings.push({
      level: 'info',
      title: 'No dashboard service',
      detail: 'Optional static/SSR UI helps operators and hackathon demos.',
      fix: 'Add a dashboard runtime with httpSupport if you want a public ops UI.',
    });
  }

  let score = 100;
  for (const f of findings) {
    if (f.level === 'critical') score -= 25;
    else if (f.level === 'warn') score -= 14;
    else score -= 3;
  }
  const activeN = user.filter((s) => isHealthyStatus(s.status)).length;
  if (user.length) {
    score = Math.round(score * 0.55 + (activeN / user.length) * 45);
  }
  score = Math.max(5, Math.min(100, score));

  return {
    score,
    findings,
    summary: projectName
      ? `Live review of “${projectName}”: ${activeN}/${user.length} app services ACTIVE, score ${score}/100.`
      : `Live inventory review: score ${score}/100.`,
    services: names,
    mode: 'live-inventory',
  };
}

function guessedEdges(services = []) {
  const names = new Set(services.map((s) => s.name));
  const edges = [];
  if (names.has('dashboard') && names.has('api')) edges.push({ from: 'dashboard', to: 'api', label: 'HTTP' });
  if (names.has('api') && names.has('db')) edges.push({ from: 'api', to: 'db', label: 'Postgres' });
  if (names.has('demo') && names.has('api')) edges.push({ from: 'demo', to: 'api', label: 'ingest' });
  if (names.has('api')) edges.push({ from: 'logger', to: 'api', label: 'syslog:5514' });
  // generic
  if (!edges.length) {
    const user = services.filter((s) => !s.isSystem).map((s) => s.name);
    for (let i = 0; i < user.length - 1; i++) {
      edges.push({ from: user[i], to: user[i + 1], label: 'network' });
    }
  }
  return edges;
}

module.exports = {
  buildInsights,
  syncStatusIncidents,
  reviewFromLiveServices,
  guessedEdges,
  isHealthyStatus,
  isPendingDeploy,
};
