# Gotchas (maintainer history)

Patterns that already caused user-facing trust failures. Prefer preventing in review rather than rediscovering in demos.

---

## 1. Empty chat inventory vs Services page

**Symptom:** Chat answered “no services listed” while Services showed demo / api / dashboard / db.

**Cause:** `listServices` returned `[]` for sandbox; `/status` independently injected a local inventory fallback. Prompt forbade inventing demo names unless present in inventory.

**Fix:** Shared `SANDBOX_INVENTORY` in `opsContext.js`; sandbox/connected-no-project chat and status must use the same list. Live inventory still comes only from Zerops (never invent on failure).

**Rule:** Any new consumer of inventory must go through `buildOpsContext` / exported `SANDBOX_INVENTORY`, not invent a third list.

---

## 2. Open incident count: full open set vs recent mixed window

**Symptom:** Chat/Health said “25 open”; Incidents UI implied ~11 open (within a small mixed feed).

**Cause:** Health/chat listed **open-only** rows (or counts). UI used `GET /incidents?limit=40` **all statuses**, then client-filtered to open — resolved rows in the recent window pushed older open rows out of the page.

**Fix:** `countIncidentsByStatus` as SSOT; `GET /incidents` returns `openCount` / `resolvedCount`; dashboard badges prefer those fields.

**Rule:** Never define “open count” as `.filter(open).length` on a truncated multi-status list.

---

## 3. Sandbox double-score: FAIL connection + PASS sandbox

**Symptom:** Deployment health punished demo mode for not being connected while also rewarding “sandbox mode”.

**Fix:** Single INFO row `sandbox_mode` with weight **0** when not live. Live gets pass `Zerops connection` instead.

Documented in [DEPLOYMENT_HEALTH.md](../DEPLOYMENT_HEALTH.md).

---

## 4. Pure-sum open incidents floored 0/10

**Symptom:** Graduated severity still hit zero under volume of mediums/lows.

**Fix:** Severity-sorted geometric decay `(0.62)^i` + soft cap `0.9 × weight` in `scoreOpenIncidents`.

---

## 5. Chaos reliability (historical)

**Issues:** Dual diagnose (API + demo ingest); LLM latency on chaos path; silent demo miss.

**Direction taken:** Local diagnose is SSOT for lab; demo best-effort with skipDiagnose; `forceNew` + `skipLlm` for chaos-lab source.

---

## 6. Auth confusion

OpsMate does **not** accept client `Authorization: Bearer` for the user’s PAT. PAT enters via `POST /zerops/connect` into cookie session (or server env). Bearer is only outbound toward Zerops/LLM.

---

## When adding features

1. New UI metric over incidents → use `countIncidentsByStatus` or documented open filters.  
2. New copy claiming “N services” → same inventory as `/status`.  
3. New live-only tool → disable or 403 when no selected project; never break live from chaos paths.
