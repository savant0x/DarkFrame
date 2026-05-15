# FID-20260515-BATTLE-SYSTEM-FIX

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260515-BATTLE-SYSTEM-FIX |
| **Date Created** | 2026-05-15 |
| **Status** | FIXED |
| **Priority** | CRITICAL |
| **Phase** | Complete — All phases done, TSC 0 errors, ESLint 0 errors |

## Context

FID-20260511-FACTORY-UNIT-REDESIGN was marked CLOSED but the battle service was never actually updated to match the new unit system. The types were changed (4 archetypes, 20 units, intransitive combat), but `battleService.ts` still uses the old simple STR-vs-DEF formula. Additionally, multiple services have schema mismatches, broken queries, and type conflicts that render the entire battle pipeline non-functional.

## Issue

### Root Causes

1. **Combat logic never updated** — Still uses `damage = STR - DEF/2` instead of the multi-phase archetype system
2. **Dual BattleType/BattleOutcome enums** — `game.types.ts` uses `'ATTACKER_WIN'` while `activityLog.types.ts` uses `'attacker_win'`
3. **Two incompatible BattleLog types** — `game.types.ts` has nested `BattleParticipant` objects; `activityLog.types.ts` has flat fields
4. **battleTrackingService queries wrong columns** — Queries `attacker`, `defender`, `winner` instead of `attacker_username`, `defender_username`, `outcome`
5. **battleTrackingService stats logic broken** — Queries `outcome.eq.username` which never matches
6. **applyBattleResults casualty matching broken** — Slices original units array by count instead of using actual casualty IDs from resolveBattle()
7. **No factory battle execution** — API route uses `BattleType.Factory` but no `executeFactoryAttack()` exists
8. **Test mocks wrong DB layer** — Tests mock `@/lib/mongodb` but project uses Supabase
9. **Old UNIT_BLUEPRINTS still exists** — 65-unit old system conflicts with new 20-unit UNIT_CONFIGS
10. **No auth on battle API** — Request body supplies attacker/defender usernames with no session validation

### Impact Matrix

| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `lib/battleService.ts` | Rewrite resolveBattle with multi-phase archetype combat, fix applyBattleResults casualty tracking, add executeFactoryAttack | All PvP combat | HIGH |
| 2 | `lib/battleLogService.ts` | Fix toBattleOutcome mapping, reconcile BattleLog shape with game.types, fix mapDbBattleLogToDomain | Battle history, analytics | HIGH |
| 3 | `lib/battleTrackingService.ts` | Fix all column references, fix stats query logic, remove duplicate JSDoc | Battle stats endpoints | MEDIUM |
| 4 | `types/activityLog.types.ts` | Align BattleType/BattleOutcome values with game.types, or isolate to activity-only scope | All activity logging | MEDIUM |
| 5 | `types/index.ts` | Clarify which BattleLog/BattleType/BattleOutcome are canonical exports | Global type imports | LOW |
| 6 | `types/units.types.ts` | Remove old UNIT_BLUEPRINTS (65 units) — replaced by UNIT_CONFIGS in game.types | Unit display, factory UI | MEDIUM |
| 7 | `app/api/battle/attack/route.ts` | Add session auth, align request schema with battleService expectations | Battle API security | HIGH |
| 8 | `lib/battleService.test.ts` | Rewrite tests to mock Supabase, test actual battleService functions | Test coverage | LOW |
| 9 | `lib/websocket/handlers/combatHandler.ts` | Fix battle outcome field mapping | Real-time battle events | LOW |

## Implementation Plan

### Phase 1: Type Reconciliation
- Decide canonical source for BattleType/BattleOutcome (game.types.ts)
- Update activityLog.types.ts BattleType/BattleOutcome to match, or rename to avoid conflict
- Fix types/index.ts exports to be unambiguous

### Phase 2: Battle Service Rewrite
- Implement multi-phase combat: Artillery strike → Support buff calculation → Vanguard clash → Casualty distribution
- Implement intransitive counter damage modifiers (Striker 1.3x vs Bulwark, etc.)
- Implement weighted casualty distribution (Bulwarks absorb 70% incoming)
- Fix resolveBattle to store actual casualty Unit arrays in BattleLog
- Fix applyBattleResults to use stored casualty IDs instead of array slicing
- Add executeFactoryAttack() function

### Phase 3: Service Fixes
- Fix battleLogService.ts: toBattleOutcome mapping, DB column names, BattleLog shape
- Fix battleTrackingService.ts: all column references, stats query logic
- Fix combatHandler.ts: outcome field mapping

### Phase 4: Security & Cleanup
- Add session auth to /api/battle/attack route
- Remove old UNIT_BLUEPRINTS from units.types.ts
- Rewrite battleService.test.ts with Supabase mocks

## Verification Checklist
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx eslint` — 0 errors
- [x] Battle resolution uses archetype phases correctly
- [x] Intransitive counters apply damage modifiers (Striker 1.3x vs Bulwark)
- [x] Weighted casualties favor Bulwark absorption (70%)
- [x] applyBattleResults uses stored casualty IDs instead of broken array slicing
- [x] Battle history returns correct outcomes (toBattleOutcome mapping fixed)
- [x] Player battle stats return accurate win/loss counts (column refs fixed)
- [x] Factory battles execute via new executeFactoryAttack()
- [x] Battle API rejects unauthenticated requests (requireAuth added)
- [x] Types aligned: BattleType/BattleOutcome enums match across game.types and activityLog.types

## Notes
- This is a surgical fix — no DB schema changes required
- All fixes are code-level: type alignment, logic correction, auth addition
- The multi-phase combat algorithm from FID-20260511 will finally be implemented
- Old UNIT_BLUEPRINTS removal is safe — nothing references them that UNIT_CONFIGS doesn't already cover
