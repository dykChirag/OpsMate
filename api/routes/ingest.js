'use strict';

const { Router }      = require('express');
const logBuffer       = require('../services/logBuffer');
const { diagnose }    = require('../services/diagnosisEngine');
const metricPoller    = require('../services/metricPoller');

const router = Router();

/**
 * Gate which logs spawn a full diagnosis.
 * Chaos sims emit multiple lines per click — only the primary fire should diagnose.
 */
function shouldDiagnoseEntry(entry) {
  if (!entry || entry.skipDiagnose === true) return false;

  const msg = String(entry.message || '');
  const level = String(entry.level || 'info').toLowerCase();

  // Benign / secondary noise — never diagnose
  if (/health probe|metrics poll/i.test(msg)) return false;
  if (/resolved after delay/i.test(msg)) return false;
  if (/SIMULATE:.*resolved/i.test(msg)) return false;
  // Secondary pipeline log after intentional chaos (primary log already fires)
  if (/unhandled error in request pipeline/i.test(msg) && /intentional|simulat/i.test(msg + JSON.stringify(entry))) {
    return false;
  }
  // Duplicate "database query failed" after primary bad-query trigger line
  if (/SIMULATE: database query failed/i.test(msg) && entry.chaos === 'bad-query') {
    // Primary is "SIMULATE: bad-query endpoint triggered" — skip the follow-up
    return false;
  }

  // Explicit organic / metric kinds always diagnose
  const kind = entry.kind || entry.type;
  if (
    kind &&
    /app_latency|latency_spike|error_rate_spike|dep_timeout|resource/i.test(String(kind))
  ) {
    return true;
  }

  // Primary chaos fire (one per click)
  if (entry.chaos && /SIMULATE:.*(triggered|throwing)/i.test(msg)) return true;
  if (entry.chaos === 'slow' && /slow endpoint triggered/i.test(msg)) return true;

  // Real errors / warnings with failure signal
  const isErrLevel = ['error', 'critical', 'emergency', 'alert'].includes(level);
  const isWarnLevel = ['warn', 'warning'].includes(level);
  if (isErrLevel) return true;
  if (isWarnLevel && /fail|timeout|latency|budget|refused|exception|spike|threshold|dependency/i.test(msg)) {
    return true;
  }

  if (/econnrefused|etimedout|socket hang up/i.test(msg)) return true;

  return false;
}

// ─── POST /ingest ─────────────────────────────────────────────────────────────
// Accepts log entries from demo-api's fire-and-forget push.
// Body: { timestamp, service, level, message, ...meta }
// OR:   raw plain-text string (fallback)

router.post('/', async (req, res) => {
  let entry;

  if (typeof req.body === 'string') {
    entry = {
      timestamp: new Date().toISOString(),
      service:   'unknown',
      level:     'info',
      message:   req.body,
    };
  } else {
    entry = {
      timestamp: req.body.timestamp ?? new Date().toISOString(),
      service:   req.body.service   ?? 'unknown',
      level:     req.body.level     ?? 'info',
      message:   req.body.message   ?? JSON.stringify(req.body),
      ...req.body,
    };
  }

  // Always push to buffer
  logBuffer.push(entry);

  const willDiagnose = shouldDiagnoseEntry(entry);

  if (willDiagnose) {
    entry.source = entry.source || 'push';
    // Kick off async — do NOT await here so the HTTP response is instant
    setImmediate(async () => {
      try {
        const incident = await diagnose({
          serviceName: entry.service,
          logLines:    logBuffer.recent(30, { service: entry.service }),
          metrics:     metricPoller.getLatest(),
          triggerLog:  entry,
        });

        if (incident?.skipped) {
          console.log(JSON.stringify({
            timestamp: new Date().toISOString(), service: 'api', level: 'info',
            message: 'Diagnosis skipped',
            reason: incident.reason,
            serviceName: entry.service,
          }));
          return;
        }

        console.log(JSON.stringify({
          timestamp: new Date().toISOString(), service: 'api', level: 'info',
          message: incident?.deduped ? 'Incident deduped' : 'Incident diagnosed and stored',
          incidentId: incident.id,
          severity:   incident.severity,
          serviceName: entry.service,
          deduped: Boolean(incident.deduped),
        }));
      } catch (err) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(), service: 'api', level: 'error',
          message: 'Diagnosis pipeline error', error: err.message,
        }));
      }
    });
  }

  res.status(202).json({ ok: true, level: entry.level, willDiagnose });
});

module.exports = router;
module.exports.shouldDiagnoseEntry = shouldDiagnoseEntry;
