# FID-20260515-BATTLE-LOG-UI-FIX

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260515-BATTLE-LOG-UI-FIX |
| **Date Created** | 2026-05-15 |
| **Status** | OPEN |
| **Priority** | CRITICAL |
| **Phase** | Analysis Complete — Awaiting Approval |

## Context

The battle log UI is completely broken from the defender's perspective. When a player is attacked, they receive no notification, cannot see battle results, and the sidebar always shows zero counts. The three battle log UI components (BattleLogLinks, BattleLogViewer, battle-logs page) each call different APIs, parse different response keys, and expect incompatible data shapes.

## Issues

### Bug 1: Sidebar battle log counts always zero
**File**: `app/api/combat/logs/route.ts:37-45`
```typescript
// For now, return zero counts
return NextResponse.json({ attackCount: 0, defenseCount: 0, infantryCount: 0, landMineCount: 0 });
```
Hardcoded zeros. `BattleLogLinks` component polls this every 30s and always shows 0.

### Bug 2: Battle logs page calls non-existent API
**File**: `app/game/battle-logs/[type]/page.tsx:67`
```typescript
const response = await fetch(`/api/battle-logs?username=${player.username}&type=${logType}&page=${page}&limit=20`);
```
No `/api/battle-logs` route exists. Page always fails silently and shows "No battle logs found."

### Bug 3: BattleLogViewer reads wrong response key
**File**: `components/BattleLogViewer.tsx:74`
```typescript
setBattles(data.battles || []);
```
API returns `{ success: true, logs, count }`. Key is `logs`, not `battles`. Always shows empty.

### Bug 4: BattleLogViewer type mismatch — imports wrong BattleLog shape
**File**: `components/BattleLogViewer.tsx:32`
```typescript
import { BattleLog, BattleOutcome, BattleType } from '@/types/game.types';
```
But `getPlayerCombatHistory()` returns `ActivityBattleLog[]` from `activityLog.types.ts`. The shapes are incompatible:
- `game.types.ts`: `battle.attacker.username`, `battle.outcome === BattleOutcome.AttackerWin`
- `activityLog.types.ts`: `battle.attackerUsername`, `battle.outcome === BattleOutcome.ATTACKER_WIN`

All field accesses in the viewer return `undefined`.

### Bug 5: Battle log DB insert strips all rich data
**File**: `lib/battleService.ts:659-674`
Only saves: `attacker_username`, `attacker_strength`, `defender_username`, `defender_defense`, `damage_dealt`, `outcome`, `resources_stolen`, `created_at`
**Missing**: `battle_type`, `rounds`, `units_lost`, `units_captured`, `xp_earned`, `location`, `total_rounds`, `hp_before/after`

### Bug 6: mapDbBattleLogToDomain zeros out critical fields
**File**: `lib/battleLogService.ts:44-56`
Sets `attackerUnitsLost: 0`, `defenderUnitsLost: 0`, `attackerUnits: []`, `defenderUnits: []`, `battleDurationMs: 0`, `tileX: 0`, `tileY: 0`, `attackerLevel: 0`, `defenderLevel: 0`. All real data is discarded.

### Bug 7: battleType always mapped to PLAYER_VS_PLAYER
**File**: `lib/battleLogService.ts:30`
```typescript
battleType: BattleType.PLAYER_VS_PLAYER,
```
Ignores actual battle type. Type filter in BattleLogViewer never matches.

### Bug 8: No defender notification when attacked
**File**: `app/api/combat/infantry/route.ts`
Never calls `handleBattleStart` or `handleBattleEnd` from `combatHandler.ts`. `notifyDefenseAlert()` in `broadcast.ts` exists but is never called anywhere. Defender receives zero real-time notification.

### Bug 9: Defender cannot see complete battle results
The `battle_logs` DB table has no `rounds` column, no per-unit data, no XP data. Even if the UI worked, the defender would only see: attacker name, defender name, outcome string, and one damage number. No unit losses, no captures, no round-by-round, no HP changes.

### Bug 10: BattleLogModal type param ignored
**File**: `components/BattleLogModal.tsx:49` calls `/api/combat/logs?type=${logType}` but the API ignores the `type` query param entirely.

## Impact Matrix

| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `app/api/combat/logs/route.ts` | Fix summary endpoint to query battle_logs table, fix response key to `battles` | BattleLogLinks, BattleLogViewer | HIGH |
| 2 | `app/api/battle-logs/route.ts` | Create new route for typed battle logs (attack/defense/infantry) with pagination | Battle logs page | HIGH |
| 3 | `lib/battleService.ts` | Save rich battle data to DB (rounds as JSONB, units_lost, units_captured, xp, battle_type, location) | All battle persistence | HIGH |
| 4 | `lib/battleLogService.ts` | Fix mapDbBattleLogToDomain to parse rounds JSONB, include units lost/captured, preserve battle_type | Battle history queries | HIGH |
| 5 | `components/BattleLogViewer.tsx` | Fix response key (`data.logs`), fix field accesses to match activityLog.types shape, fix type filter | Battle history modal | MEDIUM |
| 6 | `app/game/battle-logs/[type]/page.tsx` | Fix API call to use new `/api/battle-logs` route, fix data parsing | Battle logs page | MEDIUM |
| 7 | `app/api/combat/infantry/route.ts` | Wire in WebSocket defense notification | Real-time alerts | MEDIUM |
| 8 | `lib/websocket/broadcast.ts` | Ensure notifyDefenseAlert is called from infantry route | Real-time alerts | LOW |
| 9 | `components/BattleLogModal.tsx` | Fix type filtering to work with API | Battle log modal | LOW |
| 10 | `types/database.ts` | Add missing columns to battle_logs schema (rounds JSONB, units_lost, etc.) | DB schema | HIGH |

## Implementation Plan

### Phase 1: DB Schema + Rich Battle Persistence
- Add migration: `rounds` (JSONB), `units_lost_attacker`, `units_lost_defender`, `units_captured_attacker`, `units_captured_defender`, `attacker_xp`, `defender_xp`, `battle_type`, `location_x`, `location_y`, `attacker_hp_before`, `attacker_hp_after`, `defender_hp_before`, `defender_hp_after`
- Update `battleService.ts` INSERT to save all rich data
- Update `mapDbBattleLogToDomain` to parse JSONB rounds and populate all fields

### Phase 2: API Fixes
- Fix `/api/combat/logs` summary endpoint to actually query `battle_logs` table with proper counts (attack vs defense vs infantry)
- Fix response key from `logs` to `battles` for BattleLogViewer compatibility (or fix BattleLogViewer)
- Create `/api/battle-logs` route with type filtering (attack/defense/infantry), pagination, and proper data shape

### Phase 3: UI Fixes
- Fix BattleLogViewer field accesses to match actual API response shape
- Fix battle-logs page to call correct API
- Fix BattleLogModal type filtering
- Update BattleLogViewer to use synth palette colors

### Phase 4: Defender Notification
- Wire `handleBattleStart`/`handleBattleEnd` into infantry combat route
- Call `notifyDefenseAlert` when defender is attacked
- Add client-side WebSocket listener for defense alerts

## Verification Checklist
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx eslint` — 0 errors
- [ ] Sidebar shows correct battle counts (non-zero after battles)
- [ ] Battle logs page loads and displays battles by type
- [ ] BattleLogViewer shows battles with correct data (not empty)
- [ ] Defender sees complete battle results: units lost, units captured, rounds, XP, HP changes
- [ ] Defender receives real-time notification when attacked
- [ ] Type filtering works in all battle log UI components
- [ ] BattleLogModal respects type parameter

## Notes
- This requires a DB migration to add columns to battle_logs table
- The rounds data will be stored as JSONB (array of CombatRound objects)
- Defender notification requires WebSocket connection to be active
- Consider storing battle results in a separate `battle_results` table for full round data if JSONB becomes too large
