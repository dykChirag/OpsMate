# Chat

Project-scoped SRE Q&A over the same ops context as Health and Services.

See also: [ARCHITECTURE](./ARCHITECTURE.md) · [API](./API.md) · [INCIDENTS](./INCIDENTS.md)

---

## Entry point

`POST /chat` with JSON body:

```json
{ "question": "Why is the deployment unhealthy right now?" }
```

Optional body `projectId` / `projectName` is **ignored when an active PAT already holds a different project** (Bearer/session project wins).

Handler: `api/routes/chat.js` → `buildOpsContext(req, { syncFleet: true })` → `chatContextPayload(ops)`.

---

## Context assembly

### 1. Scope & inventory

`resolveProjectScope` + `listServices`:

| Mode | `serviceNames` / `inventory` |
|------|------------------------------|
| Sandbox / connected, no project | `SANDBOX_INVENTORY` — **demo, api, dashboard, db** |
| Live project | Zerops `listProjectServices` (empty if list fails) |

### 2. Incidents & health

| Data | Function |
|------|----------|
| Open list (sample, open-only) | `listOpenIncidents` |
| Open/resolved totals | **`countIncidentsByStatus`** |
| Health score | `computeHealthScore` with that open list |

### 3. Logs / metrics

- Live: omit local demo log buffer from chat payload.
- Sandbox: may include `localAgentLogs` / `localAgentMetrics` from in-process buffers.

### 4. Payload shape (`chatContextPayload`)

Includes approximately:

- `project` { id, name, mode, source }
- `inventory[]` { name, status, type, isSystem }
- `serviceNames`, `serviceCount`
- `healthScore`, health weights, `healthMode`
- **`openIncidentCount`**, **`resolvedIncidentCount`**
- `openIncidents[]` (status open rows: severity, title, explanation, suggested_fix, …)
- `_instruction` string reinforcing counts and inventory

The LLM user message embeds this JSON and repeats authoritative numbers.

---

## Project-scoping hard requirements

These are **product requirements**, not soft style tips:

1. **Only** the scoped project’s inventory and incidents may appear in answers.
2. **`openIncidentCount` is open-only** — never open+resolved as “open”.
3. If **`serviceCount > 0` / inventory non-empty**, the model must **not** claim “no services listed”.
4. Body `projectId` cannot pull a third project over an active PAT selection.
5. Single-turn context only — prior chat turns are **not** sent to the model (avoids stale health numbers).

System prompt in `chat.js` (`CHAT_SYSTEM`) encodes the same rules.

---

## LLM vs rules

| Condition | Behavior |
|-----------|----------|
| Groq and/or OpenRouter keys configured | `diagnoseWithFallback` chat completion (`CHAT_MAX_TOKENS`) |
| Both providers fail | `CHAT_UNAVAILABLE` string (honest outage) or mode `unavailable` |
| No LLM keys | **`ruleChat(question, ops)`** — template answers from open incidents + inventory + score |

Rules path still uses real `ops.openIncidents` and `ops.serviceNames` (including sandbox inventory).

---

## UI integration

Dashboard default chat prompt may be *“Why is the deployment unhealthy right now?”*.  
Refresh path uses the same auth as Connect (cookie and/or Bearer + project headers) so Health and Chat share scope without re-prompting for the PAT.

---

## Known limitations

- Single-turn design loses multi-turn clarification memory by design.
- Sample of open incidents in the JSON may be capped by list limit; **totals** use `countIncidentsByStatus`.
- Temperature low (~0.15) but models can still prose-stylize; numbers must come from JSON — treat divergences as bugs against the checklist.
