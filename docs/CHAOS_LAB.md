# Chaos lab

Sandbox-only failure injection for demos and regression of the diagnose → incident loop.

See also: [INCIDENTS](./INCIDENTS.md) · [API](./API.md)

---

## Availability rule

`POST /sandbox/chaos` returns **403** when:

```text
req.session.zeropsToken && req.session.zeropsProjectId
```

i.e. a **live project is selected**. Connect-without-project remains allowed. Live fleets are never broken from the lab UI.

---

## End-to-end path

```text
Dashboard CHAOS[] button
  → POST /sandbox/chaos { type }
  → fireViaLocalDiagnose (required): logBuffer + diagnose({ source: 'chaos-lab', forceNew, skipLlm })
  → fireViaDemo (async best-effort): GET demo /simulate/* with X-OpsMate-Diagnose: 0
  → response: { ok, incidentId, title, severity, … }
```

- **Incident source of truth:** local diagnose, not the demo HTTP status.  
- Demo always tags simulate logs with **`skipDiagnose: true`** so dual diagnosis does not spam.

Dashboard labels live in `dashboard/src/App.jsx` → `const CHAOS = […]`.

---

## Triggers

| `type` id | UI label | Demo path | Simulated signal | Rule diagnosis flavor |
|-----------|----------|-----------|------------------|------------------------|
| `slow` | Latency spike | `/simulate/slow` | Delayed response + latency warn logs | Latency spike / budget |
| `crash` | Crash / 500 | `/simulate/crash` | Throw; pipeline error | Process crash / 500 |
| `bad-query` | DB failure | `/simulate/bad-query` | Missing relation / SQL fail | Database failure |
| `error-storm` | Error storm | `/simulate/error-storm` | Burst 5xx-style counters + 502 | Error storm |
| `dep-timeout` | Dependency timeout | `/simulate/dep-timeout` | Fake dep + 504 | Dependency timeout |
| `memory` | Memory pressure | `/simulate/memory` | Heap soft-threshold style warn | Memory pressure |

Fallback log messages (when local diagnose manufactures the trigger) are in `FALLBACK_LOGS` inside `api/routes/sandbox.js` with `meta.chaos` set to the type id.

---

## forceNew / skipLlm

| Flag | Effect |
|------|--------|
| `forceNew: true` | Unique fingerprint `…\|lab:{labId}`; skips open/cooldown dedupe |
| `skipLlm` / `source: 'chaos-lab'` | Rules path first — fast, demo-reliable |

Default dedupe window for other sources: **`INCIDENT_DEDUPE_MS`** (default 120s).

---

## “No action needed”

Older LLM answers sometimes said “no action / deliberate chaos.” Product rules now prefer production-style remediation for chaos-tagged events. Where residual **no-action** text or `no_action=true` exists:

- UI may collapse into a summary card.
- **Health scoring excludes** them (`isExcludedFromHealthScoring`).

---

## Known limitations

- Demo process must be up for realistic metrics drama; incidents still create without it.
- Concurrent chaos can flood open rows — resolve or raise demo thresholds for clean screenshots.
- Restart from an incident still needs Zerops mapping; chaos on sandbox rarely maps to a restartable Zerops stack id.
