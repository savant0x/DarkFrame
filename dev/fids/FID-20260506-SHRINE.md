# FID-20260506-SHRINE: Shrine System — Boost Not Displaying + Missing Status Module

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260506-SHRINE |
| **Date Created** | 2026-05-06 |
| **Status** | FIXED |
| **Priority** | HIGH |
| **Phase** | Implementation Complete |

---

## Context

The shrine system has two issues:
1. **Bug:** Shrine boost activates successfully (items consumed, DB written) but never displays in the UI
2. **Missing Feature:** No shrine status module exists in the sidebar (should be between AutoFarmPanel and WMDMiniStatus)

The ShrinePanel (554 lines) is the full shrine UI for activating boosts at the shrine tile. The HarvestCalculatorTab already has a shrine bonus input field that reads from `data.shrineBoosts`. But neither works because the player API doesn't fetch shrine boosts.

---

## Issue 1: Shrine Boost Not Displaying After Activation

### Root Cause
The player API (`/api/player/route.ts`) never fetches `shrineBoosts` from the `player_shrine_boosts` table. The result object (lines 60-89) includes inventory, resources, bank — but not `shrineBoosts`.

In `page.tsx:1106`:
```typescript
activeBoosts={player?.shrineBoosts || []}
```
Since `player.shrineBoosts` is `undefined`, `activeBoosts` is always `[]`.

The `HarvestCalculatorTab` (StatsViewWrapper.tsx:499-506) also reads `data.shrineBoosts` — so the harvest calculator auto-detection is also broken.

### Database Schema
`player_shrine_boosts` table columns:
- `id` (uuid, PK)
- `player_username` (text, FK → players.username)
- `boost_tier` (shrine_boost_tier enum: spade/heart/diamond/club)
- `expires_at` (timestamptz)
- `yield_bonus` (numeric(5,2), default 0.25)

### Fix
In `app/api/player/route.ts`, after the inventory query (line 58), add:

```typescript
// Fetch active shrine boosts
const now = new Date().toISOString();
const { data: shrineBoosts } = await supabase
  .from('player_shrine_boosts')
  .select('*')
  .eq('player_username', username)
  .gt('expires_at', now);
```

Include in result object (after line 88):
```typescript
shrineBoosts: shrineBoosts || [],
```

The `mapCamelCase` spread (`...mapped`) handles player fields. The `shrineBoosts` array from Supabase will have `expires_at` and `yield_bonus` — these need to be camelCased. Since `shrineBoosts` is a separate query (not part of `mapped`), we should map each boost:

```typescript
shrineBoosts: (shrineBoosts || []).map(b => ({
  ...mapCamelCase(b),
  tier: b.boost_tier,
  expiresAt: b.expires_at,
  yieldBonus: b.yield_bonus,
})),
```

This ensures the frontend receives `ShrineBoost[]` with correct field names matching the TypeScript interface (`tier`, `expiresAt`, `yieldBonus`).

The `Player` type already has `shrineBoosts: ShrineBoost[]` (types/game.types.ts:374). No type changes needed.

---

## Issue 2: Missing Shrine Status Module

### Context
The sidebar structure in `app/game/page.tsx` (lines 1125-1159) — current order:
```
ControlsPanel
AutoFarmPanel      ← line 1128-1138
WMDMiniStatus      ← line 1141-1144
FlagTrackerPanel   ← line 1146-1159
```

Desired order:
```
ControlsPanel
AutoFarmPanel      ← line 1128-1138
FlagTrackerPanel   ← move here (only visible when player IS the bearer)
ShrineStatusPanel  ← new module
WMDMiniStatus      ← line 1141-1144
```

The ShrineStatusPanel is a **read-only display module** — it shows the player their active shrine boosts, remaining timers, and total bonus. It does NOT handle activation. Activation only happens at the shrine tile (1,1) via the ShrinePanel.

### Component Design
Following the WMDMiniStatus pattern (compact status widget, fetches own data via API, 30s polling, click-to-open full panel):

**Props:**
```typescript
interface ShrineStatusPanelProps {
  onClick?: () => void;
}
```

**Data fetching:** Uses existing `/api/shrine/status` endpoint (returns `activeBoosts` and `availableItems`). Polls every 30 seconds.

**State management:**
- `loading` state shows "Loading..." placeholder
- `activeBoosts` array drives the 4 tier displays
- `availableItems.length` shows tradeable item count
- Timer countdown via `useEffect` with 1-second interval

**Display layout (4 tiers + summary):**
```
┌─────────────────────────────┐
│ ⛩️ Shrine Status     [→]    │
├─────────────────────────────┤
│ ♠️ Spade    ✅ 2h 34m       │
│ ♥️ Heart    ✅ 1h 12m       │
│ ♦️ Diamond  ❌ Expired       │
│ ♣️ Club     ❌ Inactive      │
├─────────────────────────────┤
│ Total Bonus: +50% (x1.50)   │
│ Items: 45 tradeable         │
└─────────────────────────────┘
```

**Tier status logic:**
- `expiresAt > now` → ✅ Active with countdown timer
- `expiresAt <= now` but was active → ❌ Expired
- No record → ❌ Inactive

**Styling:** Matches WMDMiniStatus pattern — `bg-gray-800 rounded-lg p-3 border border-gray-700`, hover effect, click-to-open hint text.

**Click behavior:** Opens the shrine view (`setCurrentView('SHRINE')`) where the player can activate/extend boosts at the shrine tile.

### Files to Create
| # | File | Purpose |
|---|------|---------|
| 1 | `components/ShrineStatusPanel.tsx` | Sidebar module showing shrine boost status, timers, total bonus |

### Files to Modify
| # | File | Change | Line |
|---|------|--------|------|
| 1 | `app/api/player/route.ts` | Add shrine boosts query after inventory query | After line 58 |
| 2 | `app/api/player/route.ts` | Add `shrineBoosts` to result object | After line 88 |
| 3 | `app/game/page.tsx` | Import ShrineStatusPanel | Line 29 (with other imports) |
| 4 | `app/game/page.tsx` | Move FlagTrackerPanel below AutoFarmPanel | Move lines 1146-1159 to after line 1139 |
| 5 | `app/game/page.tsx` | Fix FlagTrackerPanel visibility — show only when player IS the bearer (currently inverted at line 1147) | Line 1147 |
| 6 | `app/game/page.tsx` | Render ShrineStatusPanel between FlagTrackerPanel and WMDMiniStatus | After FlagTrackerPanel |

---

## Verification Checklist
- [ ] `npm run dev` starts without errors
- [ ] Sidebar order is: Controls → AutoFarm → FlagTracker → ShrineStatus → WMD
- [ ] FlagTrackerPanel only shows when player IS the bearer (not when they don't)
- [ ] FlagTrackerPanel hidden for non-bearer players
- [ ] ShrineStatusPanel shows in sidebar between FlagTracker and WMD
- [ ] Activate shrine boost at shrine tile (1,1) via ShrinePanel → ACTIVE badge appears
- [ ] Timer counts down in ShrinePanel
- [ ] Total gathering bonus updates in ShrinePanel
- [ ] HarvestCalculatorTab auto-detects shrine bonus
- [ ] Each tier shows correct status (active with timer / expired / inactive)
- [ ] Total bonus multiplier displays correctly (e.g., +50% x1.50 for 2 active)
- [ ] Tradeable item count displays correctly
- [ ] Clicking ShrineStatusPanel navigates to shrine tile view
- [ ] Navigate away and back — boosts persist with correct timers
- [ ] After boost expires, status changes from ✅ to ❌
- [ ] `npx tsc --noEmit` passes with 0 errors

---

## Notes
- The shrine activation API (`/api/shrine/activate`) works correctly — only the data loading is broken
- The ShrinePanel UI is complete (554 lines) — no UI changes needed
- The HarvestCalculatorTab already has shrine bonus integration (reads from player API)
- The `shrineBoosts` field already exists on the Player type
- The `/api/shrine/status` endpoint already exists and returns the correct data
- No database schema changes needed
- The ShrineStatusPanel follows the same pattern as WMDMiniStatus (compact, fetches own data, click-to-open)
