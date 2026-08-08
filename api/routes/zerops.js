'use strict';

const { Router } = require('express');
const zeropsApi  = require('../services/zeropsApi');

const router = Router();

function getToken(req) {
  return req.session?.zeropsToken
    || process.env.ZEROPS_API_TOKEN
    || null;
}

function getSelectedProject(req) {
  // Session wins — don't override a connected GUI with env OpsMate project
  if (req.session?.zeropsToken) {
    return req.session.zeropsProjectId || null;
  }
  return process.env.ZEROPS_PROJECT_ID || null;
}

// POST /zerops/connect  { token }
router.post('/connect', async (req, res) => {
  const token = (req.body?.token ?? '').trim();
  if (!token) return res.status(400).json({ ok: false, error: 'token is required' });

  const v = await zeropsApi.validateToken(token);
  if (!v.ok) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid token or Zerops API unreachable',
      detail: v.error,
    });
  }

  req.session.zeropsToken = token;
  req.session.zeropsClientIds = v.clientIds || [];
  delete req.session.zeropsProjectId;
  delete req.session.zeropsProjectName;

  const projects = await zeropsApi.listProjects(token, v.clientIds || []);
  if (!projects.ok) {
    return res.json({
      ok: true,
      user: v.user,
      projects: [],
      projectsError:
        projects.error?.message ||
        'Connected, but could not list projects. Try Refresh projects.',
      clientIds: v.clientIds || [],
      debug: projects.debug,
    });
  }

  res.json({
    ok: true,
    user: v.user,
    projects: projects.projects,
    projectsError: projects.projects.length
      ? null
      : 'API returned zero projects for your client. Check org access on the token.',
    clientIds: v.clientIds || [],
    source: projects.source,
  });
});

router.post('/disconnect', (req, res) => {
  delete req.session.zeropsToken;
  delete req.session.zeropsProjectId;
  delete req.session.zeropsProjectName;
  delete req.session.zeropsClientIds;
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.json({
      ok: true,
      connected: false,
      selectedProjectId: null,
      source: null,
    });
  }
  const v = await zeropsApi.validateToken(token);
  if (!v.ok) {
    delete req.session.zeropsToken;
    return res.json({ ok: true, connected: false });
  }
  res.json({
    ok: true,
    connected: true,
    user: v.user,
    selectedProjectId: getSelectedProject(req),
    selectedProjectName: req.session.zeropsProjectName || null,
    source: req.session.zeropsToken ? 'session' : 'env',
  });
});

router.get('/projects', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Connect a Zerops token first' });

  const clientIds = req.session?.zeropsClientIds || [];
  const r = await zeropsApi.listProjects(token, clientIds);
  if (!r.ok) {
    return res.status(502).json({
      ok: false,
      error: 'Failed to list projects',
      detail: r.error,
      debug: r.debug,
    });
  }
  res.json({
    ok: true,
    projects: r.projects,
    selectedProjectId: getSelectedProject(req),
    count: r.projects.length,
    source: r.source,
    debug: r.debug,
  });
});

// POST /zerops/select-project { projectId, projectName? }
router.post('/select-project', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Not connected' });

  const projectId = req.body?.projectId;
  if (!projectId) return res.status(400).json({ ok: false, error: 'projectId required' });

  req.session.zeropsProjectId = String(projectId);
  if (req.body.projectName) req.session.zeropsProjectName = String(req.body.projectName);

  const services = await zeropsApi.listProjectServices(token, projectId);

  // Tag status-derived incidents to this project on select
  let synced = 0;
  if (services.ok && services.services?.length) {
    try {
      const db = require('../db');
      const { syncStatusIncidents } = require('../services/projectInsights');
      const created = await syncStatusIncidents(
        db,
        services.services,
        req.session.zeropsProjectName || null,
        req.session.zeropsProjectId
      );
      synced = created.length;
    } catch { /* best-effort */ }
  }

  res.json({
    ok: true,
    projectId: req.session.zeropsProjectId,
    projectName: req.session.zeropsProjectName || null,
    services: services.ok ? services.services : [],
    servicesError: services.ok ? null : services.error,
    syncedIncidents: synced,
  });
});

// GET /zerops/services — inventory of selected project
router.get('/services', async (req, res) => {
  const token = getToken(req);
  const projectId = getSelectedProject(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Not connected' });
  if (!projectId) {
    return res.status(400).json({
      ok: false,
      error: 'No project selected — POST /zerops/select-project first',
    });
  }

  const r = await zeropsApi.listProjectServices(token, projectId);
  if (!r.ok) {
    return res.status(502).json({ ok: false, error: 'Failed to list services', detail: r.error });
  }
  res.json({
    ok: true,
    projectId,
    projectName: req.session.zeropsProjectName || null,
    services: r.services,
    edges: [
      { from: 'dashboard', to: 'api', label: 'HTTP' },
      { from: 'api', to: 'db', label: 'Postgres' },
      { from: 'demo', to: 'api', label: 'ingest' },
      { from: 'logger', to: 'api', label: 'syslog' },
    ],
  });
});

// POST /zerops/restart { serviceId | serviceName, incidentId? }
router.post('/restart', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Not connected' });

  let serviceId = req.body?.serviceId;
  const serviceName = req.body?.serviceName;
  const projectId = getSelectedProject(req);

  if (!serviceId && serviceName && projectId) {
    const list = await zeropsApi.listProjectServices(token, projectId);
    if (list.ok) {
      const hit = list.services.find(
        (s) => String(s.name).toLowerCase() === String(serviceName).toLowerCase()
      );
      if (hit) serviceId = hit.id;
    }
  }

  if (!serviceId) {
    return res.status(400).json({
      ok: false,
      error: 'serviceId or resolvable serviceName required',
    });
  }

  const result = await zeropsApi.restartService(token, serviceId);

  // Best-effort audit (ignore if migration missing columns)
  try {
    const db = require('../db');
    await db.query(
      `INSERT INTO agent_actions (incident_id, action_type, service_name, payload, result)
       VALUES ($1,'restart',$2,$3,$4)`,
      [
        req.body?.incidentId || null,
        serviceName || String(serviceId),
        JSON.stringify({ serviceId }),
        JSON.stringify(result),
      ]
    );
  } catch { /* optional */ }

  res.status(result.ok ? 200 : 502).json({
    ok: result.ok,
    mode: result.ok ? 'zerops-api' : 'failed',
    result,
  });
});

module.exports = router;
module.exports.getToken = getToken;
module.exports.getSelectedProject = getSelectedProject;
