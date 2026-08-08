# Architecture

OpsMate is a multi-process SRE console for **Zerops** fleets and a **local sandbox** demo patient. This document describes components, data flow, and modes as implemented in the [OpsMate](https://github.com/dykChirag/OpsMate) monorepo (`api/`, `dashboard/`, `demo-api/`).

See also: [DEPLOYMENT_HEALTH](./DEPLOYMENT_HEALTH.md) · [INCIDENTS](./INCIDENTS.md) · [CHAT](./CHAT.md) · [API](./API.md) · [CHAOS_LAB](./CHAOS_LAB.md)

---

## Components

| Process | Path | Default ports | Role |
|---------|------|---------------|------|
| **api** | `api/` | 8080 HTTP, 5514 syslog | Ingest, diagnose, chat, health score, Zerops session, chaos orchestration |
| **dashboard** | `dashboard/` | 3000 | Story landing + multi-view SPA |
| **demo-api** | `demo-api/` | 3001 HTTP, 9090 metrics | Chaos patient, Prometheus text metrics, log push to ingest |
| **db** | `docker-compose.yml` | host **5433** → 5432 | Postgres for incidents and snapshots |

---

## Signal → brain → action

```text
┌──────────────────────────────────────────────────────────────────┐
│                         SIGNALS IN                               │
│  Zerops status sync · POST /ingest · chaos-lab diagnose          │
│  demo /metrics (poll) · optional syslog                          │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                         BRAIN                                    │
│  diagnosisEngine.diagnose  (LLM + ruleDiagnose fallback)          │
│  healthScore.computeHealthScore                                  │
│  projectInsights.syncStatusIncidents / architecture services     │
│  opsContext.buildOpsContext  (scope + inventory + open counts)   │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                        ACTIONS OUT                               │
│  incidents rows · chat answers · suggested_fix                   │
│  POST /incidents/:id/fix → optional zerops restart              │
│  architecture review findings · health_snapshots                 │
└──────────────────────────────────────────────────────────────────┘
```

| Direction | Module / route | Notes |
|-----------|----------------|-------|
| In | `POST /ingest`, `services/syslogListener.js`, `metricPoller.js` | Demo and agents push logs; metrics polled from `DEMO_API_URL` |
| In | `projectInsights.syncStatusIncidents` | Live stack status → incidents |
| In | `POST /sandbox/chaos` | Local diagnose + best-effort demo HTTP ([CHAOS_LAB](./CHAOS_LAB.md)) |
| Brain | `diagnosisEngine.js` | Groq → OpenRouter → rules; fingerprint dedupe |
| Brain | `healthScore.js` | Weighted score ([DEPLOYMENT_HEALTH](./DEPLOYMENT_HEALTH.md)) |
| Brain | `opsContext.js` | Single scope for chat + health |
| Out | Postgres `incidents` | SSOT for open/resolved ([INCIDENTS](./INCIDENTS.md)) |
| Out | `zeropsApi.js` | List projects/services, restart stack |

---

## Core modules (`api/services/`)

| Module | Responsibility |
|--------|----------------|
| `opsContext.js` | `resolveProjectScope`, `SANDBOX_INVENTORY`, `listOpenIncidents`, `countIncidentsByStatus`, `buildOpsContext`, `chatContextPayload` |
| `diagnosisEngine.js` | `diagnose`, `ruleDiagnose`, LLM clients, dedupe |
| `healthScore.js` | `computeHealthScore`, `scoreOpenIncidents` |
| `projectInsights.js` | Status → insights/incidents; live inventory review helpers |
| `zeropsApi.js` | Outbound Zerops REST with Bearer PAT |
| `logBuffer.js` / `metricPoller.js` | In-memory recent logs / last scrape |
| `architecture.js` | YAML review + inventory YAML reconstruction |
| `projectScope.js` | Lighter scope helper used by `/incidents` list |

---

## Data model

### `incidents` (migrations `001`–`003`)

| Column | Type / notes |
|--------|----------------|
| `id` | `SERIAL` PK |
| `service_name` | `TEXT NOT NULL` |
| `severity` | `TEXT NOT NULL` — `CHECK` ∈ `low` \| `medium` \| `high` \| `critical` |
| `title` | optional |
| `status` | default `'open'`; UI treats non-open as resolved (e.g. `'resolved'`) |
| `source` | default `'log'`; also `chaos-lab`, `zerops-status`, etc. |
| `raw_context` | JSON text evidence blob for diagnosis |
| `explanation` | diagnosis narrative |
| `suggested_fix` | remediation text |
| `fingerprint` | dedupe key (project-scoped) |
| `project_id` | e.g. `'sandbox'` or Zerops project id |
| `project_name` | display name |
| `no_action` | `BOOLEAN DEFAULT false` — exclude from health deductions when true |
| `created_at` | `TIMESTAMPTZ` |

Open predicate used in SQL:  
`LOWER(TRIM(COALESCE(status, 'open'))) = 'open'`.

### Other tables

| Table | Purpose |
|-------|---------|
| `health_snapshots` | `score` + `checks` JSONB history |
| `architecture_reviews` | stored review results |
| `agent_actions` | action log; optional FK to `incidents` |

### Sandbox inventory (not Zerops)

Shared constant `SANDBOX_INVENTORY` in `opsContext.js`:

`demo`, `api`, `dashboard`, `db` (types runtime/database, status `running`).

Used by chat context and by `/status` inventory fallback (via the same list concept) so Services and Chat agree in sandbox.

---

## Sandbox vs live PAT

Controlled primarily by `resolveProjectScope(req)` in `opsContext.js`.

| Mode | When | Inventory | Incidents project_id | Chaos lab |
|------|------|-----------|----------------------|-----------|
| **sandbox** | No token / no live project | `SANDBOX_INVENTORY` | `'sandbox'` | Enabled |
| **connected-no-project** | PAT present (Bearer or session), no project selected | Sandbox inventory | `'sandbox'` | Enabled |
| **live** | PAT + project id (Bearer headers, session, or env) | `zeropsApi.listProjectServices` | Selected Zerops id | **Disabled** (`POST /sandbox/chaos` → 403) |

### Shared

- Schema, diagnosis pipeline, health formula shape.
- Auth via cookie session **and/or** `Authorization: Bearer` + project headers (`reqAuth.js`); see [API.md](./API.md).
- Optional env `ZEROPS_API_TOKEN` / `ZEROPS_PROJECT_ID` for headless ops.
- Dashboard multi-host deploys keep the PAT in **sessionStorage** and resend it on every request (not written to Postgres).

### Isolated

- Live project incidents never mix with `project_id = 'sandbox'` (exact `IS NOT DISTINCT FROM` match).
- Live chat omits local demo log buffer; sandbox can include `localAgentLogs` / metrics.

---

## Design principle: one inventory SSOT

**Health, Chat, and the Services page must see the same inventory for the current scope.**

- Live: Zerops service list only (empty list if API fails — do not invent hosts).
- Sandbox: always `SANDBOX_INVENTORY`, not `[]`.

Cross-cutting access goes through `buildOpsContext` so `/chat` and `/status` (and health) do not diverge.

---

## Product surfaces (dashboard)

| View | Role |
|------|------|
| Story landing | Marketing + live hero score from `/status` |
| Overview | Health bento, chaos (sandbox), recent incidents |
| Services | Inventory cards |
| Incidents | Grouped feed, resolve/restart |
| Health | Full check list |
| Architecture | YAML / live sketch |
| Chat | Project-scoped Q&A |
| Connect | PAT + project select |

---

## Known limitations

- Cookie session is in-memory — API restarts drop it; tab sessionStorage can still re-auth via Bearer until disconnect / tab close.
- LLM provider chain is server-env only; free-tier models rate-limit under stress.
- Architecture YAML from inventory is incomplete vs GUI export (product labels reconstructed YAML as such).
- Metrics/syslog are strongest in sandbox; live fleets lean on Zerops status + ingested logs when available.
