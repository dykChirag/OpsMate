# Content & data parity checklist

Run before demos, releases, or recording the story landing page.  
Maps directly to failures already fixed once — see [GOTCHAS.md](./GOTCHAS.md).

---

## Story / marketing page

- [ ] Hero health % is **live** from `/status` (`healthScore` / `health.score`), not a hard-coded mock (no stale “74%”).
- [ ] Hero score caption matches mode (`sandbox weighted score` vs `live weighted fleet score`).
- [ ] Primary CTA copy equals bottom CTA primary (e.g. **Enter the console**).
- [ ] Secondary CTA is one consistent action (e.g. **Use my Zerops project** → Connect).
- [ ] Nav CTAs do not introduce a third wording for the same two actions unless intentional.
- [ ] Feature “pills” under the hero are **badges**, not a second row of competing buttons.
- [ ] Marquee / jargon ticker sits **after** “How it works” (terms introduced first).
- [ ] Public LLM blurb does not expose unwanted vendor chain (or does, if product chose names deliberately).

---

## Console — data consistency

- [ ] **Services** inventory names match chat context `serviceNames` for the same mode (sandbox: demo, api, dashboard, db).
- [ ] Chat never says “no services listed” when Services shows stacks.
- [ ] Open incident **badge** / Health open line / Chat open sentence use the same **open** total (`openCount` / `countIncidentsByStatus`), not open+resolved and not a truncated mixed list length.
- [ ] Resolved incidents do not increase the open total.
- [ ] Health score on Overview ≈ Health page ≈ chat-quoted health for this project.

---

## Console — mode gating

- [ ] With **no** project: Chaos lab visible/enabled; connection health is INFO sandbox (weight 0).
- [ ] With **live project selected**: Chaos lab blocked; inventory is Zerops services.
- [ ] CTAs: **Connect PAT** used consistently (banner + topbar), not mixed “Use my Zerops PAT” / “Connect PAT”.

---

## Chaos lab (sandbox)

- [ ] Each trigger returns `ok` with an `incidentId` when API/DB healthy.
- [ ] New open card appears without multi-minute wait (rules path for lab).
- [ ] Demo patient offline does not fail the fire (local diagnose SSOT).

---

## Deploy / config

- [ ] `DATABASE_URL` matches compose port when using docker Postgres.
- [ ] LLM keys optional; rules-only mode still answers chat with inventory facts.
- [ ] Session cookie works across dashboard origin (CORS credentials + sameSite).

---

## Sign-off

| Item | Date | Who |
|------|------|-----|
| Checklist complete | | |
| Known open issues noted | | |
