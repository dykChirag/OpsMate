'use strict';

/**
 * Single source of truth for "current Zerops project" ops context.
 * Used by /status and /chat so health + incidents never disagree or leak projects.
 *
 * Fresh on every call — no module-level cache of health/incidents/services.
 */
const db = require('../db');
const { computeHealthScore } = require('./healthScore');
const zeropsApi = require('./zeropsApi');
const logBuffer = require('./logBuffer');
const metricPoller = require('./metricPoller');
const { syncStatusIncidents } = require('./projectInsights');

/** Local demo inventory — must match Services page fallback (not Zerops live). */
const SANDBOX_INVENTORY = [
  { id: 'demo', name: 'demo', type: 'runtime', status: 'running' },
  { id: 'api', name: 'api', type: 'runtime', status: 'running' },
  { id: 'dashboard', name: 'dashboard', type: 'runtime', status: 'running' },
  { id: 'db', name: 'db', type: 'database', status: 'running' },
];

/**
 * Prefer browser session over env when a PAT session exists.
 * body.projectId is NEVER trusted over an active Connect session.
 * Env ZEROPS_PROJECT_ID is only for headless/local without a session.
 */
const {
  getToken: resolveToken,
  getSelectedProject: resolveSelectedProject,
  getSelectedProjectName: resolveSelectedProjectName,
} = require('./reqAuth');

function resolveProjectScope(req) {
  // Bearer header and/or session (cross-origin uses Bearer; local uses cookie)
  const sessionToken = resolveToken(req);
  const sessionProjectId = resolveSelectedProject(req);
  const sessionProjectName = resolveSelectedProjectName(req);
  const envToken = process.env.ZEROPS_API_TOKEN || null;
  const envProjectId = process.env.ZEROPS_PROJECT_ID || null;
  const envProjectName = process.env.ZEROPS_PROJECT_NAME || null;
  const scopeSrc = (() => {
    const h = req.headers.authorization || req.headers.Authorization;
    if (h) return 'bearer';
    if (req.session?.zeropsToken) return 'session';
    return 'token';
  })();

  const bodyProjectIdRaw = req.body?.projectId ?? req.query?.projectId;
  const bodyProjectId =
    bodyProjectIdRaw != null && String(bodyProjectIdRaw).trim() !== ''
      ? String(bodyProjectIdRaw).trim()
      : null;
  const bodyProjectName =
    req.body?.projectName != null ? String(req.body.projectName) : null;

  // Active Connect session / Bearer: project from headers or server session
  if (sessionToken) {
    if (
      bodyProjectId &&
      sessionProjectId &&
      bodyProjectId !== sessionProjectId
    ) {
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          service: 'api',
          level: 'warn',
          message: 'Ignoring body.projectId — differs from session project',
          bodyProjectId,
          sessionProjectId,
        })
      );
    }

    if (sessionProjectId) {
      return {
        token: sessionToken,
        projectId: sessionProjectId,
        projectName: sessionProjectName ? String(sessionProjectName) : null,
        mode: 'live',
        source: scopeSrc,
      };
    }

    // Connected but no project selected — stay sandbox (do not trust body for a live project)
    return {
      token: sessionToken,
      projectId: 'sandbox',
      projectName: 'Local sandbox',
      mode: 'connected-no-project',
      source: scopeSrc,
    };
  }

  // No Connect session: body.projectId only used in local/sandbox (no Zerops PAT)
  if (envToken && envProjectId) {
    return {
      token: envToken,
      projectId: String(envProjectId),
      projectName: envProjectName ? String(envProjectName) : null,
      mode: 'live',
      source: 'env',
    };
  }

  if (bodyProjectId && bodyProjectId !== 'sandbox') {
    // Unauthenticated: may scope DB reads to that id, never grant Zerops inventory without a token
    return {
      token: null,
      projectId: bodyProjectId,
      projectName: bodyProjectName || null,
      mode: 'sandbox',
      source: 'body',
    };
  }

  return {
    token: envToken || null,
    projectId: 'sandbox',
    projectName: 'Local sandbox',
    mode: 'sandbox',
    source: bodyProjectId ? 'body' : 'none',
  };
}

/** Open status only — case-insensitive; null/empty treated as open. */
function sqlIsOpenStatus(column = 'status') {
  return `LOWER(TRIM(COALESCE(${column}, 'open'))) = 'open'`;
}

function sqlIsResolvedStatus(column = 'status') {
  return `LOWER(TRIM(COALESCE(${column}, 'open'))) <> 'open'`;
}

/**
 * Authoritative open-incident counts for a project (not truncated by list LIMIT).
 * @returns {{ open: number, resolved: number, total: number }}
 */
async function countIncidentsByStatus(projectId) {
  const pid = String(projectId || 'sandbox');
  try {
    const r = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE ${sqlIsOpenStatus('status')})::int AS open,
         COUNT(*) FILTER (WHERE ${sqlIsResolvedStatus('status')})::int AS resolved,
         COUNT(*)::int AS total
       FROM incidents
       WHERE project_id IS NOT DISTINCT FROM $1`,
      [pid]
    );
    const row = r.rows[0] || {};
    return {
      open: row.open || 0,
      resolved: row.resolved || 0,
      total: row.total || 0,
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'api',
        level: 'error',
        message: 'countIncidentsByStatus failed',
        projectId: pid,
        error: err.message,
      })
    );
    return { open: 0, resolved: 0, total: 0 };
  }
}

/** Open incidents strictly for one project (exact project_id, no cross-project bleed). */
async function listOpenIncidents(projectId, limit = 100) {
  const pid = String(projectId || 'sandbox');
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  try {
    const r = await db.query(
      `SELECT id, service_name, severity, title, explanation, suggested_fix,
              COALESCE(status,'open') AS status, COALESCE(source,'log') AS source,
              COALESCE(no_action, false) AS no_action,
              project_id, project_name, created_at
       FROM incidents
       WHERE ${sqlIsOpenStatus('status')}
         AND project_id IS NOT DISTINCT FROM $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [pid, lim]
    );
    return r.rows || [];
  } catch (err) {
    // Pre-migration fallback without no_action column
    if (/no_action/i.test(err.message || '')) {
      try {
        const r = await db.query(
          `SELECT id, service_name, severity, title, explanation, suggested_fix,
                  COALESCE(status,'open') AS status, COALESCE(source,'log') AS source,
                  project_id, project_name, created_at
           FROM incidents
           WHERE ${sqlIsOpenStatus('status')}
             AND project_id IS NOT DISTINCT FROM $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [pid, lim]
        );
        return (r.rows || []).map((row) => ({ ...row, no_action: false }));
      } catch {
        return [];
      }
    }
    // Never fall back to unscoped SELECT — that leaked other projects into chat/health
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'api',
        level: 'error',
        message: 'listOpenIncidents failed (returning empty, not unscoped)',
        projectId: pid,
        error: err.message,
      })
    );
    return [];
  }
}

/** Recent incidents (open + resolved) for chat evidence, still project-scoped. */
async function listRecentIncidents(projectId, limit = 12) {
  const pid = String(projectId || 'sandbox');
  try {
    const r = await db.query(
      `SELECT id, service_name, severity, title, explanation, suggested_fix,
              COALESCE(status,'open') AS status, COALESCE(source,'log') AS source,
              COALESCE(no_action, false) AS no_action,
              project_id, project_name, created_at
       FROM incidents
       WHERE project_id IS NOT DISTINCT FROM $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [pid, limit]
    );
    return r.rows || [];
  } catch {
    return listOpenIncidents(pid);
  }
}

/**
 * Live inventory: Zerops API when a project is selected.
 * Sandbox / connected-no-project: deterministic local demo inventory
 * (same list Services page shows).
 */
async function listServices(token, projectId, mode = 'sandbox') {
  if (token && projectId && projectId !== 'sandbox') {
    const list = await zeropsApi.listProjectServices(token, projectId);
    if (list.ok && Array.isArray(list.services) && list.services.length) {
      return list.services;
    }
    // Live project but empty/failed inventory — return [] (do not invent Zerops hosts)
    return [];
  }
  // Sandbox agent always has the local demo patient stack
  if (mode === 'sandbox' || mode === 'connected-no-project' || projectId === 'sandbox') {
    return SANDBOX_INVENTORY.map((s) => ({ ...s }));
  }
  return [];
}

/**
 * Full ops context for Health + Chat — fresh every call.
 * @param {object} req
 * @param {{ syncFleet?: boolean }} [opts]  syncFleet: fleet→incident then rescore (align /chat with /status)
 */
async function buildOpsContext(req, opts = {}) {
  const scope = resolveProjectScope(req);
  const services = await listServices(scope.token, scope.projectId, scope.mode);
  const serviceNames = () => services.map((s) => s.name).filter(Boolean);

  // Live if we have a token + real project id (inventory may be empty briefly — still "live")
  const liveProject = Boolean(
    scope.token && scope.projectId && scope.projectId !== 'sandbox'
  );

  if (opts.syncFleet && liveProject && services.length) {
    await syncStatusIncidents(db, services, scope.projectName, scope.projectId);
  }

  // Counts must not depend on list LIMIT (mixed recent-window under-counts are a UI trap)
  const counts = await countIncidentsByStatus(scope.projectId);
  let openIncidents = await listOpenIncidents(scope.projectId, 100);
  // Defense in depth: never let a non-open row into scoring/chat
  openIncidents = openIncidents.filter(
    (i) => String(i.status || 'open').trim().toLowerCase() === 'open'
  );
  const recentIncidents = await listRecentIncidents(scope.projectId, 12);

  // Live fleet scoring only when Zerops project is selected (sandbox inventory is for chat only)
  const health = await computeHealthScore({
    zeropsConnected: Boolean(scope.token),
    projectServices: liveProject ? services : [],
    openIncidentList: openIncidents,
    openIncidents: counts.open,
  });

  const live = liveProject && services.length > 0;
  // Live project: local demo log buffer is NOT this project's signal stream
  const recentLogs = liveProject ? [] : logBuffer.recent(20);

  return {
    scope,
    live,
    connected: Boolean(scope.token),
    projectId: scope.projectId,
    projectName: scope.projectName,
    services,
    serviceNames: serviceNames(),
    openIncidents,
    recentIncidents,
    openIncidentCount: counts.open,
    resolvedIncidentCount: counts.resolved,
    totalIncidentCount: counts.total,
    health,
    healthScore: health.score,
    healthEarned: health.earnedWeight,
    healthTotal: health.totalWeight,
    recentLogs,
    metrics: liveProject ? null : metricPoller.getLatest(),
  };
}

/** Compact JSON for LLM — no other projects, no ambient sandbox logs when live. */
function chatContextPayload(ops) {
  const names = ops.serviceNames || [];
  return {
    project: {
      id: ops.projectId,
      name: ops.projectName,
      mode: ops.scope.mode,
      source: ops.scope.source,
    },
    inventory: (ops.services || []).map((s) => ({
      name: s.name,
      status: s.status,
      type: s.type,
      isSystem: Boolean(s.isSystem),
    })),
    serviceNames: names,
    serviceCount: names.length,
    healthScore: ops.healthScore,
    healthEarnedWeight: ops.healthEarned,
    healthTotalWeight: ops.healthTotal,
    healthMode: ops.health?.mode,
    openIncidentCount: ops.openIncidentCount,
    resolvedIncidentCount: ops.resolvedIncidentCount ?? 0,
    openIncidents: (ops.openIncidents || []).map((i) => ({
      service_name: i.service_name,
      severity: i.severity,
      title: i.title,
      explanation: i.explanation,
      suggested_fix: i.suggested_fix,
      source: i.source,
      status: i.status || 'open',
      project_id: i.project_id,
      project_name: i.project_name,
      created_at: i.created_at,
    })),
    localAgentLogs:
      ops.scope?.mode === 'live' || (ops.projectId && ops.projectId !== 'sandbox')
        ? undefined
        : ops.recentLogs,
    localAgentMetrics:
      ops.scope?.mode === 'live' || (ops.projectId && ops.projectId !== 'sandbox')
        ? undefined
        : ops.metrics,
    _instruction:
      `Only discuss project "${ops.projectName || ops.projectId}". ` +
      `Services in inventory (${names.length}): ${names.join(', ') || '(none)'}. ` +
      `If inventory is non-empty you MUST NOT say services are missing or unlisted. ` +
      `Open incidents: ${ops.openIncidentCount} (resolved: ${ops.resolvedIncidentCount ?? 0}). ` +
      `Health score is ${ops.healthScore}/100. ` +
      `Numbers in this JSON are definitive for THIS turn — never treat open+resolved as "open".`,
  };
}

module.exports = {
  resolveProjectScope,
  listOpenIncidents,
  listRecentIncidents,
  countIncidentsByStatus,
  buildOpsContext,
  chatContextPayload,
  SANDBOX_INVENTORY,
  sqlIsOpenStatus,
};
