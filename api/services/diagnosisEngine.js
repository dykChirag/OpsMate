'use strict';

const db = require('../db');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-20b:free';
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 12_000);
const DIAGNOSIS_MAX_TOKENS = Number(process.env.DIAGNOSIS_MAX_TOKENS || 450);
const CHAT_MAX_TOKENS = Number(process.env.CHAT_MAX_TOKENS || 1400);
/** Cooldown between incidents for the same event fingerprint (reduces chaos spam). */
const DEDUPE_COOLDOWN_MS = Number(process.env.INCIDENT_DEDUPE_MS || 120_000);
/** LLM retry policy when both providers fail. */
const LLM_RETRY_ATTEMPTS = Number(process.env.LLM_RETRY_ATTEMPTS || 3);
const LLM_RETRY_BASE_MS = Number(process.env.LLM_RETRY_BASE_MS || 800);

const SYSTEM_PROMPT = `You are OpsMate, an AI SRE for Zerops (PaaS with projects, services, private hostnames, managed DB, syslog, Prometheus scrape).
Return ONLY valid JSON (no markdown):
{
  "severity": "low"|"medium"|"high"|"critical",
  "title": "short title",
  "explanation": "1-3 sentence plain-English root cause grounded in evidence",
  "suggestedFix": "short actionable fix list (numbered steps preferred)"
}
Rules:
- do not invent services; never echo secrets; if evidence is thin say so
- title should be stable and short (e.g. "latency spike", not decorative variants)
- suggestedFix must be production-useful multi-step remediation whenever there is a failure, latency, DB error, crash, or metric anomaly
- NEVER publish "Diagnosis temporarily unavailable" or comment on AI/LLM providers
- For SIMULATE/chaos-tagged logs: explain they may be demo triggers, but STILL give real production-style steps (check logs, private DNS, DB linkage, restart). Do NOT answer only with "no action needed / deliberate chaos test"
- Reserve pure no-action only for truly benign noise with zero failure evidence (and keep severity low)`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ruleDiagnose({ serviceName, message, severity, context = {} }) {
  const msg = `${message} ${JSON.stringify(context)}`.toLowerCase();
  const chaos = context.chaos || context.type;
  const kind = context.kind || context.type;

  if (kind === 'app_latency' || kind === 'latency_spike' || chaos === 'latency_spike') {
    return {
      severity: 'medium',
      title: `${serviceName} latency budget breach`,
      explanation:
        'Application request latency exceeded the configured budget. Evidence points to a slow path in the request pipeline (handler, dependency RTT, or DB round-trip), not an AI-side failure.',
      suggestedFix:
        '1. Confirm avg_latency_ms and the slow route in metrics. 2. Trace the handler with the highest p95. 3. Check private-network RTT to upstream services and Postgres. 4. Cap concurrent work or add timeouts; restart only if the process is wedged.',
    };
  }
  if (kind === 'error_rate_spike' || chaos === 'error_rate_spike') {
    return {
      severity: 'high',
      title: `${serviceName} elevated error rate`,
      explanation:
        'Error rate in the last poll window crossed the health threshold. New failures are outpacing healthy traffic.',
      suggestedFix:
        '1. Sample recent 5xx / error-level logs. 2. Identify failing dependency or exception hotspot. 3. Roll back or hotfix the bad path. 4. Restart the stack only after the root error is understood.',
    };
  }
  if (kind === 'dep_timeout' || /dependency|upstream.*timeout|ETIMEDOUT|socket hang up/i.test(msg)) {
    return {
      severity: 'high',
      title: `${serviceName} dependency timeout`,
      explanation:
        'The application failed waiting on an upstream dependency. Timeouts like this usually mean the peer is slow, unreachable on the private network, or saturated.',
      suggestedFix:
        '1. Verify the dependency hostname resolves on the Zerops private network. 2. Check peer health and connection limits. 3. Lower client timeouts with retries+jitter if appropriate. 4. Restart the caller only if connections are stuck open.',
    };
  }
  if (kind === 'resource' || /memory|cpu|resource threshold|heap|OOM/i.test(msg)) {
    return {
      severity: 'high',
      title: `${serviceName} resource pressure`,
      explanation:
        'A resource threshold was breached (CPU, memory, or heap pressure). Left alone this often becomes latency spikes or restarts.',
      suggestedFix:
        '1. Confirm container size / autoscaling limits in Zerops. 2. Inspect memory growth and top allocations. 3. Reduce concurrent work or raise limits. 4. Redeploy if the process is already thrashing.',
    };
  }
  if (chaos === 'error-storm' || /error storm|burst of 5xx/i.test(msg)) {
    return {
      severity: 'high',
      title: `${serviceName} error storm`,
      explanation:
        'A burst of 5xx / failed requests was recorded. In production this often means a bad deploy, dependency outage, or retry amplification.',
      suggestedFix:
        '1. Sample failing request paths in logs. 2. Check upstream health and rate limits. 3. Roll back the last deploy if error rate tracks a release. 4. Restart only if workers are wedged after the fix.',
    };
  }
  if (chaos === 'dep-timeout') {
    return {
      severity: 'high',
      title: `${serviceName} dependency timeout`,
      explanation:
        'The service waited on an upstream dependency past its timeout. Peers may be slow, unreachable, or saturated on the private network.',
      suggestedFix:
        '1. Verify dependency hostname resolution. 2. Check peer health and connection pools. 3. Add client timeouts with bounded retries. 4. Restart the caller only if connections remain stuck.',
    };
  }
  if (chaos === 'memory') {
    return {
      severity: 'high',
      title: `${serviceName} memory pressure`,
      explanation:
        'Memory pressure crossed a soft threshold. Left alone this often becomes latency spikes or OOM kills.',
      suggestedFix:
        '1. Confirm container size limits in Zerops. 2. Inspect heap growth and top allocators. 3. Reduce concurrency or raise limits. 4. Redeploy if the process is thrashing.',
    };
  }
  if (chaos === 'slow' || /slow|latency|delay|timeout/.test(msg)) {
    return {
      severity: 'medium',
      title: `${serviceName} latency spike`,
      explanation:
        'The service responded slowly. Matches high latency on a request path — either simulated load or a real upstream delay beyond normal bounds.',
      suggestedFix:
        '1. Capture p95/p99 for the slow route. 2. Check upstream latency and DB query time. 3. Add timeouts and circuit breakers. 4. Restart the stack only if workers are wedged.',
    };
  }
  if (chaos === 'bad-query' || /database|econnrefused|relation .* does not exist|postgres|sql/.test(msg)) {
    return {
      severity: 'high',
      title: `${serviceName} database failure`,
      explanation:
        'Logs show a database connectivity or query failure. On Zerops this usually means missing env linkage to managed Postgres or a bad SQL path.',
      suggestedFix:
        '1. In Zerops GUI verify db is Active. 2. Link connection env vars into the runtime. 3. Use the private hostname `db` and correct schema. 4. Redeploy the dependent service after env is fixed.',
    };
  }
  if (chaos === 'crash' || /crash|unhandled|exception|exit|sigterm/.test(msg)) {
    return {
      severity: 'critical',
      title: `${serviceName} process crash`,
      explanation:
        'The process threw an unhandled exception or exited unexpectedly. Zerops will restart containers; repeated exits indicate a crash loop.',
      suggestedFix:
        '1. Inspect runtime logs around the failure. 2. Fix the error path in code. 3. Redeploy from the Zerops pipeline. 4. Confirm health probes stay green for several restarts.',
    };
  }
  if (/error|5\d\d|failed|fail/.test(msg) || severity === 'error') {
    return {
      severity: 'high',
      title: `${serviceName} error storm`,
      explanation: `Error-level signals were ingested: ${String(message).slice(0, 180)}`,
      suggestedFix:
        '1. Open the incident evidence and match the exception. 2. Check private DNS between services. 3. Verify managed dependencies are Active. 4. Restart only if containers are unhealthy after the fix.',
    };
  }
  return {
    severity: 'low',
    title: `${serviceName} event`,
    explanation: message || 'Anomalous event with limited context.',
    suggestedFix:
      '1. Keep monitoring for recurrence. 2. Corroborate with metrics if the signal repeats. 3. Escalate only if severity increases.',
  };
}

function fingerprintOf(serviceName, message, level, projectId = 'sandbox', triggerLog = {}) {
  const eventKey = classifyEvent(message, level, triggerLog);
  return `${projectId}|${serviceName}|${eventKey}`;
}

function classifyEvent(message, level, triggerLog = {}) {
  const chaos = triggerLog.chaos || triggerLog.type;
  const kind = triggerLog.kind || triggerLog.type;
  if (kind === 'app_latency' || kind === 'latency_spike') return 'signal:app_latency';
  if (kind === 'error_rate_spike') return 'signal:error_rate';
  if (kind === 'dep_timeout') return 'signal:dep_timeout';
  if (kind === 'resource') return 'signal:resource';
  if (chaos && !String(chaos).startsWith('signal:')) {
    if (/latency_spike|error_rate|app_latency|dep_timeout|resource/i.test(String(chaos))) {
      return `signal:${String(chaos).toLowerCase()}`;
    }
    if (chaos === 'memory') return 'chaos:memory';
    if (chaos === 'error-storm') return 'chaos:error-storm';
    return `chaos:${String(chaos).toLowerCase()}`;
  }

  const msg = String(message || '').toLowerCase();
  if (/simulat|chaos/.test(msg) && /slow|latency|delay/.test(msg)) return 'chaos:slow';
  if (/simulat|chaos|intentional/.test(msg) && /crash|500|exception/.test(msg)) return 'chaos:crash';
  if (/simulat|chaos|bad.?query|table_that_does_not|relation .* does not exist/.test(msg)) {
    return 'chaos:bad-query';
  }
  if (/dependency|upstream.*timeout|etimedout/.test(msg)) return 'signal:dep_timeout';
  if (/resource threshold|heap|memory pressure|cpu throttle/.test(msg)) return 'signal:resource';
  if (/econnrefused|database|postgres|sql/.test(msg)) return 'signal:db';
  if (/timeout|latency|slow|budget/.test(msg)) return 'signal:latency';
  if (/crash|unhandled|sigterm|oom/.test(msg)) return 'signal:crash';
  if (/error|fail|5\d\d/.test(msg) || level === 'error') return 'signal:error';

  const norm = msg
    .replace(/\d+/g, 'N')
    .replace(/\b(event|detected|triggered|chaos|simulat\w*|endpoint)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `msg:${norm || level || 'info'}`;
}

async function findOpenDupe(fingerprint, projectId = 'sandbox') {
  try {
    const r = await db.query(
      `SELECT id, severity, title, explanation, suggested_fix, created_at, service_name, status
       FROM incidents
       WHERE fingerprint = $1
         AND project_id IS NOT DISTINCT FROM $2
         AND COALESCE(status,'open') = 'open'
       ORDER BY created_at DESC
       LIMIT 1`,
      [fingerprint, projectId]
    );
    return r.rows[0] || null;
  } catch {
    return null;
  }
}

async function findRecentDupe(fingerprint, projectId = 'sandbox', windowMs = DEDUPE_COOLDOWN_MS) {
  try {
    const r = await db.query(
      `SELECT id, severity, title, explanation, suggested_fix, created_at, service_name, status
       FROM incidents
       WHERE fingerprint = $1
         AND project_id IS NOT DISTINCT FROM $2
         AND created_at > NOW() - ($3::text || ' milliseconds')::interval
       ORDER BY created_at DESC
       LIMIT 1`,
      [fingerprint, projectId, String(windowMs)]
    );
    return r.rows[0] || null;
  } catch {
    return null;
  }
}

function sanitizeSuggestedFix(fix) {
  let s = String(fix || '').trim();
  if (!s) return 'Investigate logs on Zerops.';

  if (/llm provider|diagnosis temporarily unavailable|both LLM/i.test(s)) {
    return '1. Investigate application logs on Zerops. 2. Confirm dependencies are healthy. 3. Retry diagnosis after evidence is refreshed.';
  }

  const noAction = /no immediate action|no action needed|nothing to do/i.test(s);
  const hasMore =
    (s.match(/\d+\./g) || []).length >= 2 ||
    (s.match(/\.\s+[A-Z]/g) || []).length >= 2;

  if (noAction && hasMore) {
    s = s
      .replace(/\d+\.\s*(No immediate action needed|no action needed)\.?\s*/gi, '')
      .replace(/(No immediate action needed|no action needed)\.?\s*/gi, '')
      .trim();

    const steps = [];
    const re = /(?:^|\s)(\d+)\.\s+([^]+?)(?=(?:\s+\d+\.\s+)|$)/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const body = m[2].replace(/\s+/g, ' ').trim();
      if (body && !/no immediate action|no action needed/i.test(body)) steps.push(body);
    }
    if (steps.length) {
      s = steps.map((t, i) => `${i + 1}. ${t}`).join(' ');
    } else {
      s = s.replace(/^\s*\d+\.\s*/, '').trim();
    }
  }
  return s || 'Investigate logs on Zerops.';
}

async function fetchChatCompletions(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`LLM HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function callGroq(messages, opts = {}) {
  if (!GROQ_API_KEY) {
    const err = new Error('Groq API key not configured');
    err.status = 0;
    throw err;
  }
  return fetchChatCompletions(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    {
      model: GROQ_MODEL,
      temperature: opts.temperature ?? 0.15,
      max_tokens: opts.max_tokens ?? DIAGNOSIS_MAX_TOKENS,
      messages,
    }
  );
}

async function callOpenRouter(messages, opts = {}) {
  if (!OPENROUTER_API_KEY) {
    const err = new Error('OpenRouter API key not configured');
    err.status = 0;
    throw err;
  }
  return fetchChatCompletions(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://opsmate.zerops.app',
      'X-Title': opts.xTitle || 'OpsMate — AI SRE for Zerops',
    },
    {
      model: OPENROUTER_MODEL,
      temperature: opts.temperature ?? 0.15,
      max_tokens: opts.max_tokens ?? DIAGNOSIS_MAX_TOKENS,
      messages,
    }
  );
}

async function diagnoseWithFallback(messages, opts = {}) {
  try {
    const result = await callGroq(messages, opts);
    return { result, provider: 'groq' };
  } catch (groqErr) {
    console.warn('Groq failed, falling back to OpenRouter:', groqErr.message);
    try {
      const result = await callOpenRouter(messages, opts);
      return { result, provider: 'openrouter' };
    } catch (orErr) {
      console.error('Both LLM providers failed:', orErr.message);
      return { result: null, provider: 'none' };
    }
  }
}

function parseLlmDiagnosisJson(content) {
  const raw = String(content || '').trim() || '{}';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

function isProviderFailureDiagnosis(d) {
  if (!d) return false;
  const blob = `${d.title || ''} ${d.explanation || ''} ${d.suggestedFix || ''}`;
  return /diagnosis temporarily unavailable|both LLM providers|LLM providers failed/i.test(blob);
}

/**
 * Structured JSON from LLM, or null after retries so caller falls back to rules.
 * Never returns “LLM down” as a user-facing diagnosis body.
 */
async function llmDiagnose(serviceName, rawContext) {
  if (!GROQ_API_KEY && !OPENROUTER_API_KEY) {
    return { diagnosis: null, provider: 'none' };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Service: ${serviceName}\n\nEvidence:\n${rawContext}` },
  ];

  let lastProvider = 'none';
  for (let attempt = 1; attempt <= LLM_RETRY_ATTEMPTS; attempt++) {
    try {
      const { result, provider } = await diagnoseWithFallback(messages, {
        max_tokens: DIAGNOSIS_MAX_TOKENS,
        temperature: 0.15,
      });
      lastProvider = provider;

      if (provider === 'none' || !result) {
        const delay = LLM_RETRY_BASE_MS * 2 ** (attempt - 1);
        console.warn(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            service: 'api',
            level: 'warn',
            message: 'LLM diagnosis attempt failed — retrying',
            attempt,
            nextDelayMs: attempt < LLM_RETRY_ATTEMPTS ? delay : 0,
          })
        );
        if (attempt < LLM_RETRY_ATTEMPTS) await sleep(delay);
        continue;
      }

      const diagnosis = parseLlmDiagnosisJson(result.choices?.[0]?.message?.content);
      if (!['low', 'medium', 'high', 'critical'].includes(diagnosis.severity)) {
        diagnosis.severity = 'medium';
      }
      const shaped = {
        severity: diagnosis.severity,
        title: diagnosis.title || `${serviceName} issue`,
        explanation: diagnosis.explanation || diagnosis.diagnosis || 'No explanation',
        suggestedFix: sanitizeSuggestedFix(
          diagnosis.suggestedFix || diagnosis.suggested_fix || 'Investigate logs on Zerops.'
        ),
      };

      if (isProviderFailureDiagnosis(shaped)) {
        console.warn(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            service: 'api',
            level: 'warn',
            message: 'LLM returned provider-failure narrative — discarded',
            attempt,
          })
        );
        if (attempt < LLM_RETRY_ATTEMPTS) {
          await sleep(LLM_RETRY_BASE_MS * 2 ** (attempt - 1));
          continue;
        }
        return { diagnosis: null, provider: 'none' };
      }

      return { diagnosis: shaped, provider };
    } catch (err) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          service: 'api',
          level: 'error',
          message: 'LLM diagnosis parse/unexpected failure — retry or rules',
          attempt,
          error: err.message,
        })
      );
      if (attempt < LLM_RETRY_ATTEMPTS) {
        await sleep(LLM_RETRY_BASE_MS * 2 ** (attempt - 1));
      }
    }
  }

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'api',
      level: 'error',
      message: 'LLM diagnosis suppressed after retries — falling back to rules',
      attempts: LLM_RETRY_ATTEMPTS,
      lastProvider,
    })
  );
  return { diagnosis: null, provider: 'none' };
}

async function diagnose(ctx) {
  const { serviceName, logLines, metrics, triggerLog } = ctx;
  const source = ctx.source || triggerLog?.source || 'log';
  const message = triggerLog?.message || '';
  const level = triggerLog?.level || 'info';
  const projectId = ctx.projectId || 'sandbox';
  const projectName = ctx.projectName || (projectId === 'sandbox' ? 'Local sandbox' : null);

  if (triggerLog?.skipDiagnose) {
    return { skipped: true, reason: 'skipDiagnose' };
  }

  // Chaos lab fires want a fresh row every click (bypass open/cooldown dedupe).
  const forceNew = Boolean(ctx.forceNew || triggerLog?.forceNew);
  const baseFp = fingerprintOf(serviceName, message, level, projectId, triggerLog || {});
  const fingerprint = forceNew
    ? `${baseFp}|lab:${triggerLog?.labId || Date.now()}`
    : baseFp;

  if (!forceNew) {
    const dupe = await findOpenDupe(fingerprint, projectId);
    if (dupe) {
      return {
        id: dupe.id,
        createdAt: dupe.created_at,
        severity: dupe.severity,
        title: dupe.title,
        explanation: dupe.explanation,
        suggestedFix: dupe.suggested_fix,
        deduped: true,
      };
    }

    const recent = await findRecentDupe(fingerprint, projectId, DEDUPE_COOLDOWN_MS);
    if (recent) {
      return {
        id: recent.id,
        createdAt: recent.created_at,
        severity: recent.severity,
        title: recent.title,
        explanation: recent.explanation,
        suggestedFix: recent.suggested_fix,
        deduped: true,
        cooldown: true,
      };
    }
  }

  const contextPayload = {
    triggerEvent: triggerLog,
    recentLogs: (logLines || []).slice(-20),
    metricsSnapshot: metrics ?? null,
    projectId,
    projectName,
    eventClass: classifyEvent(message, level, triggerLog || {}),
  };
  const evidenceForLlm = JSON.stringify(contextPayload, null, 2);

  // Chaos lab must be instant + reliable — never wait on LLM / network here.
  const skipLlm = Boolean(ctx.skipLlm || source === 'chaos-lab');

  let diagnosis = null;
  let diagnosisProvider = 'rules';

  if (!skipLlm) {
    const llm = await llmDiagnose(serviceName, evidenceForLlm);
    diagnosis = llm.diagnosis;
    diagnosisProvider = llm.provider;
  }

  if (!diagnosis || isProviderFailureDiagnosis(diagnosis)) {
    diagnosis = ruleDiagnose({
      serviceName,
      message,
      severity: level,
      context: triggerLog || {},
    });
    diagnosisProvider = 'rules';
  }
  diagnosis.suggestedFix = sanitizeSuggestedFix(diagnosis.suggestedFix);

  if (isProviderFailureDiagnosis(diagnosis)) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'api',
        level: 'error',
        message: 'Suppressed provider-failure incident — not inserted',
        serviceName,
        fingerprint,
      })
    );
    return { skipped: true, reason: 'provider_failure_suppressed' };
  }

  // Unclassified severities default to medium (safer than low for health scoring)
  const sevRaw = String(diagnosis.severity || '').toLowerCase();
  diagnosis.severity = ['low', 'medium', 'high', 'critical'].includes(sevRaw)
    ? sevRaw
    : 'medium';

  const noActionBlob = `${diagnosis.title || ''} ${diagnosis.explanation || ''} ${diagnosis.suggestedFix || ''}`;
  const noAction = /no action needed|no immediate action|nothing to do|deliberate chaos|expected chaos test/i.test(
    noActionBlob
  );

  const rawContext = JSON.stringify(
    {
      ...contextPayload,
      diagnosisProvider,
      noAction,
    },
    null,
    2
  );

  let result;
  try {
    result = await db.query(
      `INSERT INTO incidents
         (service_name, severity, title, status, source, raw_context, explanation, suggested_fix, fingerprint, project_id, project_name, no_action)
       VALUES ($1,$2,$3,'open',$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, created_at`,
      [
        serviceName,
        diagnosis.severity,
        diagnosis.title,
        source,
        rawContext,
        diagnosis.explanation,
        diagnosis.suggestedFix,
        fingerprint,
        projectId,
        projectName,
        noAction,
      ]
    );
  } catch (err) {
    // Pre-migration DBs without no_action column
    if (!/no_action/i.test(err.message || '')) throw err;
    result = await db.query(
      `INSERT INTO incidents
         (service_name, severity, title, status, source, raw_context, explanation, suggested_fix, fingerprint, project_id, project_name)
       VALUES ($1,$2,$3,'open',$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, created_at`,
      [
        serviceName,
        diagnosis.severity,
        diagnosis.title,
        source,
        rawContext,
        diagnosis.explanation,
        diagnosis.suggestedFix,
        fingerprint,
        projectId,
        projectName,
      ]
    );
  }

  const row = result.rows[0];
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'api',
      level: 'info',
      message: 'Incident created',
      incidentId: row.id,
      severity: diagnosis.severity,
      serviceName,
      projectId,
      diagnosisProvider,
      fingerprint,
    })
  );

  return {
    id: row.id,
    createdAt: row.created_at,
    deduped: false,
    projectId,
    diagnosisProvider,
    ...diagnosis,
  };
}

function llmKeysConfigured() {
  return Boolean(GROQ_API_KEY || OPENROUTER_API_KEY);
}

module.exports = {
  diagnose,
  ruleDiagnose,
  fingerprintOf,
  classifyEvent,
  sanitizeSuggestedFix,
  diagnoseWithFallback,
  llmKeysConfigured,
  isProviderFailureDiagnosis,
  LLM_TIMEOUT_MS,
  DIAGNOSIS_MAX_TOKENS,
  CHAT_MAX_TOKENS,
  DEDUPE_COOLDOWN_MS,
};
