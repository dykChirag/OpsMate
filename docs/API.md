# API reference

Base service: **api** Express app (`api/server.js`). Default bind: **`http://localhost:8080`**.

Dashboard calls these routes with **`credentials: 'include'`** (cookie session). Do **not** send a Zerops PAT as `Authorization: Bearer` to OpsMate — that header is only used **outbound** from OpsMate to Zerops and to LLM providers.

See also: [ARCHITECTURE](./ARCHITECTURE.md) · [CHAT](./CHAT.md) · [CHAOS_LAB](./CHAOS_LAB.md)

---

## Auth model (concrete)

| Mechanism | Used for |
|-----------|----------|
| Cookie `opsmate.sid` (`express-session`, memory store) | Browser session after Connect |
| `POST /zerops/connect` body `{ token }` | One-time PAT ingest into session |
| `process.env.ZEROPS_API_TOKEN` (+ optional `ZEROPS_PROJECT_ID`) | Server-side headless fallback via `getToken(req)` |
| Outbound Bearer | `zeropsApi` → Zerops REST; LLM SDKs → Groq/OpenRouter |

**Client → OpsMate:** session cookie (and JSON body where noted).  
**No route accepts `Authorization: Bearer <user PAT>` for OpsMate identity.**

CORS: `origin: true`, `credentials: true`. Production session cookie: `sameSite: 'none'`, `secure: true`.

---

## Route matrix

| Method | Path | Session PAT | Notes / UI |
|--------|------|-------------|------------|
| `GET` | `/` | — | Liveness `{ service, status, version }` |
| `POST` | `/ingest` | — | Log → buffer + optional diagnose (demo patient, agents) |
| `GET` | `/incidents` | Scope only | List; returns `openCount` / `resolvedCount` / `totalCount` |
| `GET` | `/incidents/:id` | — | One row |
| `POST` | `/incidents/:id/resolve` | — | `status=resolved` |
| `POST` | `/incidents/:id/fix` | Token optional | Suggested fix; restart if Zerops token + match |
| `GET` | `/status` | Scope | Inventory, health, open count, demo probe |
| `GET` | `/status/health` | Scope | Score + checks only |
| `GET` | `/status/architecture/live` | **Live project** | 400 if no project |
| `POST` | `/status/architecture/review` | Optional live | YAML body review |
| `POST` | `/status/sync-project` | Live preferred | Status → incidents sync |
| `POST` | `/chat` | Scope | Q&A ([CHAT](./CHAT.md)) |
| `POST` | `/zerops/connect` | Body PAT | Store session; list projects |
| `POST` | `/zerops/disconnect` | Clears session | |
| `GET` | `/zerops/me` | Optional | `{ connected, selectedProjectId, … }` |
| `GET` | `/zerops/projects` | **Token required** | 401 without |
| `POST` | `/zerops/select-project` | **Token required** | Sets session project |
| `GET` | `/zerops/services` | **Token required** | Live inventory |
| `POST` | `/zerops/restart` | **Token required** | Stack restart |
| `POST` | `/sandbox/chaos` | Forbidden if live project selected | Chaos lab |

“Scope” = `getProjectScope` / `resolveProjectScope` (sandbox vs session project). Most routes do **not** return 401 when disconnected; they operate as sandbox.

Syslog UDP/TCP listener is separate (`SYSLOG_PORT`, not a JSON REST path).

---

## Endpoint notes

### `POST /ingest`

Accepts JSON log entries (and plain text as configured). May call `diagnose` when `shouldDiagnoseEntry` is true. Used by demo-api; not typically the dashboard.

### `GET /incidents`

Query: `limit`, `service`, `severity`, `status` (`open` \| `resolved`), optional `projectId`.  
Response includes incidents array **and** authoritative:

```json
{
  "openCount": 0,
  "resolvedCount": 0,
  "totalCount": 0,
  "incidents": [ … ]
}
```

**Dashboard** should use `openCount` for badges, not only filtered page length.

### `GET /status`

Aggregates ops health, `inventory` (live or sandbox list), topology, `openIncidents` as **open count number**, demo status, `health.checks`.

### `POST /chat`

Body: `{ "question": "…" }`.  
Response: `{ answer, mode, provider?, healthScore, contextSummary?, projectId, projectName }`.

### `POST /sandbox/chaos`

Body: `{ "type": "slow" | "crash" | "bad-query" | "error-storm" | "dep-timeout" | "memory" }`.

- **403** if `session.zeropsToken && session.zeropsProjectId`.
- Always attempts local `diagnose` with `forceNew` / `skipLlm`; demo HTTP is best-effort.

### Zerops routes

| Connect success | Session fields |
|-----------------|----------------|
| yes | `zeropsToken`, clears prior project until select |
| select-project | `zeropsProjectId`, `zeropsProjectName` |

---

## Sandbox-only vs PAT-required

| Feature | Requires connected PAT + project? |
|---------|-----------------------------------|
| Chaos lab | **Must not** be live (`403` if connected + selected) |
| Live architecture GET | Yes (400 without) |
| List Zerops projects/services/restart | Token required |
| Chat / status / incidents | Prefer session when present; else sandbox |

---

## Known limitations

- Memory session: restarts drop Connect state.
- Open restart path depends on name/id match against Zerops inventory.
- CORS open reflection is convenient for demos; tighten for production multi-tenant hosting.
- Dashboard may proxy API paths in Vite dev (`vite.config.js`); production uses public API URL/`config.json`.
