# API reference

Base service: **api** Express app (`api/server.js`). Default bind: **`http://localhost:8080`**.

Dashboard calls these routes with **`credentials: 'include'`** (cookies when available) **and**, on multi-host Zerops deploys, **`Authorization: Bearer <PAT>`** plus selected-project headers.

See also: [ARCHITECTURE](./ARCHITECTURE.md) · [CHAT](./CHAT.md) · [CHAOS_LAB](./CHAOS_LAB.md)

---

## Auth model (concrete)

| Mechanism | Used for |
|-----------|----------|
| Cookie `opsmate.sid` (`express-session`, memory store) | Same-origin session after Connect (works locally) |
| `Authorization: Bearer <PAT>` | **Preferred on production** when dashboard and api are different public hosts (cross-origin cookies often fail) |
| Headers `X-OpsMate-Project-Id` / `X-OpsMate-Project-Name` | Selected live project when using Bearer (and mirrored into session when possible) |
| `POST /zerops/connect` body `{ token }` | Validates PAT, lists projects; cookie session if cookies stick |
| Browser `sessionStorage` keys (`opsmate.zeropsPat`, …) | Dashboard only — resends Bearer + project headers on each `apiFetch`; **not** Postgres |
| `process.env.ZEROPS_API_TOKEN` (+ optional `ZEROPS_PROJECT_ID`) | Server-side headless fallback |
| Outbound Bearer | `zeropsApi` → Zerops REST; LLM SDKs → Groq/OpenRouter |

**Resolution order** (`api/services/reqAuth.js` → `getToken` / `getSelectedProject`):

1. `Authorization: Bearer …`  
2. Session cookie  
3. Env `ZEROPS_API_TOKEN` / `ZEROPS_PROJECT_ID`

CORS: `origin: true`, `credentials: true`, allows `Authorization` and OpsMate project headers. Production session cookie: `sameSite: 'none'`, `secure: true`, `proxy: true` — still may not stick cross-subdomain; Bearer path remains the deploy SSOT.

---

## Route matrix

| Method | Path | PAT required | Notes / UI |
|--------|------|--------------|------------|
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
| `POST` | `/zerops/connect` | Body PAT | Validate + list projects; optional cookie session |
| `POST` | `/zerops/disconnect` | Clears session | Client must also `clearAuth()` sessionStorage |
| `GET` | `/zerops/me` | Optional | `{ connected, selectedProjectId, source: bearer\|session\|env }` |
| `GET` | `/zerops/projects` | **Token required** | 401 without Bearer/cookie/env |
| `POST` | `/zerops/select-project` | **Token required** | Sets project (session + client should set headers) |
| `GET` | `/zerops/services` | **Token required** | Live inventory |
| `POST` | `/zerops/restart` | **Token required** | Stack restart |
| `POST` | `/sandbox/chaos` | Forbidden if live project selected | Chaos lab |

“Scope” = `resolveProjectScope` / `getProjectScope` (sandbox vs live project). Most routes do **not** return 401 when disconnected; they operate as sandbox.

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

- **403** if a live project is active (`getToken` + selected project id via Bearer/cookie/headers).
- Always attempts local `diagnose` with `forceNew` / `skipLlm`; demo HTTP is best-effort.

### Zerops routes

| Step | Effect |
|------|--------|
| `connect` with body PAT | Validate; list projects; set session when cookies work; client should `setAuthPat` |
| Follow-up requests | Prefer `Authorization: Bearer` + optional project headers |
| `select-project` | Sets project on session; client should `setAuthProject(id, name)` |
| `disconnect` | Clears session; client `clearAuth()` removes sessionStorage |

---

## Sandbox-only vs PAT-required

| Feature | Requires connected PAT + project? |
|---------|-----------------------------------|
| Chaos lab | **Must not** be live (`403` if connected + selected) |
| Live architecture GET | Yes (400 without) |
| List Zerops projects/services/restart | Token required (Bearer or cookie) |
| Chat / status / incidents | Prefer token scope when present; else sandbox |

---

## Known limitations

- Memory session: API restart drops cookie session; browser tab still has PAT until disconnect or tab close.
- Cross-origin deploy **requires** Bearer path (see auth model) — cookie-only is not enough.
- Open restart path depends on name/id match against Zerops inventory.
- CORS open reflection is convenient for demos; tighten for production multi-tenant hosting.
- Dashboard may proxy API paths in Vite dev (`vite.config.js`); production uses `PUBLIC_API_URL` → `/config.json`.
