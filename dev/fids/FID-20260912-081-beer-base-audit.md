# FID-20260912-081 — Beer Base system audit: units bug, admin roster, tier derivation

## Operator report

"Review the docs for the beer base system — I see multiple bots, but I think the beer bases are
missing entirely, and it's not showing in the admin panel with a list of those bases. I do see
regular bots but not beer bases?"

## Audit verdict: the system is real, enabled, and starving — plus the admin has no eyes on it

### What the docs promise (dev/archive/BEER_BASE_SMART_SPAWNING.md, BEER_BASE_ENHANCEMENTS_PLAN.md)

Beer Bases are special bots (`is_bot ∧ is_special_base`) whose weekly population is a
percentage of the regular bot population (default 5–10%), power-tiered (WEAK→LEGENDARY)
against the live player-level distribution, with variety enforcement, dynamic schedules,
and an analytics dashboard. That design is **good** — tiered threats that track the player
population is the right curve, and it is fully implemented (smart distribution, variety
enforcement, schedules, predictive mode, analytics tables). No redesign needed.

### Defect 1 (critical): spawn-rate units mismatch starves the population

- `DEFAULT_CONFIG.spawnRateMin/Max = 5 / 10` — **percent integers** (route docs, header
  comment, and the admin slider all agree: "0–100 (percentage)").
- `AdminView.handleSaveBeerBaseConfig` posted `spawnRateMin / 100` → the live `game_config`
  row stored **0.05 / 0.1** (fractions).
- `getTargetBeerBaseCount` divides by 100 again: `(0.05 + 0.1)/2 / 100 = 0.00075`. With 51
  regular bots: `floor(51 × 0.00075) = 0` → `Math.max(1, 0)` = **1**.
- The weekly respawn job then deletes every Beer Base and spawns **1** — the population is
  trimmed to a single base every Sunday. Live DB at audit time: **1 special base among 52
  bots**. The system is healthy and executing exactly this wrong number.

### Defect 2 (admin UX): the Beer Base section has config controls but no roster

`AdminView` renders sliders/schedules/analytics for the Beer Base system, and shows only
`botStats.specialBases` as a count. There is **no list of the actual bases** — no way to see
which bases exist, their tiers, positions, power, or loot without querying the DB by hand.

### Defect 3 (player intel): `/api/beer-bases/list` derives tier from a dead username format

The route parses `'-ELITE-'`, `'-STRONG-'` etc. out of the username — the legacy
`🍺BeerBase-<tier>-<ts>` slug format. FID-20260906-007 replaced those with themed place
names ("Silent Citadel"), so every base now renders as WEAK. Tier is recoverable from
`rank` (1–6 = WEAK→LEGENDARY), which `spawnBeerBase` sets on every spawn.

## Fixes

1. **Units healing (lib/beerBaseService.ts)** — `normalizeSpawnRateConfig` heals
   fraction-era values (max ≤ 1 ⇒ scale ×100, clamp 0–100) at every config read, so the
   poisoned DB row self-corrects with no migration. Percent values pass through untouched.
2. **AdminView write fix** — post the slider values as-is (percent integers); the API's
   0–100 validation is now truthful.
3. **New `GET /api/admin/beer-bases/list`** — the roster: name, tier (rank→tier with a
   level-band fallback), level, position, STR/DEF, resources, army size, strength-sorted.
4. **AdminView roster table** — collapsible "Live Roster" in the Beer Base section with a
   refresh control; auto-refreshes after "Manual Respawn Now". (A respawn button already
   existed; the FID wires its result into the new roster.)
5. **`/api/beer-bases/list` tier fix** — rank→tier with level-band fallback, same response shape.

## Tests (15 new)

- `normalizeSpawnRateConfig`: fraction healing, percent passthrough, boundary cases,
  0/0 disabled semantics, field passthrough.
- `getBeerBaseConfig`: poisoned row served healed; canonical row unchanged.
- `getTargetBeerBaseCount`: percent math (51 bots @ 5–10% → 3), cap binding
  (2000 bots → cap 100), no-regular-bots → 0, disabled → 0, floor of 1.
- `/api/admin/beer-bases/list`: roster shape, rank→tier derivation, level fallback, 403 gate.

## Verified live

- Healed build started: config read reports `spawnRateMin = 5, spawnRateMax = 10`.
- Computed target with 51 regular bots: **3** (was 1).
- The weekly top-up ran on schedule minutes after the build went live: population
  **1 → 3** with a healthy tier spread (ELITE rank 4 / STRONG rank 3 / MID rank 2).
- `GET /api/admin/beer-bases/list` serves (403 for anonymous, admin-gated roster).

## Gates

tsc 0 · eslint 0 · vitest **618** (15 new) · build clean.
