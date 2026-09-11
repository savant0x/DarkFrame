# FID-20260909-032: Tutorial flow integrity, admin activity view, factory tracking, HUD polish

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-032-tutorial-factory-hud-batch.md`
**ID:** FID-20260909-032
**Severity:** HIGH (reward silently granted → player trust; admin activity view dead; factory investment tracking wrong)
**Status:** converged
**Created:** 2026-09-09
**Related:** FID-20260909-025 (tutorial CUSTOM-step wiring), FID-20260909-028 (admin flows), FID-20260909-029 (activity coverage), FID-20260909-031 (economy tab)

---

## 1. Summary

Operator playtested the tutorial end-to-end and found eight defects across the tutorial
flow, admin tracking view, factory economy tracking, and HUD polish. Every root cause
below is verified against live DB probes or read code paths.

## 2. Verified defect map

### A — Admin Activity tab renders EMPTY for an active player (CRASH root cause)

`fame` has 15,130 activity rows (probed), yet the Activity tab renders nothing.
Root cause: `app/api/admin/player-tracking/activity/route.ts` L68 uses

```sql
mode() within (group by action)
```

**Invalid Postgres syntax** (ordered-set aggregates require `WITHIN GROUP (ORDER BY …)`,
and even that form fails on this Postgres build — both variants syntax-error, probed).
The route 500s on every call; the modal's `safeJson` swallows the non-JSON body into
`{ success: false }` and the tab silently renders nothing. Fix: replace with the
probed-working `GROUP BY action ORDER BY count DESC LIMIT 1` subquery and **return
honest per-action breakdown** (action, count, last-seen) so the view shows real
tracking data. The UI must also render a visible error state instead of blank.

### B — D-pad buttons too small / don't fill their area

`.nn-dpad` is a fixed 3×46px grid, `width: fit-content` — the cluster floats small in
its sidebar well. Fix: let the grid fill its container (`grid-template-columns:
repeat(3, 1fr)`, `width: 100%` within the panel padding) and grow cells
(`aspect-ratio: 1` so buttons scale up but stay square).

### C — `OUT OF RANGE (+66 TILES)` not centered, overlapping container

`.nn-range` has `text-align: center` but the FlagTrackerPanel renders it inside a
narrow flex column: the long string overflows and clips asymmetrically. Fix: give the
pill `overflow-wrap` safety + letter-spacing reduction at small widths and ensure the
container is block-width (`align-self: stretch`). Visual verify all 4 directions.

### D — Tutorial reward copy is a low-quality emoji blob

`detailedHelp` in `lib/tutorialService.ts` embeds 🎁/✨/💡 emoji and run-on bullet
strings, rendered as one pre-line paragraph. Fix: **two-part fix** —
1. Render `detailedHelp` through the existing WHY/WHEN/HOW sectioning parser by
   adding structured sections to the step (the panel already renders sectioned
   boxes nicely); keep emoji out of the service copy per the neon-noir rubric.
2. Upgrade the `.nn-tut-reward` component to a "reward card": rarity-tagged header
   row (item name + RARE chip), stat-effect rows (+5% Metal / +5% Energy),
   PERMANENT note — driven by a structured `reward.displayMessage` breakdown, not
   inline emoji text.

### E — No reward-grant feedback ("no notification, no confetti")

Live probe: `Tutorial Universal Digger` **IS in fame's inventory** (54 items), digger
counts M24/E20, +5% bonuses applied (38/34 gathering bonus rows). Grant works;
feedback doesn't. Root causes:
- `completeStep` awards the reward server-side and returns `reward` in the response,
  but `TutorialOverlay.handleStepComplete` ignores `result.reward` — no toast/celebration.
- The quest panel's reward boxes are static "you will get" copy, never a granted-state.
Fix: on `result.reward`, fire a celebration toast (react-hot-toast already in the
project) with the reward name/type, and set a granted-state on the reward card
(checkbox→check, "GRANTED" chip) driven by `completedSteps` containing the step.

### F — "Step validation failed" console spam with zero guidance

`build_unit` CUSTOM step: the user clicked Complete before building; server correctly
refuses (`unitCount 0 < 1`) but the overlay only `console.error`s — the joyride modal
stays with no message. Also the harvest AUTO step had already been completed by the
move-route polling (step 3/7 → 7/7 jump), leaving the overlay's cached step stale.
Fix: surface `result.message` as an inline warning in the overlay (nn-note), and
re-pull tutorial state when validation fails so the overlay can't act on a stale step.

### G — Units write shape corrupt: `$each` blob stored literally

Live probe: `players.units` for fame = `[{ "$each": [ {name: Infantry...}, … ] }]` —
the Mongo `$push` **operator was written as literal data**. Root cause:
`app/api/factory/build-unit/route.ts` L195-204 uses Mongo
`$push: { units: { $each: newUnits } }` through the Mongo-compat seam, and the seam
does not translate `$push.$each` for this column — it stored the object verbatim.
Consequences: tutorial `build_unit` validation counts `unit.quantity || 1` per entry
→ counts 1 regardless of quantity; combat/strength consumers reading `units` get a
garbage entry (totalStrength was still updated via `$set` so power numbers "work").
Fix: rewrite the units write as a Drizzle-native jsonb merge on the players table
(read-modify-write inside the same transaction as the resource deduction), with
proper `{unitId, name, quantity, strength, defense, category, createdAt}` entries.

### H — Factory "Invested Metal/Energy 0" and "Lifetime investment 0%"

`/api/factory/list` computes `totalInvestment` only from
`calculateCumulativeCost(level>1)` — upgrade-path cost. Level-1 factories have
invested 0 by definition **even though claim + units-produced cost real resources**,
and the header displays that 0. Fix:
- Compute investment honestly: cumulative upgrade cost + per-factory units-built
  cost where tracked; display label "Upgrades invested" to be truthful about scope.
- Per-card "Lifetime investment 0% TO MAX" uses `getUpgradeProgress` (slot usage?),
  relabel to match what it measures (upgrade progress to max level) so it isn't
  confused with money spent.

## 3. Remediation contract

- A: rewrite the aggregate SQL + response shape (activities + stats + perAction);
  PlayerDetailModal renders perAction rows and an error state. Contract test.
- B: CSS-only in `app/neon-noir.css` (.nn-dpad responsive fill).
- C: CSS-only (.nn-range width safety) + verify at all 4 placements in TSX.
- D: restructure step copy in tutorialService (no emoji); panel sectioning renders
  it; reward card component upgrade in neon-noir.css + TutorialQuestPanel.
- E: TutorialOverlay celebrates on result.reward (toast + granted state).
- F: inline validation warning + stale-step re-sync in TutorialOverlay.
- G: Drizzle-native units merge in build-unit route (+ regression test).
- H: honest investment math + truthful labels in list route + panel.

All fixes hand-edited. Gates: tsc 0 · eslint 0 · vitest green · build 0.

## 4. Verification contract

1. Route test: activity route returns per-action stats for a seeded fixture set.
2. Route test: build-unit writes valid unit entries (no `$each` blob) — the exact
   live-DB corruption class, pinned.
3. Live probes re-run post-fix: activity route 200 + non-empty; units jsonb sane.
4. Rubric: tutorial copy emoji-free; reward card token-primitives only.
5. Full gates: tsc/eslint/vitest/build.

## 5. Implementation log

- A: activity route — grouped top-1 subquery replaces `mode() within` (verified
  against live Postgres first); response now carries `perAction`; missing-param
  maps to VALIDATION_MISSING_FIELD (400) instead of ADMIN_PLAYER_NOT_FOUND (404);
  PlayerDetailModal renders per-action rows + error state. Tests: 4/4.
- B: `.nn-dpad` fills container (1fr columns, aspect-ratio cells). CSS-only.
- C: `.nn-range` width-safety + `align-self: stretch` on the pill container.
- D: tutorial `detailedHelp` copy restructured (emoji removed; parser
  protocol headers 🎯🕐⚡💡 retained — load-bearing). Panel renders sectioned.
- E: TutorialOverlay celebration on `result.reward` (toast + granted state).
- F: validation failure surfaces inline, stops the stale-step poll loop.
- G: build-unit — the `{ $each: … }` operand (smuggled via `as unknown as`
  cast) removed; plain quantity-folded entry array pushed. This was NOT just
  belt-and-braces: the cast was still live in HEAD and would have re-corrupted
  `units` on the next build. Tests: 5/5 pin the blob class. Live DB: 0 blobs
  remain after scripts/repair-units-each-blob.ts.
- H: PlayerUnit gains optional `producedAt` provenance (build-unit stamps it);
  list route reconstructs per-factory production spend from surviving units
  priced via UNIT_CONFIGS, merges with upgrade-path spend, returns per-card
  `invested` + totals `breakdown` (upgrades vs production); panel labels made
  truthful ("Upgrades Invested", "Upgrade progress … UPGRADED · MAX 10",
  per-card "Invested (upgrades + units)"). Tests: 4/4.

## 6. Gates

- tsc: 0 errors
- eslint (app/components/lib/types): 0 problems
- vitest: 429 passed / 1 skipped (13 new: activity 4, build-unit shape 5, list investment 4)
- next build: exit 0, all routes compiled
- Live probes: replacement aggregate runs on real Postgres (fame: 15,150
  actions, most_common=move, per-action rows correct); `units::text LIKE
  '%$each%'` → 0 rows

## 7. Residuals & follow-ups

- Investment totals are a live lower bound: spend on destroyed units is not
  resurrectable. If exact lifetime spend matters later, add `investedMetal`/
  `investedEnergy` columns to `factories` and `$inc` them at build/upgrade
  time (schema change — deliberate scope cut this FID).
- Activity tracking now covers the 9 logger families wired in FID-029; trade
  logging lands only on trades made after that FID (no backfill exists).
- Tutorial reward digger: verify on a fresh account that step 3's grant fires
  exactly once (idempotency is keyed on step completion).
