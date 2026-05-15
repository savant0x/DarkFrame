# FID-20260515-GATHER-BUILD-BATTLE-FLOW

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260515-GATHER-BUILD-BATTLE-FLOW |
| **Date Created** | 2026-05-15 |
| **Status** | FIXED |
| **Priority** | CRITICAL |
| **Phase** | Complete — All fixes applied, TSC 0 errors, ESLint 0 errors |

## Context

After fixing the battle system (FID-20260515-BATTLE-SYSTEM-FIX), a full flow review from gather → build → battle revealed 8 bugs that break the core gameplay loop. Units built via `/api/player/build-unit` enter battle with 0 STR/DEF, quantity fields are ignored, battle results aren't persisted on some routes, and several endpoints lack authentication.

## Issues

### Bug #1: player/build-unit doesn't write strength/defense (CRITICAL)
**File**: `app/api/player/build-unit/route.ts:327-333`
INSERT only writes `{player_username, unit_type, quantity}`. No strength/defense columns. Battle reads `row.strength || 0` → 0 combat power.

### Bug #2: loadPlayerUnits ignores quantity field (CRITICAL)
**File**: `lib/battleService.ts:75-83`
Each DB row → 1 Unit. Player with quantity:50 brings 1 unit to battle.

### Bug #3: savePlayerUnits destroys aggregated rows (CRITICAL)
**File**: `lib/battleService.ts:90-112`
DELETE ALL + INSERT individual rows. Destroys quantity model after first battle.

### Bug #4: artilleryPhase uses wrong array
**File**: `lib/battleService.ts:274`
`defenderArtillery` computed from `attackerUnits` instead of `defenderUnits`.

### Bug #5: battle/attack route never persists results
**File**: `app/api/battle/attack/route.ts`
Calls resolveBattle() but never applyBattleResults(). Dry-run only.

### Bug #6: No auth on harvest endpoints
**File**: `app/api/harvest/route.ts`
Username from request body, no session verification.

### Bug #7: No auth on infantry combat
**File**: `app/api/combat/infantry/route.ts`
Same — username from body, no session check.

### Bug #8: No transactions in build flows
**File**: `app/api/player/build-unit/route.ts`
Factory slots consumed before player resources deducted. No rollback on failure.

## Impact Matrix

| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `lib/battleService.ts` | Fix loadPlayerUnits quantity, savePlayerUnits aggregated upsert, artilleryPhase bug | All battles | HIGH |
| 2 | `app/api/player/build-unit/route.ts` | Write strength/defense, add transaction | Unit building | HIGH |
| 3 | `app/api/battle/attack/route.ts` | Add applyBattleResults call | Battle persistence | HIGH |
| 4 | `app/api/harvest/route.ts` | Add session auth | Resource harvesting | MEDIUM |
| 5 | `app/api/combat/infantry/route.ts` | Add session auth | PvP combat | MEDIUM |
| 6 | `app/api/factory/build-unit/route.ts` | Add transaction wrapper | Factory building | MEDIUM |

## Verification Checklist
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx eslint` — 0 errors
- [x] Units built via player/build-unit have correct STR/DEF in battle
- [x] Quantity field respected in loadPlayerUnits
- [x] savePlayerUnits preserves aggregated quantity model
- [x] Artillery phase targets correct side's units
- [x] battle/attack route persists unit changes
- [x] Harvest endpoints require session auth
- [x] Infantry combat endpoint requires session auth
- [x] Build flows use transactions for atomicity
