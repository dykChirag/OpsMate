# Incidents

How OpsMate turns signals into durable incident rows, how open vs resolved works, and where counts must come from.

See also: [ARCHITECTURE](./ARCHITECTURE.md) · [CHAOS_LAB](./CHAOS_LAB.md) · [API](./API.md) · [DEPLOYMENT_HEALTH](./DEPLOYMENT_HEALTH.md)

---

## Lifecycle

```text
Signal (log / chaos / Zerops status)
    → shouldDiagnose / force diagnose
    → diagnosisEngine.diagnose
    → INSERT incidents (status = 'open', fingerprint, project_id, …)
    → UI list / group / resolve  → status = 'resolved'
```

| Path | Entry | Typical `source` |
|------|--------|------------------|
| Log ingest | `POST /ingest` | `log` (or entry source) |
| Chaos lab | `POST /sandbox/chaos` → `diagnose` with `forceNew` | `chaos-lab` |
| Fleet sync | `syncStatusIncidents` / connect select | `zerops-status` |
| Metrics organic (demo) | ingest of patient logs | varies |

Diagnosis uses LLM when configured, else **`ruleDiagnose`**. Provider-failure-shaped AI answers are suppressed or replaced by rules; they are not ideal primary incident content.

### Dedupe

- Fingerprint from service + message/class + `project_id` (`fingerprintOf` / related helpers).
- Open duplicate or recent window: env **`INCIDENT_DEDUPE_MS`** default **120000** ms.
- Chaos lab sets **`forceNew`** so each fire gets a fresh fingerprint suffix (`|lab:…`) and bypasses open/cooldown dedupe.

---

## Status & severity

| Field | Allowed / used values |
|-------|------------------------|
| `status` | Default **`open`**. Resolve sets **`resolved`**. UI: open iff `toLowerCase(trim(status \|\| 'open')) === 'open'`. |
| `severity` | **`low` \| `medium` \| `high` \| `critical`** (DB check constraint). Missing → treat as **medium** for scoring. |
| `no_action` | Boolean; when true, health scoring excludes the row. Also inferred from “no action needed …” text. |

---

## Evidence fields

| Field | Meaning | Origin |
|-------|---------|--------|
| `raw_context` | JSON: trigger log, recent logs snippet, metrics, project, provider used | `diagnose` insert |
| `explanation` | Short root-cause narrative | LLM or rules |
| `suggested_fix` | Numbered remediation / restart guidance | LLM or rules (`sanitizeSuggestedFix`) |
| `title` | Short stable head | LLM or rules |
| `service_name` | Host / service hostname | Trigger context |

UI labels roughly:

- **Evidence & logs** → `raw_context` (+ related grouping).
- **Diagnosis** → `explanation` + severity/title.
- **Suggested remediation** → `suggested_fix`.

---

## Recurrence grouping (dashboard)

`groupIncidentsForDisplay` in `dashboard/src/App.jsx`:

- Groups similar open/resolved incidents for display (action score, chaos “no action” collapse into summary cards).
- **Group count ≠ authoritative open event count.** Prefer server `openCount` for totals.

Sort modes: smart (actionable first), severity, latest/earliest (`INCIDENT_SORT_OPTIONS`).

---

## Authoritative open / resolved counts

### Single source of truth

**`countIncidentsByStatus(projectId)`** in `api/services/opsContext.js`:

```sql
COUNT(*) FILTER (WHERE open-status-predicate)  AS open
COUNT(*) FILTER (WHERE NOT open)               AS resolved
COUNT(*)                                       AS total
WHERE project_id IS NOT DISTINCT FROM $1
```

Open predicate: `LOWER(TRIM(COALESCE(status, 'open'))) = 'open'`.

| Consumer | Field |
|----------|--------|
| Chat / ops context | `openIncidentCount`, `resolvedIncidentCount` |
| `GET /status` | `openIncidents` **number** = open count |
| `GET /incidents` | `openCount`, `resolvedCount`, `totalCount` (+ incident page rows) |
| Health deductions | Open **rows** list for severities + count for messaging |

### Do not use for “how many open?”

- `.length` of a **mixed** `GET /incidents?limit=N` after client filter (recent window under-counts older open).  
- `open + resolved`.  
- List length after a low `LIMIT` if you need true totals — use `countIncidentsByStatus`.

List helper for details: `listOpenIncidents(projectId, limit)` — **open only**, still project-scoped.

---

## Resolve & restart

| Action | API | Effect |
|--------|-----|--------|
| Mark resolved | `POST /incidents/:id/resolve` | `status = 'resolved'` |
| Attempt fix | `POST /incidents/:id/fix` | Returns suggested text; if session/env Zerops token + matching service, may call restart and resolve |

Chaos / rules fixes stay guidance unless a live restart succeeds.

---

## Project scoping

Every insert should set `project_id` / `project_name`. Sandbox bucket: **`sandbox`** / **Local sandbox**. Queries always filter `project_id IS NOT DISTINCT FROM $scope`.

---

## Known limitations

- Resolve is per-id; bulk UI resolves all ids in a group explicitly.
- `no_action` requires migration `003_no_action.sql`; text heuristics still apply if column empty.
- Grouping heuristics can merge chaos noise; expand groups for individual ids.
- High organic demo volume still produces many open rows until resolved — use severity decay on health, not silent drop of open status.
