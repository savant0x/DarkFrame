# FID-20260908-003: Military Power invisible (sanitize allowlist gap) + shim $push corrupts unit arrays

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-003-military-power-sanitize-and-units-each.md`
**ID:** FID-20260908-003
**Severity:** HIGH (core combat stat unreadable client-side; unit builds persist a corrupted array element)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

Two defects combine to produce the operator's "built units, strength/power never update" report:

1. **Read-side:** `sanitizePlayer`'s allowlist (`PUBLIC_FIELDS`) omits `totalStrength`/`totalDefense` — the columns exist, are maintained by build-unit routes, are declared on the `Player` type (game.types 416-417), but are **dropped by the projection** before reaching any client. StatsPanel's `?? 0` therefore renders permanent zero.
2. **Write-side:** both unit-build routes push units through the Mongo shim with `units: { $each: newUnits }` (Mongo array-operator syntax). The shim's `$push` handler appends the **operand object verbatim** — it never unwraps `$each` — so every build persists ONE array element that is the literal object `{$each: [...]}` instead of N unit objects.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Allowlist omits both power fields | `lib/playerSanitize.ts:46-100` | `PUBLIC_FIELDS` contains units/factoryCount/resources but NO `totalStrength`/`totalDefense` entries |
| 2 | Allowlist is drop-by-default by design | `lib/playerSanitize.ts:16-19` | "anything not explicitly listed below is dropped" |
| 3 | StatsPanel reads the (dropped) fields | `components/StatsPanel.tsx:206-208` | `const totalPower = (player.totalStrength ?? 0) + (player.totalDefense ?? 0);` — always 0 |
| 4 | Columns are real and typed | `lib/db/schema/players.ts:31` + `types/game.types.ts:416-417` | `totalStrength: integer('total_strength').notNull().default(0)`; Player contract documents both |
| 5 | Builds DO write the columns correctly | `app/api/player/build-unit/route.ts:346-365`, `app/api/factory/build-unit/route.ts:189-206` | `$set: { totalStrength: newTotalStrength, totalDefense: newTotalDefense }` |
| 6 | Shim `$push` does NOT handle `$each` | `lib/mongodb.ts:659-668` | `for (const [key, value] of Object.entries(update.$push ?? {})) { payload[key] = sql`... \|\| ${JSON.stringify([value])}::jsonb` }` — `value` is `{ $each: [...] }` |
| 7 | Both build routes use `$each` | `app/api/player/build-unit/route.ts:351`, `app/api/factory/build-unit/route.ts:196-198` | `$push: { units: { $each: newUnits } }` |
| 8 | Result: each build appends one junk element | consequence of #6+#7 | players.units grows by `{ $each: [...] }` entries — unit counts, playerOwned filters (`u.unitId === unit.id`), and unitCounts all read garbage |

**Call-graph (Law 4):** client build POST → `/api/player/build-unit` or `/api/factory/build-unit` → shim `updateOne(players, {$push: {units: {$each}}})` → corrupted jsonb. Client player GET → `/api/player` → `sanitizePlayer` → StatsPanel/power display. Two independent seams; both must be fixed for the panel to move.

## 3. Impact Analysis

- **Affected:** every player's power display (permanent 0); every unit build (corrupted units array — affects inventory, unit-capacity math `player.units?.length`, build-unit `playerOwned` counts, tutorial `build_unit` validation via `getPlayerGameState`).
- **Failure modes:** power never moves; unit roster polluted with `$each` objects; slot-capacity math inflated by junk entries.
- **Blast radius:** shim `$push` handler (one loop — used by every `$push` caller, so the fix must preserve plain-`$push` semantics), 2 route files (optional route-side cleanup), sanitize allowlist (2 fields), StatsPanel untouched.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — `$push` fix covers scalar-append AND `$each` forms; allowlist addition covers every consumer at once |
| Scales? | Yes — array concat SQL unchanged in shape |
| Hostile attacker? | Yes — allowlist stays allowlist (adding two non-sensitive numeric fields, neither in FORBIDDEN); shim change is server-side only |
| Maintainable? | Yes — shim now honors Mongo `$push` semantics (documented behavior, not a workaround); one place |
| Industry standard? | Yes — driver-compatible shim behavior |

## 5. Proposed Fix (GREEN)

- **Approach:**
  1. `lib/mongodb.ts` `$push` loop: detect `value && typeof value === 'object' && Array.isArray((value as {$each?: unknown}).$each)` → append `$each` array verbatim (`${JSON.stringify(eachArray)}::jsonb`); else current single-element behavior. Type the handler on the shim's own `$push` operand type (no `any`).
  2. `lib/playerSanitize.ts`: append `totalStrength`, `totalDefense` to `PUBLIC_FIELDS` (economy/combat section, after `units`). `SanitizedPlayer` is `Omit<Player, …>` — the fields already exist on the type; no type change.
  3. Route-side cleanup: both build routes may keep `{$each}` form (now honored) — no route change needed. Document in the shim comment.
- **Alternatives considered:** (a) compute power client-side from `units` — rejected: units can be junk/corrupted (this very bug) and bots' power is column-maintained; column is the source of truth; (b) `any`-cast the shim handler — forbidden (Law 6).
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/mongodb.ts` | modify | `$push` handler: unwrap `$each` arrays; typed on the shim operand type |
| `lib/playerSanitize.ts` | modify | `PUBLIC_FIELDS` += totalStrength, totalDefense |

- **Verification plan:** tsc 0; vitest full run; NEW regression test: shim `$push` with `$each` appends N elements and plain `$push` appends 1 (follows the existing shim probe test patterns in `__tests__/lib/`); sanitize proof test asserts both fields present (extends `__tests__/lib/playerSanitize.proof.test.ts`).
- **Call-graph reachability plan:** `git grep -n "totalStrength" -- lib/playerSanitize.ts` (present); `git grep -n "sanitizePlayer" -- app/api/player/route.ts` (unchanged reachability); live: build 1 unit → GET /api/player → fields non-zero (preview drive).

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis + new tests | tsc / eslint / vitest incl. new shim + sanitize tests | *(paste at implementation)* | pass |
| Method 2: manual re-read | `$push` semantics vs Mongo docs; allowlist vs FORBIDDEN set | *(paste at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** done
- **Files changed:** `lib/mongodb.ts` — `$push` handler now unwraps `$each` via a new exported pure helper `normalizePushOperand` (typed on `DocumentValue`, no `any`; plain-array and scalar operands preserve legacy single-element behavior) · `lib/playerSanitize.ts` — `PUBLIC_FIELDS` += `totalStrength`/`totalDefense` (+ removed a dead `Player` import exposed by the lint gate) · `__tests__/lib/pushOperandAndPower.test.ts` (new) — 6 shim-operand cases + 2 projection cases
- **Verification evidence:** `npx vitest run __tests__/lib/pushOperandAndPower.test.ts` → 8/8; `npx tsc --noEmit` → exit 0; touched-file eslint → 0; full `npx vitest run` → **362 passed / 0 failed / 1 skipped**
- **Call-graph reachability evidence:** normalizePushOperand is called by the `$push` builder inside the shim used by both build routes (`app/api/player/build-unit/route.ts:351`, `app/api/factory/build-unit/route.ts:196`); sanitize additions flow through `sanitizePlayer` consumed at `app/api/player/route.ts` (tsc + grep verified)
- **Data-repair note (operator decision pending):** rows built while the bug was live carry `{$each:[…]}` junk elements inside `players.units`; a cleanup migration can strip them once the operator approves scope

## 8. Closure

- **Gates:** [ ] typecheck 0 · [ ] lint 0 · [ ] tests pass · [ ] call-graph proven
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add lib/mongodb.ts lib/playerSanitize.ts __tests__/` (tests path-scoped with the fix)
