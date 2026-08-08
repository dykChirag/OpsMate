'use strict';

const { Router } = require('express');
const db = require('../db');
const zeropsApi = require('../services/zeropsApi');
const zeropsRoute = require('./zerops');
const { getProjectScope } = require('../services/projectScope');
const { sqlIsOpenStatus, countIncidentsByStatus } = require('../services/opsContext');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const scope = getProjectScope(req);
    const limit = Math.min(parseInt(req.query.limit || '80', 10), 200);
    const service = req.query.service ?? null;
    const severity = req.query.severity ?? null;
    const status = req.query.status ?? null;
    // Optional override: ?projectId=all for debug only stays scoped unless explicit
    const projectId = req.query.projectId === 'all'
      ? null
      : (req.query.projectId || scope.projectId);

    const conditions = [];
    const params = [];

    if (projectId) {
      params.push(projectId);
      // Exact project_id match — never COALESCE so other projects (or null) cannot leak in
      conditions.push(`project_id IS NOT DISTINCT FROM $${params.length}`);
    }
    if (service) {
      params.push(service);
      conditions.push(`service_name = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      conditions.push(`severity = $${params.length}`);
    }
    if (status) {
      if (String(status).toLowerCase() === 'open') {
        conditions.push(sqlIsOpenStatus('status'));
      } else if (String(status).toLowerCase() === 'resolved') {
        conditions.push(`LOWER(TRIM(COALESCE(status, 'open'))) <> 'open'`);
      } else {
        params.push(status);
        conditions.push(`COALESCE(status,'open') = $${params.length}`);
      }
    }

    params.push(limit);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT id, service_name, severity, title, explanation, suggested_fix,
              COALESCE(status,'open') AS status, COALESCE(source,'log') AS source,
              COALESCE(no_action, false) AS no_action,
              project_id, project_name, created_at, raw_context, fingerprint
       FROM incidents
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    );

    // Never surface LLM-provider-outage rows in the feed (legacy + safety net)
    const incidents = result.rows.filter((row) => {
      const blob = `${row.title || ''} ${row.explanation || ''} ${row.suggested_fix || ''}`;
      return !/diagnosis temporarily unavailable|both LLM providers|LLM providers failed/i.test(blob);
    });

    const counts = projectId
      ? await countIncidentsByStatus(projectId)
      : { open: 0, resolved: 0, total: 0 };

    res.json({
      ok: true,
      count: incidents.length,
      openCount: counts.open,
      resolvedCount: counts.resolved,
      totalCount: counts.total,
      projectId: projectId || 'all',
      projectName: scope.projectName,
      incidents,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch incidents', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM incidents WHERE id = $1`, [
      parseInt(req.params.id, 10),
    ]);
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, incident: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE incidents SET status = 'resolved' WHERE id = $1 RETURNING id, status`,
      [parseInt(req.params.id, 10)]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, incident: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/:id/fix', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM incidents WHERE id = $1`, [
      parseInt(req.params.id, 10),
    ]);
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'Not found' });
    const incident = result.rows[0];

    const token = zeropsRoute.getToken(req);
    const projectId = zeropsRoute.getSelectedProject(req);
    let fixResult = {
      action: 'manual',
      message: incident.suggested_fix || 'Review incident and act in Zerops GUI',
    };

    if (token && projectId) {
      try {
        const list = await zeropsApi.listProjectServices(token, projectId);
        if (list.ok) {
          const match = list.services.find(
            (s) => s.name === incident.service_name || s.id === incident.service_name
          );
          if (match?.id) {
            const rr = await zeropsApi.restartService(token, match.id);
            if (rr.ok) {
              fixResult = {
                action: 'restart',
                message: `Requested stack restart for ${match.name}`,
                serviceId: match.id,
              };
              await db.query(`UPDATE incidents SET status = 'resolved' WHERE id = $1`, [incident.id]);
            } else {
              fixResult = {
                action: 'restart_failed',
                message: rr.error?.message || 'Restart failed',
                detail: rr.error,
              };
            }
          }
        }
      } catch (e) {
        fixResult = { action: 'error', message: e.message };
      }
    }

    res.json({ ok: true, incident, fix: fixResult });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
