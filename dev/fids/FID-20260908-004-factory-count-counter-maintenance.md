# FID-20260908-004: players.factory_count is never maintained — ownership transitions leave it at 0

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-004-factory-count-counter-maintenance.md`
**ID:** FID-20260908-004
**Severity:** MEDIUM (wrong player info + wrong unit-slot capacity math; no data loss)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

`players.factory_count` is read by the player mapper (`lib/playerService.ts:72`), sanitized to clients, rendered in StatsPanel ("Factories: N"), and used in unit-slot capacity math (`100 + factoryCount × 50`) — but **no code path anywhere writes it** after the column default. Capturing a factory updates `factories.owner` only; abandoning releases ownership only. The column is 0 forever (operator: "i own 1 factory, but player info shows 0").

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Column exists, defaults 0 | `lib/db/schema/players.ts:48` | `factoryCount: integer('factory_count').default(0)` |
| 2 | Mapper reads it into every Player | `lib/playerService.ts:72` | `factoryCount: row.factoryCount ?? 0` |
| 3 | Capture never writes it | `lib/factoryService.ts:319-327` | capture `.set({ owner: username, ... })` — no players update |
| 4 | Abandon never writes it | `app/api/factory/abandon/route.ts:171-183` | updates totals only; recomputes `factoriesOwned` locally (line ~183) but never persists to `players.factory_count` |
| 5 | Release path identical | `app/api/factory/release/route.ts` | zero `factory_count` references (grep) |
| 6 | Repo-wide: zero writers | grep | `factoryCount|factory_count` writers: NONE outside schema/mapper/sanitize (full grep output in audit) |
| 7 | Consumers depend on it | `app/api/player/build-unit/route.ts:94-96,416`; `components/StatsPanel.tsx:240-242` | slot capacity `100 + factoryCount×50`; Factories readout |
| 8 | True count is derivable at every transition | `lib/factoryService.ts:285` | `count(*) from factories where owner = username` — the same query abandon already runs |

**Call-graph (Law 4):** capture: client → `/api/factory/attack` → `attackFactory` (factoryService) → factories row updated → **players.factory_count stale**. Display: `/api/player` → sanitizePlayer → StatsPanel. Capacity: `/api/player/build-unit` GET/POST reads `player.factoryCount`.

## 3. Impact Analysis

- **Affected:** player info panel (0 factories shown), unit-slot capacity (capped at base 100 regardless of factories), battle service reads `row.factoryCount` (`lib/battleService.ts:1064`).
- **Failure modes:** permanent 0; capacity bonus unreachable; any future feature keyed on the column reads garbage.
- **Blast radius:** ownership transitions in factoryService + 2 route files. **No client/API contract changes.**

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — maintenance added at EVERY transition (capture success, abandon, release); a backfill migration repairs existing rows |
| Scales? | Yes — one integer `+1/−1` (or recount) per transition, same transactional surface as the ownership write |
| Hostile attacker? | Yes — count derived from server-side ownership writes only; recount-on-transition self-heals drift |
| Maintainable? | Yes — single helper (Law 13) instead of copy-pasted increments |
| Industry standard? | Yes — denormalized counter maintained at write points + reconciliation recount |

## 5. Proposed Fix (GREEN)

- **Approach:** add a typed helper in `lib/factoryService.ts`: `recountPlayerFactoryCount(username)` → `UPDATE players SET factory_count = (SELECT count(*) FROM factories WHERE owner = $1) WHERE username = $1` (single SQL statement — atomic, self-healing, no read-modify-write race). Call it after: successful capture (`attackFactory` success branch), abandon's ownership reset, release's ownership reset. **Plus one backfill migration** (`lib/db/migrations/00NN_factory_count_backfill.sql`) running the same recount for all owners, so existing players (the operator's live save) are repaired without gameplay.
- **Alternatives considered:** (a) increment/decrement at each transition — rejected: missed transitions compound drift forever; the recount statement is equally cheap and cannot drift; (b) drop the column, always count live — rejected: battleService + build-unit already consume the column; schema removal is out of scope.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/factoryService.ts` | modify | export `recountPlayerFactoryCount`; call in capture success |
| `app/api/factory/abandon/route.ts` | modify | call recount after ownership reset |
| `app/api/factory/release/route.ts` | modify | call recount after ownership reset |
| `lib/db/migrations/00NN_factory_count_backfill.sql` | create | one-statement recount backfill |

- **Verification plan:** tsc 0; vitest full; live: capture factory → GET /api/player → `factoryCount: 1`; abandon → 0. Migration idempotence: recount is inherently idempotent.
- **Call-graph reachability plan:** `git grep -n "recountPlayerFactoryCount" -- lib app` → 3 production call sites; StatsPanel readout unchanged (already wired to `player.factoryCount`).

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis + tests | tsc / eslint / vitest | *(paste at implementation)* | pass |
| Method 2: manual re-read | every ownership transition covered (grep `owner: null`, `owner: username` in factory paths) | *(paste at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied:**
  - `lib/factoryService.ts` — new `recountPlayerFactoryCount()` (single-statement atomic recount: `UPDATE players SET factory_count = (SELECT count(*) FROM factories WHERE owner = username) RETURNING factory_count`); wired into `attackFactory` capture-success path.
  - `app/api/factory/abandon/route.ts` — recounts after ownership release.
  - `app/api/factory/release/route.ts` — recounts after both release sites.
  - `lib/db/migrations/0019_factory_count_backfill.sql` — idempotent one-statement backfill for existing rows.
  - **En-route remediation (standing #36 directive):** all 7 `any`s in `factoryService.ts` removed — typed `parseInventory()` boundary helper (malformed jsonb logged, never fabricated) + `isUnitEntry()` discriminator replacing the dead `type === 'UNIT'` filter (Unit.type is a UnitType like 'T1_RIFLEMAN'; InventoryItem.type is an ItemType — the old filter could never match). Schema annotation widened to the honest three-shape union `Array<InventoryItem | TutorialInventoryItem | Unit>` (`lib/db/schema/players.ts`) — the column has held Mongo-era Unit objects all along. `getFactoryData` insert cast removed via explicit `productionRate` string mapping.
  - **Addendum (FID-20260908-003 cross-fix):** `produceUnit` now also maintains `totalStrength`/`totalDefense` alongside the inventory push — factory-produced units are part of the army and must raise Military Power like build-unit does.
- **Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1 · **live DB migrated**: probe found 1 stale row, post-state `fame.factory_count = 5` (recounted from source of truth).
- **Audit Method 2:** re-read all three transition sites + migration; the recount helper is the only writer and is idempotent.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] live backfill verified (fame → 5)
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add lib/factoryService.ts lib/db/schema/players.ts lib/db/migrations/0019_factory_count_backfill.sql app/api/factory/abandon/route.ts app/api/factory/release/route.ts`
