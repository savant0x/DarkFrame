# FID-20260908-001: Tutorial move tracking broken — reader/writer contract mismatch (step 7 stuck)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-001-tutorial-move-tracking-contract-mismatch.md`
**ID:** FID-20260908-001
**Severity:** HIGH (progression-blocking: the 15-move step can never complete)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

The movement tutorial's final step (`movement_free_exploration`, "Move 15 times") can never complete. The move route reads the stored count by treating the tracking row as a Mongo document (`tracking?.currentCount`), but the only writer (`updateActionTracking`) serializes the count **inside the `action_type` varchar as JSON** (`{"currentCount":N,"targetCount":15}`). The reader therefore always sees `undefined`, resets `currentCount` to 1 per move, and the step never reaches 15. The same mismatch exists in `app/api/tutorial/track-action/route.ts` (move/harvest/attack branches).

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Writer stores count inside `actionType` JSON string | `lib/tutorialService.ts:917-926` | `const trackingData = JSON.stringify({ currentCount, targetCount });` then `.set({ actionType: trackingData, ... })` |
| 2 | Move route reads `tracking?.currentCount` off the row object — wrong contract | `app/api/move/route.ts:157-160` | `const tracking = await trackingCollection.findOne({...}); const currentCount = (tracking?.currentCount ?? 0) + 1;` |
| 3 | Same mismatch in track-action route (3 branches) | `app/api/tutorial/track-action/route.ts:87-141` | identical `trackingCollection.findOne` + `tracking?.currentCount ?? 0` in move/harvest/attack branches |
| 4 | The row has no `currentCount` column at all | `lib/db/schema/tutorial.ts:31-44` | `tutorialActionTracking` columns: id, playerId, stepId, actionType varchar(30) **notNull**, completed, lastUpdated — no count column |
| 5 | The correct read helper already exists and parses the JSON | `lib/tutorialService.ts:888-913` | `getActionTracking` parses `JSON.parse(row.actionType)` → `{ currentCount, targetCount }` |
| 6 | Step definition requires 15 moves | `lib/tutorialService.ts:276` | `action: 'MOVE'`, `validationData: { requiredMoves: 15, anyDirection: true }` (step order 6 = operator's "step 7", 1-indexed) |
| 7 | Shim registry resolves `tutorial_action_tracking` to the pg table — reads hit the same row the writer updates, so the read succeeds but the parsed shape is wrong | `lib/mongodb.ts:546-548` | registry entry maps the collection to `schema.tutorialActionTracking` |
| 8 | Writer is reached from move + track-action routes (Law 4 wiring confirmed) | referencedBy index | `updateActionTracking` called by `app/api/move/route.ts:216`, `track-action:106/126/140` |

**Call-graph (Law 4):** client move POST → `app/api/move/route.ts` POST → `getCurrentQuestAndStep` → shim `findOne(tutorial_action_tracking)` → **reads `actionType` as if it were a plain int field** → count resets. Writer path: same routes → `updateActionTracking` → drizzle → row JSON updated. Both hit the same physical row; only the read contract is wrong.

## 3. Impact Analysis

- **Affected:** every player in the tutorial's movement quest; harvest/attack tracking steps share the identical bug class.
- **Failure modes:** step 7 permanently incomplete (operator-observed); subsequent `requiredHarvests`/`requiredAttacks` steps would also never complete.
- **Blast radius of fix:** read paths in 2 route files only. No schema change, no writer change, no API contract change.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — single canonical read helper covers move/harvest/attack; direction-filtered moves still counted only when matched |
| Scales? | Yes — one indexed row read per action, same as today |
| Hostile attacker? | Yes — no new trust surface; counts remain server-derived; race-safe upsert already in the writer (comment at `lib/tutorialService.ts:938-945`) |
| Maintainable? | Yes — one reader contract (`getActionTracking`), duplicates deleted (Law 13) |
| Industry standard? | Yes — single source of truth for the row shape |

## 5. Proposed Fix (GREEN)

- **Approach:** route the two routes' reads through the existing `getActionTracking` helper (exported), deleting the raw shim `findOne` reads. `currentCount = (await getActionTracking(playerId, stepId))?.currentCount ?? 0` then the existing `+1`/direction logic unchanged. The direction normalizer in the move route is kept (it is move-route-local UI semantics).
- **Alternatives considered:** (a) add a real `current_count` integer column — rejected: schema migration + writer rewrite for a problem one helper solves; (b) parse `actionType` JSON inline in routes — rejected: duplicates the parser (Law 13), exactly the drift that caused this bug.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/tutorialService.ts` | modify | export `getActionTracking` (+ export its `ActionTracking` type) |
| `app/api/move/route.ts` | modify | replace shim findOne + `tracking?.currentCount` with `getActionTracking` |
| `app/api/tutorial/track-action/route.ts` | modify | replace the 3 shim findOne reads with `getActionTracking` |

- **Verification plan:** `npx tsc --noEmit` → 0; eslint on touched files → 0; `npx vitest run` → 354/0/1; plus a live-drive verification: move 15 times with tutorial active, observe count climb to 15 and step auto-complete (operator or preview drive).
- **Call-graph reachability plan:** `git grep -n "getActionTracking" -- lib app` shows all three call sites post-change; `git grep -n "trackingCollection" -- app` returns 0 (dead reads removed).

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest on touched files | *(paste at implementation)* | pass |
| Method 2: manual re-read | read/write contract alignment against §2 evidence | *(paste at implementation)* | pass |

- Audit outcome: **FAIL → SELF-CORRECT** — implementation-time live-DB probe falsified GREEN assumption #2 ("schema + writer untouched"):
  - Probe (pg, live Supabase): `tutorial_action_tracking` columns = id/player_id/step_id/**action_type varchar(30)**/completed/last_updated; **table is EMPTY**; `tutorial_progress` shows player `fame` stuck at exactly `current_step_index: 6` (the operator's step 7).
  - Root cause deepened: the writer's JSON (`{"currentCount":0,"targetCount":15}` = 35 chars) **exceeds action_type varchar(30)** → every write throws "value too long" → swallowed by the routes' try/catch → nothing ever persists. The read-side mismatch and the write-side truncation compound.
- Circuit breakers: one self-correct pass (change delta well under 10% of FID).

### SELF-CORRECT → revised GREEN (supersedes §5 scope additions)

Additional changes, same approach (one JSON contract, one reader):

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/db/migrations/0018_tutorial_action_type_widen.sql` | create | `ALTER TABLE tutorial_action_tracking ALTER COLUMN action_type TYPE varchar(160);` (house pattern: migration 0014 fixed the identical varchar-too-short defect on mod_log) — holds count JSON + MOVE_TO_COORDS extras (targetX/Y, startX/Y, moveCount ≈ 105 chars worst case) |
| `lib/db/schema/tutorial.ts` | modify | `actionType` length 30 → 160 to match |
| `lib/tutorialService.ts` | modify | `updateActionTracking` gains optional `extraData: Record<string, number>` merged into the JSON (serves MOVE_TO_COORDS target persistence through the ONE writer); `ActionTracking` interface carries the optional extras |
| `app/api/move/route.ts` | modify | MOVE_TO_COORDS dynamic-target branch: read/​write through `getActionTracking`/`updateActionTracking` (the shim silently DROPPED targetX/Y $set keys on this non-doc table — targets re-randomized every move); dead shim init + `TutorialMoveTracking` removed |

## 7. Implementation Record

- **Status:** done
- **Files changed:** `lib/db/migrations/0018_tutorial_action_type_widen.sql` (new) · `lib/db/schema/tutorial.ts` (action_type 30→160) · `lib/tutorialService.ts` (getActionTracking exported + hardened JSON parse with Law-14 logging; updateActionTracking gains `extraData`) · `app/api/move/route.ts` (MOVE + MOVE_TO_COORDS reads/writes through the contract; shim client + dead `TutorialMoveTracking` + unused import removed) · `app/api/tutorial/track-action/route.ts` (3 branches through the contract; dead shim client removed)
- **Verification evidence:** `npx tsc --noEmit` → exit 0 (after fixing a doubled `export` modifier and `unknown ?? 0` narrowing caught by the gate); touched-file eslint → 0 findings; live migration applied + verified (`action_type length now: 160`); `npx vitest run` → **354 passed / 0 failed / 1 skipped**
- **Call-graph reachability evidence:** `git grep -n "getActionTracking" -- lib app` → 4 production call sites (service + move route + track-action ×2); `git grep -n "trackingCollection\|TutorialMoveTracking" -- app` → **0** (dead reads/writes eliminated)
- **Live-DB repair note:** migration applied to the live Supabase (column verified 160). The table was EMPTY (no data to preserve); player `fame` remains at step index 6 and will progress normally on the next 15 moves. `dbSetup.ts` replays 0018 for fresh environments.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] call-graph proven · [x] migration applied+verified live
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add lib/db/migrations/0018_tutorial_action_type_widen.sql lib/db/schema/tutorial.ts lib/tutorialService.ts app/api/move/route.ts app/api/tutorial/track-action/route.ts`

## 8. Closure

- **Gates:** [ ] typecheck 0 · [ ] lint 0 · [ ] tests pass · [ ] call-graph proven
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add lib/tutorialService.ts app/api/move/route.ts app/api/tutorial/track-action/route.ts`
