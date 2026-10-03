# FID-20261003-002: UI attrition surfacing — survivors, per-round losses, saved-army floor note

**Filename:** `FID-20261003-002-ui-attrition-surfacing.md`
**ID:** FID-20261003-002
**Severity:** LOW
**Status:** loop-complete
**Created:** 2026-10-03

---

## 1. Summary

FID-20261002-013 made the combat engine attrition-truthful (per-copy HP,
`survivorCount`, truthful per-round casualty sums, the human-defender
saved-army floor note) and the raid route already ships the FULL battle log to
the client (`battle: committedLog`), but no live UI renders the new truth:
`survivorCount` reaches no surface anywhere, the floor note is set on
`battleLog.notes` and then read by NOTHING (there is no `notes` column — it
exists only in the transient log object), and per-round deaths render only in
the inbox report card. This FID surfaces the three pieces on the live surfaces
with zero API/schema changes.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | The raid response already carries the full log: `battle: committedLog` (both victory and defeat branches) — survivors, rounds, notes all reach the client; only the render is missing | `app/api/combat/attack/route.ts:720-724, 727-731` | `return NextResponse.json({ success: true, victory: true, message, rewards: {...}, battle: committedLog })` |
| 2 | `survivorCount` is stamped by resolveBattle but rendered by nothing: repo-wide grep of components/app for `survivorCount` outside types/lib/tests → zero hits | `types/game.types.ts:2245`; `lib/battleService.ts:856,874` | `grep -rn "survivorCount" components app --include=*.tsx` → 0 |
| 3 | The floor note goes nowhere: the route sets `battleLog.notes` (line 585) but `battleLogToDbInsert` has no notes field (no column), `formatBattleResultMessage` emits only `battleLog.message`, and no component reads `notes` | `app/api/combat/attack/route.ts:585`; `lib/battleNotification.ts:113`; `lib/db/schema/battle.ts` | `grep -rn "Saved-army floor" lib app` → route writer only; `grep notes lib/battleNotification.ts` → absent |
| 4 | Per-round deaths ARE surfaced in the inbox card (formatter line 93 "— losses A X / D Y" → parser `parseRoundLine` → `RoundRow` "losses X / Y") — that channel is complete; the IMMEDIATE readouts (TileRenderer attack badge, BeerBasePanel result modal) render damage/rewards only | `lib/battleNotification.ts:93`; `components/messaging/BattleReportCard.tsx:81-97`; `components/TileRenderer.tsx:960-963`; `components/BeerBasePanel.tsx:376-399` | read of the four blocks |
| 5 | The parser already routes any `•`/`ℹ️` line under CASUALTIES & RESULTS into the card's results — new formatter lines need NO parser/card changes | `lib/battleReportParser.ts:228-234` | `if (!/^\s*(•\|ℹ️)/.test(line)) continue; report.results.push(...)` and the test pin `expect(r.results.map(l => l.text)).toContain('ℹ️ extra note line')` |
| 6 | `BattleResultModal` (the only component rendering participant HP/damage detail) is ORPHANED — zero render sites (the FID-20260919-003 dead-UI class) — so it is NOT a live surface and gets no changes here | `components/BattleResultModal.tsx` | `grep -rln "BattleResultModal" components app --include=*.tsx` → definition + test only |

Call-graph notes (Law 4): live surfaces are (a) the inbox battle report card —
`resolveBattle` → `persistBattleLog`/raid-route post-commit → `notifyBattleResult`
→ `formatBattleResultMessage` → messages table → `MessageThread` →
`BattleReportCard`; (b) the game-page raid readout — `/api/combat/attack`
response `battle` → `handleBaseAttack` → `setAttackResult` → `TileRenderer`
attack badge; (c) the Beer-base raid modal — same route → `BeerBasePanel`
`setAttackResult(data)` → result modal.

## 3. Impact Analysis

- **Who/what is affected:** presentation only. Both raid participants' inbox
  reports gain two lines; the attacker's immediate readout (tile badge) and the
  Beer-base modal gain an attrition strip. No API, schema, engine, or
  persistence change.
- **Failure modes if unfixed:** the operator-approved FID-013 attrition truth
  (survivors, floor note) stays invisible to players; the floor note in
  particular is computed and then dropped — work with no consumer (the Law 17
  class of silent accretion, at the UI layer).
- **Blast radius of the fix:** one type extension (optional field), two route-
  INDEPENDENT mappings, three render blocks, one formatter (+2 lines). The
  formatter's text is parser-pinned — additions flow through the existing
  `•`/`ℹ️` rules; no parser/card edits.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — survivor display derives a fallback (`units.length − unitsLost`) when `survivorCount` is absent (historical rows), per the type's own optionality comment. |
| Scales? | Yes — per-round losses render as a compact joined list; a 100-round cap bounds it. |
| Survives a hostile attacker? | Yes — everything rendered comes from the server-derived log the client already receives; no new trust boundary. |
| Maintainable in 2 years? | Yes — one optional typed field, no duplicated state; the formatter remains the single report-text writer. |
| Sets the standard? | Yes — the report text stays the single source the card parses; the readouts read the same log object. |

## 5. Proposed Fix (GREEN)

- **Approach:** extend `AttackResult` with the optional full log
  (`battle?: BattleLog`) the route already sends, pass it through the game
  page's two mappings, render a compact attrition strip (survivors, per-round
  losses, floor note) in the TileRenderer attack badge and the BeerBasePanel
  modal, and append the survivors bullet + notes line to the inbox report text
  (which the existing parser rules already surface).
- **Alternatives considered:** flattening four new scalar fields onto
  AttackResult — rejected (duplicates state the log object already carries;
  Law 13); rendering per-round losses in the tile badge as full rows — rejected
  (the badge is a transient overlay; the durable round-by-round surface is the
  inbox card, which already has it); reviving BattleResultModal — rejected
  (orphaned dead UI, finding 6; wiring it is a separate decision).
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `types/game.types.ts` | modify | `AttackResult` gains `battle?: BattleLog` (the route already sends it; typed so readouts read survivors/rounds/notes without duplication). |
| `app/game/page.tsx` | modify | `handleBaseAttack` success + failure mappings pass `battle: data.battle ?? undefined` through to `setAttackResult`. |
| `components/TileRenderer.tsx` | modify | Attack badge block: compact attrition strip when `attackResult?.battle` present — survivors (with the historical-row fallback), per-round loss summary, amber floor-note line. |
| `components/BeerBasePanel.tsx` | modify | Result modal: same attrition strip under the message. |
| `lib/battleNotification.ts` | modify | CASUALTIES & RESULTS: `• Survivors — attacker X of Y · defender X of Y` bullet; emit `ℹ️ {battleLog.notes}` when notes are present. |

- **Verification plan:** `npx tsc --noEmit` 0; `npx eslint .` 0/0; parser +
  formatter text pins (new cases in `battleReportParser.test.ts` and the real-
  formatter pin in `baseRaidFidelity.test.ts`); TileRenderer component pin
  (attrition strip renders from a battle-carrying attackResult); full
  `npm run test:ci` green.
- **Call-graph reachability plan:** grep the render sites (`battle?.attacker`,
  `Survivors`) in the three components; the inbox chain is already wired
  (finding 5's parser pin + `MessageThread` renders `BattleReportCard`).

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis (typecheck/lint/tests) | repo tsc, eslint, targeted + full suites | §7 evidence | pass |
| Method 2: manual re-read against this FID | all five files re-read 0-EOF post-edit; render conditions match §5 | diff review | pass |

- Audit outcome: PASS → `loop-complete` → implementation (operator go-ahead
  recorded in the session scope).

## 7. Implementation Record

- **Status:** done
- **Files changed:** as §5, plus test pins in `__tests__/lib/battleReportParser.test.ts`
  and `__tests__/components/TileRenderer.attrition.test.tsx`.
- **Verification evidence:** pasted in the session record and SCOPE ledger row.
- **Call-graph reachability evidence:** greps pasted in the session record.

## 8. Closure

- **Gates:** [ ] typecheck 0 · [ ] lint 0/0 · [ ] tests pass · [ ] call-graph proven
- **Commit hash (G2):** `<hash>` *(committed by operator)*
- **Staging plan (path-scoped, G3/G4):** `git add types/game.types.ts app/game/page.tsx components/TileRenderer.tsx components/BeerBasePanel.tsx lib/battleNotification.ts __tests__/lib/battleReportParser.test.ts __tests__/components/TileRenderer.attrition.test.tsx dev/fids/FID-20261003-002-ui-attrition-surfacing.md`
- **Commit message (G8):** `feat(combat): surface attrition truth in live battle UIs (FID-20261003-002)`
- **Archive:** on close → `dev/fids/archive/` + CHANGELOG entry.

---

**Final status:** implemented
