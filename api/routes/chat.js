'use strict';

const { Router } = require('express');
const {
  buildOpsContext,
  chatContextPayload,
} = require('../services/opsContext');
const {
  diagnoseWithFallback,
  llmKeysConfigured,
  CHAT_MAX_TOKENS,
} = require('../services/diagnosisEngine');

const router = Router();

const CHAT_UNAVAILABLE =
  "I'm having trouble reaching the diagnosis engine right now — both AI providers are unavailable. Try again in a moment.";

const CHAT_SYSTEM = `You are OpsMate, an AI SRE assistant for Zerops deployments.

STRICT RULES:
1. Answer ONLY from the JSON context in the user message for THIS turn.
2. healthScore, openIncidentCount, resolvedIncidentCount, openIncidents, serviceNames, and inventory in that JSON are authoritative RIGHT NOW. Quote those exact numbers. Do not reuse numbers from earlier replies in a multi-turn UI — you are not given prior turns.
3. The only valid project is context.project.name / context.project.id.
4. The only valid services are context.serviceNames / context.inventory. If serviceCount > 0 or inventory is non-empty, those services ARE the fleet — never claim "no services listed" or invent other hosts.
5. openIncidentCount is OPEN only (status open). resolvedIncidentCount is separate. Never sum them. Never treat total incidents as open.
6. openIncidents listed may be a sample of OPEN rows only; prefer openIncidentCount for totals.
7. If localAgentLogs is missing, there are no local sandbox logs — do not invent log evidence.
8. If evidence is missing, say so clearly. If inventory exists and health is low, ground the answer in openIncidents + inventory status — not empty inventory.
9. Be concise and action-oriented; use Zerops terms (service, private hostname, pipeline, container).
10. Keep answers concise by default: 3–5 sentences or a short bulleted list. Only produce longer structured reports if the user explicitly asks for detail.`;

function ruleChat(question, ops) {
  const open = ops.openIncidents || [];
  const names = ops.serviceNames || [];
  const services = names.join(', ') || 'none loaded';
  const project = ops.projectName || ops.projectId || 'sandbox';
  const score = ops.healthScore;

  if (/why|unhealthy|wrong|error|incident|health/i.test(question)) {
    if (open.length) {
      const ranked = [...open].sort((a, b) => {
        const aIn = names.includes(a.service_name) ? 0 : 1;
        const bIn = names.includes(b.service_name) ? 0 : 1;
        return aIn - bIn;
      });
      const top = ranked[0];
      return (
        `Project **${project}** health is **${score}/100**` +
        (ops.healthEarned != null
          ? ` (${ops.healthEarned}/${ops.healthTotal} pts).`
          : '.') +
        ` ${open.length} open incident(s) in this project. ` +
        `Latest on **${top.service_name}**: ${top.title || top.severity}. ${top.explanation || ''} ` +
        `Suggested: ${top.suggested_fix || 'Inspect Zerops runtime logs.'}`
      );
    }
    return (
      `Project **${project}** health is **${score}/100**. No open incidents scoped to this project. ` +
      `Inventory: ${services}.`
    );
  }

  if (/service|inventory|project/i.test(question)) {
    return (
      `Selected project: **${project}** (${ops.projectId}). ` +
      `Services: ${services}. Health: ${score}/100.`
    );
  }

  if (open.length) {
    return (
      `**${project}**: ${open.length} open incident(s), health ${score}/100. ` +
      `Most recent: [${open[0].severity}] ${open[0].service_name} — ${open[0].explanation || open[0].title}`
    );
  }

  return (
    `**${project}**: no open incidents in scope. Services: ${services}. Health: ${score ?? 'n/a'}/100.`
  );
}

function contextSummary(ops) {
  return {
    projectId: ops.projectId,
    projectName: ops.projectName,
    incidentCount: ops.openIncidentCount,
    serviceCount: ops.services.length,
    healthScore: ops.healthScore,
    services: ops.serviceNames,
    contextSource: ops.scope?.source,
  };
}

router.post('/', async (req, res) => {
  const question = (req.body?.question ?? req.body?.message ?? '').trim();
  if (!question) {
    return res.status(400).json({ ok: false, error: 'question is required' });
  }

  try {
    // Fresh every message: session project wins over body; fleet sync aligns with /status
    const ops = await buildOpsContext(req, { syncFleet: true });
    const payload = chatContextPayload(ops);

    if (!llmKeysConfigured()) {
      return res.json({
        ok: true,
        answer: ruleChat(question, ops),
        mode: 'rules',
        projectId: ops.projectId,
        projectName: ops.projectName,
        healthScore: ops.healthScore,
        contextSummary: contextSummary(ops),
      });
    }

    // Single-turn only — no conversation history (avoids stale health/incident numbers)
    const messages = [
      { role: 'system', content: CHAT_SYSTEM },
      {
        role: 'user',
        content:
          `Authoritative live context for project "${ops.projectName || ops.projectId}" ` +
          `(id ${ops.projectId}) — values are current as of this request only:\n` +
          `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\n` +
          `Question: ${question}\n\n` +
          `Use ONLY the numbers above. Health is exactly ${ops.healthScore}/100 · ` +
          `${ops.openIncidentCount} OPEN incident(s)` +
          (ops.resolvedIncidentCount != null
            ? ` · ${ops.resolvedIncidentCount} resolved`
            : '') +
          ` · ${ops.serviceNames?.length || 0} service(s): ${JSON.stringify(ops.serviceNames)}.`,
      },
    ];

    const { result, provider } = await diagnoseWithFallback(messages, {
      max_tokens: CHAT_MAX_TOKENS,
      temperature: 0.15,
      xTitle: 'OpsMate Chat',
    });

    if (provider === 'none' || !result) {
      return res.json({
        ok: true,
        answer: CHAT_UNAVAILABLE,
        mode: 'unavailable',
        provider: 'none',
        projectId: ops.projectId,
        projectName: ops.projectName,
        healthScore: ops.healthScore,
        contextSummary: contextSummary(ops),
      });
    }

    const answer =
      result.choices?.[0]?.message?.content?.trim() || 'No response.';
    res.json({
      ok: true,
      answer,
      mode: 'llm',
      provider,
      projectId: ops.projectId,
      projectName: ops.projectName,
      healthScore: ops.healthScore,
      contextSummary: contextSummary(ops),
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'api',
        level: 'error',
        message: 'POST /chat failed',
        error: err.message,
      })
    );
    res.status(500).json({ ok: false, error: 'Chat request failed', detail: err.message });
  }
});

module.exports = router;
