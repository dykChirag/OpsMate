'use strict';

const { Router } = require('express');
const db = require('../db');
const { computeHealthScore } = require('../services/healthScore');
const { reviewArchitectureYaml, resolveProjectYaml } = require('../services/architecture');
const {
  buildInsights,
  syncStatusIncidents,
  reviewFromLiveServices,
  guessedEdges,
  isHealthyStatus,
} = require('../services/projectInsights');
const logBuffer = require('../services/logBuffer');
const metricPoller = require('../services/metricPoller');
const zeropsApi = require('../services/zeropsApi');
const {
  resolveProjectScope,
  listOpenIncidents,
  countIncidentsByStatus,
  buildOpsContext,
  SANDBOX_INVENTORY,
} = require('../services/opsContext');

const router = Router();

const SANDBOX = SANDBOX_INVENTORY;

async function loadProjectContext(req) {
  const scope = resolveProjectScope(req);
  let projectServices = [];
  if (scope.token && scope.projectId && scope.projectId !== 'sandbox') {
    const list = await zeropsApi.listProjectServices(scope.token, scope.projectId);
    if (list.ok) projectServices = list.services;
  }
  return {
    token: scope.token,
    projectId: scope.projectId !== 'sandbox' ? scope.projectId : null,
    projectName: scope.projectName,
    projectServices,
    live: Boolean(
      scope.token && scope.projectId && scope.projectId !== 'sandbox' && projectServices.length
    ),
    connected: Boolean(scope.token),
    scopeMode: scope.mode,
  };
}

router.get('/', async (req, res) => {
  try {
    const ops = await buildOpsContext(req);
    const ctx = await loadProjectContext(req);

    // Prefer same health as chat (ops), then refresh after fleet→incident sync
    let openIncidentList = ops.openIncidents;
    let openIncidents = ops.openIncidentCount;
    let health = ops.health;

    let synced = [];
    if (ctx.live && ctx.projectId) {
      synced = await syncStatusIncidents(
        db,
        ctx.projectServices,
        ctx.projectName,
        ctx.projectId
      );
      // Always re-scope open incidents + rescore after fleet sync (matches /chat)
      openIncidentList = await listOpenIncidents(ctx.projectId, 100);
      const counts = await countIncidentsByStatus(ctx.projectId);
      openIncidents = counts.open;
      health = await computeHealthScore({
        zeropsConnected: ctx.connected,
        projectServices: ctx.projectServices,
        openIncidentList,
        openIncidents: counts.open,
      });
    } else {
      // Sandbox: trust ops counts (open only — never total)
      openIncidents = ops.openIncidentCount;
    }

    try {
      await db.query(
        `INSERT INTO health_snapshots (score, checks) VALUES ($1, $2::jsonb)`,
        [health.score, JSON.stringify(health.checks)]
      );
    } catch { /* */ }

    const insights = buildInsights(ctx.projectServices, ctx.projectName);
    const inventory = ctx.projectServices.length ? ctx.projectServices : SANDBOX;
    const edges = guessedEdges(inventory);

    const demoUrl = process.env.DEMO_API_URL || 'http://localhost:3001';
    let demoStatus = 'unknown';
    let demoMs = null;
    try {
      const axios = require('axios');
      const t0 = Date.now();
      await axios.get(`${demoUrl}/`, { timeout: 4000 });
      demoMs = Date.now() - t0;
      demoStatus = 'healthy';
    } catch {
      demoStatus = 'unreachable';
    }

    const activeCount = inventory.filter((s) => isHealthyStatus(s.status)).length;

    res.json({
      ok: true,
      ts: new Date().toISOString(),
      mode: ctx.live ? 'live-project' : ctx.connected ? 'connected-no-project' : 'sandbox',
      healthScore: health.score,
      health,
      openIncidents,
      zerops: {
        connected: ctx.connected,
        projectId: ctx.projectId,
        projectName: ctx.projectName,
        serviceCount: ctx.projectServices.length,
        activeCount,
        insights: insights.insights,
        summary: insights.summary,
      },
      services: {
        demo: {
          status: demoStatus,
          latencyMs: demoMs,
          metrics: metricPoller.getLatest(),
          recentLogs: logBuffer.recent(8),
        },
        api: {
          status: 'healthy',
          uptime: Math.floor(process.uptime()),
          logBuffer: logBuffer.size,
        },
      },
      inventory,
      topology: {
        nodes: inventory.map((s) => ({
          id: s.name || s.id,
          type: s.type,
          status: s.status,
        })),
        edges,
      },
      liveArchitecture: ctx.live
        ? reviewFromLiveServices(ctx.projectServices, ctx.projectName)
        : null,
      syncedIncidents: synced.length,
      llm: {
        configured: Boolean(process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY),
        model: process.env.OPENROUTER_MODEL || process.env.LLM_MODEL || null,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/health', async (req, res) => {
  try {
    const ops = await buildOpsContext(req);
    res.json({
      ok: true,
      mode: ops.live ? 'live-project' : ops.scope.mode,
      projectId: ops.projectId,
      projectName: ops.projectName,
      openIncidents: ops.openIncidentCount,
      ...ops.health,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** Live architecture from selected project inventory + project zerops.yaml snapshot */
router.get('/architecture/live', async (req, res) => {
  try {
    const ctx = await loadProjectContext(req);
    if (!ctx.live) {
      return res.status(400).json({
        ok: false,
        error: 'Select a Zerops project first (Connect → pick project)',
      });
    }

    let remoteYaml = null;
    if (ctx.token && ctx.projectServices.length) {
      try {
        const fr = await zeropsApi.tryFetchProjectYaml(ctx.token, ctx.projectServices);
        if (fr?.yaml) remoteYaml = fr.yaml;
      } catch {
        /* optional */
      }
    }

    const yamlPack = resolveProjectYaml({
      services: ctx.projectServices,
      projectName: ctx.projectName,
      remoteYaml,
    });

    const liveReview = reviewFromLiveServices(ctx.projectServices, ctx.projectName);
    const yamlReview = reviewArchitectureYaml(yamlPack.yaml);
    // Prefer yaml findings when we have a real/synthetic file; keep live score as secondary signal
    const review = {
      ...yamlReview,
      mode:
        yamlPack.source === 'live-inventory'
          ? 'import-reconstruct+live'
          : yamlPack.kind === 'import'
            ? 'project-import'
            : 'project-yaml',
      yamlSource: yamlPack.source,
      yamlKind: yamlPack.kind || yamlReview.kind,
      liveScore: liveReview.score,
      liveFindings: (liveReview.findings || []).slice(0, 8),
      summary: `${yamlReview.summary} Source: ${yamlPack.source}. Live fleet score ${liveReview.score}/100.`,
    };

    res.json({
      ok: true,
      projectId: ctx.projectId,
      projectName: ctx.projectName,
      yaml: yamlPack.yaml,
      yamlSource: yamlPack.source,
      yamlNote: yamlPack.note,
      yamlKind: yamlPack.kind || yamlReview.kind,
      canFetchExport: false,
      exportHint:
        'Zerops public REST cannot return GUI export. Project ⋮ → Export project as yaml, then paste + re-score.',
      review,
      inventory: ctx.projectServices,
      topology: {
        nodes: ctx.projectServices.map((s) => ({
          id: s.name,
          type: s.type,
          status: s.status,
        })),
        edges: guessedEdges(ctx.projectServices),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/architecture/review', async (req, res) => {
  try {
    const yaml = req.body?.yaml || req.body?.zerops_yaml || '';
    if (!yaml.trim()) {
      return res.status(400).json({ ok: false, error: 'yaml body required' });
    }
    const review = reviewArchitectureYaml(yaml);
    try {
      await db.query(
        `INSERT INTO architecture_reviews (score, summary, findings, zerops_yaml)
         VALUES ($1,$2,$3::jsonb,$4)`,
        [review.score, review.summary, JSON.stringify(review.findings), yaml]
      );
    } catch { /* */ }
    res.json({ ok: true, review, yamlKind: review.kind });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** Force re-sync fleet → incidents */
router.post('/sync-project', async (req, res) => {
  try {
    const ctx = await loadProjectContext(req);
    if (!ctx.live) {
      return res.status(400).json({ ok: false, error: 'No project selected' });
    }
    const created = await syncStatusIncidents(
      db,
      ctx.projectServices,
      ctx.projectName,
      ctx.projectId
    );
    res.json({
      ok: true,
      created: created.length,
      incidents: created,
      insights: buildInsights(ctx.projectServices, ctx.projectName),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
