# Deployment health

Weighted score implemented in `api/services/healthScore.js` as `computeHealthScore`.

See also: [ARCHITECTURE](./ARCHITECTURE.md) · [INCIDENTS](./INCIDENTS.md)

---

## Overall formula

```text
score = round( sum(earned) / sum(weight of scorable checks) × 100 )
```

- **Scorable checks:** `weight > 0` and not `informational`.
- **INFO rows** (`weight: 0` or `informational: true`): never enter numerator or denominator.
- Per check `status`: `info` | `pass` | `partial` | `fail` from `statusFromEarned(earned, weight)`.

Returned on `/status` and `/status/health` as `health.score`, `health.checks[]`, `health.mode` (`live-project` | `sandbox`).

---

## Live project checks

Active when `opts.projectServices` is a non-empty array (Zerops inventory present).

| id | Label | Weight | Logic |
|----|-------|--------|-------|
| `live_project_linked` | Zerops connection | **12** | Always full pass when live inventory exists |
| `app_services_active` | Application services | **28** | Proportional: `active / totalApps × 28` (excl. system/`core`) |
| `no_pending_deploys` | Deploy state | **18** | Proportional: `(totalApps − pending) / totalApps × 18` |
| `fleet_ratio` | Fleet health | **12** | Same ratio as app services × 12 |
| `local_patient_or_edge` | Edge probe (optional) | **6** | Demo `GET /` ok **or** live (pass if live even when demo down) |
| `opsmate_api` | OpsMate API | **10** | Self-probe `GET http://127.0.0.1:$PORT/` |
| `ssl_surface` | TLS / public surface | **6** | Fraction of “publicish” or all app services **ACTIVE** × 6 |
| `llm` | AI diagnosis | **6** | Any of `OPENROUTER_API_KEY` / `LLM_API_KEY` / `GROQ_API_KEY` set |
| `incidents` | Open incidents | **10** | Graduated open score (below) |

Optional weight-0 row `informational_events` when excluded open rows exist.

---

## Sandbox checks (no live inventory)

| id | Label | Weight | Logic |
|----|-------|--------|-------|
| `sandbox_mode` | Sandbox mode (no live project connected) | **0 INFO** | Does **not** affect earned or possible points |
| `local_patient_or_edge` | Demo patient | **16** | `GET DEMO_API_URL/` must succeed for pass |
| `metrics` | Metrics scrape | **10** | `GET DEMO_API_URL/metrics` |
| `opsmate_api` | OpsMate API | **10** | Self-probe as above |
| `ssl_surface` | TLS / public surface | **6** | Full platform credit (does not re-deduct local probes) |
| `llm` | AI diagnosis | **6** | Key configured? |
| `incidents` | Open incidents | **10** | Same graduated formula |

**There is no FAIL “Zerops connection” row in sandbox.** Connection status is informational only so demos are not double-penalized.

Example healthy sandbox scorable total:  
`16 + 10 + 10 + 6 + 6 + 10 = 58` → score **100** if all pass and zero scoring incidents.

---

## Proportional multi-item checks

`scoreAppServices(active, total, weight) = (active / total) * weight` (0 if `total ≤ 0`).

**Example:** 3 of 4 application services ACTIVE on the 28-pt check:

```text
earned = 3/4 × 28 = 21 → partial 21/28
```

Deploy state uses pending count (e.g. READY_TO_DEPLOY) the same way on 18 pts.

TLS live mode: among services whose names look public-facing (`api|web|dash|…`), or all apps if none match:

```text
earned = (ACTIVE_count / pool_size) × 6
```

---

## Open-incidents scoring

Budget **`INCIDENT_WEIGHT = 10`**. Function: `scoreOpenIncidents`.

### Exclusions (`isExcludedFromHealthScoring`)

Do not deduct:

- `status` not open  
- `no_action === true`  
- text match on title/explanation/`suggested_fix` for *no action needed*, *deliberate chaos*, etc.

Excluded open rows may appear as informational events (weight 0), not as FAIL.

### Severity base cost (`SEVERITY_DEDUCTION`)

| Severity | Points |
|----------|--------|
| `critical` | 5 |
| `high` | 3 |
| `medium` | 1.5 |
| `low` | 0.25 |

Unclassified severity → **`medium`** (`normalizeSeverity`).

### Formula

1. Keep only non-excluded open incidents.  
2. Sort by severity rank: critical → high → medium → low.  
3. Geometric decay on index `i` (0-based):

```text
raw += SEVERITY_DEDUCTION[severity] × (0.62 ^ i)
```

4. Soft cap:

```text
softCap = weight × 0.9     # 9 of 10
deduction = min(softCap, raw)
earned = max(0, weight − deduction)
```

So volume of LOWs alone cannot zero the bucket; clustered criticals can still nearly empty it.

### Count input

Prefer the open incident **rows** list for severity. When only a number is passed, that many **medium** phantoms are used.  
Authoritative **counts** for UI/chat come from `countIncidentsByStatus` (open only) in `opsContext.js` — see [INCIDENTS](./INCIDENTS.md).

---

## Status mapping

| earned vs weight | status |
|------------------|--------|
| weight ≤ 0 | `info` |
| earned ≤ 0 | `fail` |
| earned ≥ weight | `pass` |
| else | `partial` |

---

## Known limitations

- Live mode self-probes `127.0.0.1` for OpsMate API — correct inside one host; multi-host deploy may need care.
- LLM check only verifies key presence, not live provider health.
- Edge/demo probe may still cost weight in live mode if not marked “skipped” with full points when demo is intentionally off (live passes demo probe when `live === true`).
