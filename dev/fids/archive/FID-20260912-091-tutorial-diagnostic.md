# FID-20260912-091 — Admin tutorial diagnostic: wiring verdicts + per-player state + override

**Filename:** `FID-20260912-091-tutorial-diagnostic.md`
**ID:** FID-20260912-091
**Severity:** MEDIUM
**Status:** closed
**Created:** 2026-09-13

**Date:** 2026-09-13 · **Type:** feature (admin ops) · **Follows:** FID-090b (tutorial beer-base wiring)

## Problem

FID-090b found the failure class: `find_beer_base` validated `requirementMet` — a field nothing
in the codebase ever wrote — so quest 3's step 2 was unconditionally false forever and every
player stalled at 2/3 with the panel claiming "ETA 20s". Nothing in the admin panel could answer
"WHY is this player stuck?" — the step's validator, its writer, and the player's tracking rows
lived in three different heads. And when a future step regressed into the same class, nothing
would notice until players stranded.

## Diagnosis (the wiring audit itself)

Every step in the six quest definitions was audited against who can actually complete it:

| Class | Steps | Verdict |
|---|---|---|
| `auto` | READ_INFO ×4 | GET /api/tutorial auto-completes after `autoCompleteDelay` |
| `server_hook` | MOVE (counter/coords), MOVE_TO_COORDS ×5, HARVEST, CUSTOM ×5 (4 enriched + find_beer_base), ATTACK (beer_base) | gameplay routes/hooks complete them |
| `manual_click` | OPEN_PANEL ×2, COLLECT_REWARD | overlay/panel Next posts `complete_step`; validators pass on `{}` |
| `unwired` | — **none** | after FID-090b, every live step has a path |

Two latent traps found and documented (still classified correctly):
- `/api/tutorial/complete` and `/api/tutorial/track-action` have **zero client callers** — ATTACK
  steps relying on `requiredAttacks` counting can never increment (a hypothetical step of this
  shape classifies UNWIRED, pinned by test).
- `/api/tutorial` GET line ~112 still reads via the mongo shim while tutorialService uses drizzle;
  harmless today but two stacks for one feature.

## The fix

- **`lib/tutorialDiagnostic.ts`** (pure): `describeStepWiring` classifies every step into
  `auto | server_hook | manual_click | unwired` with a cited source; `buildPlayerDiagnostics`
  joins quest definitions + a player's progress + tracking rows into per-step rows
  (completed/current/holes with tracking counts).
- **`/api/admin/tutorial-diagnostic`** (requireAdmin): GET returns the wiring map + roster
  summaries (active/complete/skipped/declined/never-started) or a full per-player report
  (`?username=`) with tracking-row evidence, holes, and stuck verdicts. POST is the **admin
  override**: it runs the REAL `completeStep` first (natural completion wins), then retries with
  the validator-minimal payload per action class — balances are never faked (the enrichment
  overwrites them from live state; the override cannot conjure 5,000 metal).
- **`components/admin/TutorialDiagnosticModal.tsx`**: roster with stuck flags, per-player
  quest→step table (validator · wiring badge · tracking · override button), and the full wiring
  map. Wired into AdminView's Database Tools grid.
- **Contract tests (13)**: every step in `TUTORIAL_QUESTS` must classify as a known kind; the
  live definitions must contain **zero unwired steps**; beer-base steps must be server hooks;
  a hypothetical counting-ATTACK and unknown CUSTOM type must classify unwired;
  `buildPlayerDiagnostics` behavior (current-step marking, holes, null progress).

## Files

- `lib/tutorialDiagnostic.ts` — pure engine (new)
- `app/api/admin/tutorial-diagnostic/route.ts` — GET/POST admin API (new)
- `components/admin/TutorialDiagnosticModal.tsx` — modal (new)
- `app/admin/AdminView.tsx` — Database Tools button + mount
- `__tests__/lib/tutorialDiagnosticContract.test.ts` — 13 contract tests (new)

## Verification

- Gates: tsc 0 · eslint 0 · vitest **696** (13 new) · build clean.
- Live: route 401 unauthenticated / 200 admin; roster shows 6 players (3 active, fame at
  quest_social_intro · Open Clan Panel); detail view renders every step's validator + wiring
  badge with the FID-090b hooks cited; wiring map shows **0 unwired**. Override path left
  unclicked on the live account (it mutates real progress); natural/override outcomes pinned by
  the same `completeStep` service used in production.

## Follow-ups

- `/api/tutorial` GET's shim read could move to drizzle to collapse the duplicate stack.
- A "stuck player" alert in System Health when any active player's current step is unwired.
- The manual_click class relies on the overlay's Next button sending `{}` — if a validator
  ever grows a required field, those steps flip to unwired and the contract test catches it.
