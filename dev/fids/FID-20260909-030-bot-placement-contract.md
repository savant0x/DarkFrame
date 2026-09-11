# FID-20260909-030: Bot spawn placement — no terrain, bounds, or tile-claim validation

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-030-bot-placement-contract.md`
**ID:** FID-20260909-030
**Severity:** HIGH (bots placed on resource tiles / off-map; bases invisible and tiles double-claimable)
**Status:** converged
**Created:** 2026-09-09
**Related:** FID-20260909-028 (admin flows), 9c8ea0f (bot name fix — same "never ran the repair" family), docs/README_NEW.md §Terrain Distribution

---

## 1. Summary

Operator visited a bot base the admin panel placed at (148,117) and found a Metal
harvest node. Diagnosis confirmed **no spawn path validates placement** — and the docs
already contain the rule that was never enforced:

> docs/README_NEW.md §Terrain Distribution: **Wasteland — 40% — "Empty tiles, spawn
> locations."**

The human path implements this correctly: `findAndClaimSpawnTile` (lib/playerService.ts)
selects an **unoccupied Wasteland tile**, then **claims it** (`occupiedByBase=1`,
`baseOwner=<username>`) so the map/UI renders the base and the tile can never be handed
to another player. All four bot spawn paths bypass every part of that contract.

## 2. Verified defect map

### 2.1 No terrain validation (all bot paths)

- `beerBaseService.getRandomPosition()` (L407): raw `Math.random() * MAP_SIZE` — any
  terrain. Live proof: "Rusted Redoubt" was assigned base (148,117) = **Metal** node.
- `botService.getRandomPositionInZone()` (L487): same, constrained to a 50×50 zone sector.
- `botSummoningService` (L115): delegates to `createBotPlayer` → same.
- `app/api/admin/bot-spawn/route.ts` (L98): `position || { Math.random() * MAP_SIZE }` — same.

### 2.2 Off-map coordinates

- Tile grid is **1..150 × 1..150** (live probe: min 1, max 150, 22,500 tiles).
- `beerBaseService` / `botService` random: `Math.floor(Math.random() * 150)` → **0..149**;
  x=0/y=0 is off-map (tile zero does not exist).
- **Admin bot-spawn route: `const MAP_SIZE = 5000`** (L88) — spawns can land at
  (3, 4821): coordinates with no tile at all. The player table would hold a base the
  world does not contain.

### 2.3 No tile claim — invisible bases, double-claimable tiles

- Bot writes never touch `tiles.occupiedByBase` / `baseOwner`. Live proof: the surviving
  bot's base tile (114,55) has `occupied_by_base = NULL`.
- Consequences: (a) the map never renders bot bases (the UI reads `base_owner`);
  (b) `findAndClaimSpawnTile` only filters `occupiedByBase IS NULL`, so a new **human**
  can be spawned onto a tile a bot already "occupies" — two bases, one tile.

### 2.4 Design source of truth (this is the doc)

- Terrain rule: docs/README_NEW.md — Wasteland is the spawn terrain.
- Mechanism precedent: `findAndClaimSpawnTile` — Wasteland ∧ unoccupied ∧ claim.
- Zone discipline: `getRandomPositionInZone` maps zones 0–8 onto the 150-grid correctly
  (sector `[zX*50+1, zX*50+50]`); the placement contract must preserve it.

## 3. Remediation contract

| # | Fix | Files | Contract |
|---|-----|-------|----------|
| A | Shared placement helper `claimBotBaseTile({ zone, ownerUsername })` | `lib/botService.ts` | Wasteland ∧ `occupiedByBase IS NULL` ∧ (zone sector bounds or whole map), `ORDER BY random() LIMIT 1`, conditional claim UPDATE (`WHERE occupiedByBase IS NULL` — race-safe like the human path), retry ≤5, throw when exhausted (loud, Law 14). Returns the claimed tile row. |
| B | `createBotPlayer` uses the claimed tile | `lib/botService.ts` | Position = claimed tile coords; zone semantics preserved (claim within sector). |
| C | `spawnBeerBase` uses the helper; deletes the post-hoc position override | `lib/beerBaseService.ts` | Claim once with the FINAL username (name set before claim — collision-retry must re-claim if name changes); `getRandomPosition()` deleted. |
| D | Admin bot-spawn route uses the helper | `app/api/admin/bot-spawn/route.ts` | `MAP_SIZE = 5000` removed; explicit `position` honored ONLY if it is an unoccupied Wasteland tile (else 400); default path claims normally. |
| E | Existing-data repair | one-shot SQL | Claim (114,55) for Flag_Bearer_1027 (visibility + anti-double-claim). Its terrain (Factory) violates the Wasteland rule — **operator decision** whether to re-home the flag bot; not moved unilaterally (flag game state). |
| F | Regression tests | `__tests__/lib/botPlacement.test.ts` | Wasteland-only filter, sector bounds per zone, claim write shape, exhaustion throw, race-loss retry. |

## 4. Non-goals

- No flag-bot re-homing (operator call, §3-E).
- No map-regeneration or terrain rebalance.
- No change to `findAndClaimSpawnTile` itself (humans are already correct).

## 5. Implementation log

- **Fix A** — `claimBotBaseTile` / `releaseBotBaseTile` added to botService:
  Wasteland ∧ unoccupied ∧ (zone sector | whole map), race-safe conditional
  UPDATE with `.returning()` verification, ≤5 retry attempts, loud throw on
  exhaustion (never silently placed on an illegal tile). Sets `baseOwner` so
  bases render on the map and cannot be double-claimed.
- **Fix B** — `createBotPlayer` consumes the claimed tile (no more raw
  `Math.random()` placement).
- **Fix C** — `spawnBeerBase` claims under the final themed name; collision
  retry re-attributes the tile on rename; `removeBeerBase` releases the claim
  on defeat; dead `getRandomPosition` removed; dead Mongo-era
  `removeAllBeerBases` removed (also severed botService's last `@/lib/mongodb`
  import).
- **Fix D** — admin bot-spawn route: `MAP_SIZE = 5000` (off-map on a 150×150
  world) removed in favor of the canonical `GAME_CONSTANTS.MAP_WIDTH/HEIGHT`;
  explicit positions now validated as Wasteland ∧ unoccupied before spawn;
  spawn schema gained the position bounds.
- **Fix E (live repair)** — 19 ghost tile claims held by deleted test/probe
  bots released; Flag_Bearer_1027 re-seated (114,55) Factory → (41,88)
  Wasteland via the new helper (`scripts/reseat-flag-bearer.ts`), claim and
  player row verified consistent.
- **Fix F** — `__tests__/lib/botPlacement.test.ts` (5 tests): claim shape,
  empty-pool loud throw, race-lost retry, retry exhaustion, owner-scoped
  release. Harness serves deterministic candidates and resolves claims
  against the served tile (no drizzle-SQL-tree parsing).
- **Found during Fix C** — the weekly respawn deleted Beer Bases but never
  released their tile claims: every despawned base permanently drained a
  Wasteland tile from the spawn pool. `removeBeerBase` now releases.

## 6. Gates

- `tsc --noEmit`: 0 errors.
- `eslint` (all touched files): 0 problems.
- `vitest run`: **413 passed / 1 skipped** (31 files) — includes the 5 new
  placement-contract tests and 10 bot-name contract tests.
- `next build`: exit 0, zero prerender errors.
- Live DB verification: every surviving bot claim terrain-legal,
  owner-consistent; claims (6) ≤ players (7) with zero ghosts.

## 7. Residuals & follow-ups

- RESOLVED during closure: Flag_Bearer_1027 re-seated to Wasteland (41,88).
- The 4 Beer Bases deleted in the FID-029-adjacent username purge were not
  respawned (1 bot remains of the prior 5). The committed weekly respawn path
  (`beerBaseManager` job → `weeklyBeerBaseRespawn`) or the admin manual
  respawn endpoint will repopulate from config on the next cycle — operator
  may also trigger it immediately from the admin panel.
- `getRandomPositionInZone` distributes bots uniformly in-sector; a future
  enhancement could weight Wasteland density, unnecessary now that the helper
  filters by terrain.
- The admin "fix-base" route (app/api/admin/fix-base/route.ts) also writes
  occupancy — audited as out of scope here; it should be migrated to the
  shared helper if it ever mutates bot bases.
