# OpsMate v2

**AI site reliability engineering for Zerops-hosted fleets.**

OpsMate sits beside your Zerops project (or a local sandbox “patient”) and turns platform signals into diagnosis, a weighted deployment health score, project-scoped chat, architecture findings, and guided remediation — without inventing another team’s services or mixing fleets.

## Quick start

### Sandbox (no token)

1. Start Postgres (compose), API, demo patient, and dashboard (see below).
2. Open the dashboard. First load opens the product **story** landing, then enter the console.
3. Use **Chaos lab**, **Incidents**, **Health**, and **Chat** against local services: `demo`, `api`, `dashboard`, `db`.

### Live Zerops project

1. Dashboard → **Connect** → paste a Zerops **Personal Access Token**.
2. Select a project. Health, incidents, chat, and inventory scope to that `project_id` only.
3. **Chaos lab is disabled** while a live project is selected (deliberate). Restart may call the Zerops API when a stack matches.

Token lives in the API **cookie session** (`opsmate.sid`), not Postgres.

## The ops loop

```text
Signal  →  Diagnosis  →  Remediate  →  Architecture
  │            │              │              │
  │            │              │              └─ yaml review / live inventory sketch
  │            │              └─ suggested fix steps, optional restart
  │            └─ LLM + rule fallback → incidents table
  └─ Zerops status, log ingest, chaos lab, metrics
```

| Stage | What you see in the UI |
|--------|-------------------------|
| Signal | Logs, chaos triggers, READY_TO_DEPLOY / unhealthy stacks |
| Diagnosis | Incident cards with explanation + severity |
| Remediate | Suggested steps, **Restart service** when Zerops API allows |
| Architecture | YAML or inventory-based findings |

Full docs: [`docs/`](./docs/).

## Documentation map

| Doc | Contents |
|-----|----------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System layout, data model, sandbox vs live |
| [docs/DEPLOYMENT_HEALTH.md](./docs/DEPLOYMENT_HEALTH.md) | Weighted health score |
| [docs/INCIDENTS.md](./docs/INCIDENTS.md) | Lifecycle, counts, grouping |
| [docs/CHAT.md](./docs/CHAT.md) | Context assembly and scoping rules |
| [docs/API.md](./docs/API.md) | HTTP surfaces and session auth |
| [docs/CHAOS_LAB.md](./docs/CHAOS_LAB.md) | Demo chaos triggers |
| [docs/internal/](./docs/internal/) | Maintainer gotchas + release checklist |

## Tech stack

| Layer | Implementation |
|-------|----------------|
| Dashboard | Vite + React SPA (`dashboard/`), default port **3000** |
| API | Express (`api/`), port **8080**, syslog **5514** |
| Demo patient | Express (`demo-api/`), HTTP **3001**, metrics **9090** |
| Database | Postgres 16 (`docker-compose.yml`, host **5433** → container 5432) |
| Zerops | REST via `api/services/zeropsApi.js` with session-held PAT |
| LLM | Groq primary → OpenRouter fallback → **rules** (`diagnosisEngine.js`). Keys in `api/.env` only |

## Local run

```bash
cd "zerops v2"
docker compose up -d

cd api && cp .env.example .env   # set DATABASE_URL to :5433 if using compose
npm i && npm run dev

cd ../demo-api && cp .env.example .env
npm i && npm run dev

cd ../dashboard && npm i && npm run dev
```

- Dashboard: http://localhost:3000  
- API probe: http://localhost:8080/  
- Point API `DATABASE_URL` at compose:  
  `postgresql://opsmate:opsmate_secret@localhost:5433/opsmate`

## Deploy

`zerops.yaml` at **repo root** builds each service from monorepo subfolders (`cd api|dashboard|demo-api`). Migrations run on **api** process start.

After first deploy, set on **dashboard** runtime env:

- `PUBLIC_API_URL` — public https URL of the `api` service  
- `PUBLIC_DEMO_URL` — public https URL of the `demo` service  

Link managed Postgres `DATABASE_URL` and LLM keys on **api** in the Zerops GUI.

## Contributing

Keep chat, health, and Services inventory on one scope path (`opsContext`). Run the [content checklist](./docs/internal/CONTENT_CHECKLIST.md) before demos. Prefer small PRs with migrations under `api/migrations/`.

## License

No license file is set in this tree yet — treat as private/team project until SPDX/LICENSE is added.

## AI tools note

Built with assistance from Cursor and related AI tooling. LLM providers are configured via env (Groq / OpenRouter).
