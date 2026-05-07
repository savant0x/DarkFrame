# FID-20260506-SHRINE: Shrine System — Boost Not Displaying + Missing Status Module

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260506-SHRINE |
| **Date Created** | 2026-05-06 |
| **Status** | FIXED |
| **Priority** | HIGH |
| **Phase** | Implementation Complete — Pending Verification |

---

## Context

The shrine system has two issues:
1. **Bug:** Shrine boost activates successfully (items consumed, DB written) but never displays in the UI
2. **Missing Feature:** No shrine status module exists in the sidebar

Additionally, the flag tracker visibility logic needs correction, and all sidebar modules should be foldable/collapsible.

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
shrineBoosts: (shrineBoosts || []).map(b => ({
  ...mapCamelCase(b),
  tier: b.boost_tier,
  expiresAt: b.expires_at,
  yieldBonus: b.yield_bonus,
})),
```

The `mapCamelCase` spread handles player fields. The `shrineBoosts` array needs explicit mapping since it's a separate query. This ensures the frontend receives `ShrineBoost[]` with correct field names matching the TypeScript interface (`tier`, `expiresAt`, `yieldBonus`).

The `Player` type already has `shrineBoosts: ShrineBoost[]` (types/game.types.ts:374). No type changes needed.

---

## Issue 2: Missing Shrine Status Module

### Context
The sidebar needs a shrine status widget between AutoFarmPanel and WMDMiniStatus. The ShrineStatusPanel is a **read-only display module** — it shows active shrine boosts, remaining timers, and total bonus. Activation only happens at the shrine tile (1,1) via interacting with 1,1.

### Component Design
Following the WMDMiniStatus pattern (compact status widget, fetches own data via API, 30s polling, click-to-open full panel):

**Props:**
```typescript
interface ShrineStatusPanelProps {
  onClick?: () => void;
}
```

**Data fetching:** Uses existing `/api/shrine/status` endpoint. Polls every 30 seconds.

**Display (full mode):**
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

**Display (compact mode):**
```
┌─────────────────────────────┐
│ ⛩️ Shrine  2/4  +50%  [→]  │
└─────────────────────────────┘
```

**Tier status logic:**
- `expiresAt > now` → ✅ Active with countdown timer
- `expiresAt <= now` → ❌ Expired
- No record → ❌ Inactive

**Styling:** Matches WMDMiniStatus pattern — compact, `bg-gray-800 rounded-lg p-3 border border-gray-700`, hover effect, click-to-open hint.

**Click behavior:** Collapse/Expand

---

## Issue 3: Flag Tracker Visibility Logic

### Current Behavior (Wrong)
The FlagTrackerPanel at `page.tsx:1142` currently shows when `flagBearer.username === player?.username` (when player IS the bearer). This is backwards.

### Correct Behavior
- **WHEN player IS the flag bearer:** Show compact "Flag Bearer" status module (bearer info, hold timer, controls). The bearer doesn't need to track themselves.
- **WHEN player is NOT the flag bearer:** Show the FlagTrackerPanel so they can track and challenge the bearer.

### Sidebar Layout

**RIGHT SIDEBAR — When player IS flag bearer:**
```
[POSITION]
[FLAG BEARER]       ← compact status (bearer info, timer, controls)
[MOVEMENT CONTROLS]
[AUTO FARM]
[SHRINE STATUS]
[WMD]
```

**RIGHT SIDEBAR — When player is NOT flag bearer:**
```
[POSITION]
[MOVEMENT CONTROLS]
[AUTO FARM]
[FLAG TRACKER]      ← full tracker (bearer location, distance, challenge)
[SHRINE STATUS]
[WMD]
```

### Fix
In `app/game/page.tsx:1142`, change the FlagTrackerPanel condition from:
```typescript
{flagBearer && flagBearer.username === player?.username && (
```
To:
```typescript
{flagBearer && flagBearer.username !== player?.username && (
```

And add a compact FlagBearerPanel when the player IS the bearer:
```typescript
{flagBearer && flagBearer.username === player?.username && (
  <div className="p-3">
    <FlagBearerPanel
      flagBearer={flagBearer}
      onRelease={handleFlagRelease}
      compact={false}
    />
  </div>
)}
```

---

## Issue 4: Foldable Modules

### Requirement
All sidebar modules should be foldable/collapsible with small compact versions, EXCEPT Movement Controls which always shows full size. This applies to both left and right sidebars.

### Modules to make foldable:

| Module | Compact Mode Shows |
|--------|-------------------|
| **AutoFarmPanel** | Status icon + start/stop button only |
| **FlagTrackerPanel** | Bearer name + distance + challenge button |
| **FlagBearerPanel** | "🚩 Bearer" + hold timer |
| **ShrineStatusPanel** | "⛩️ 2/4 +50%" + click to expand |
| **WMDMiniStatus** | Icon + alert badge only |
| **Position panel** | Coordinates only |

### Implementation Pattern
Each module gets a `compact` prop (boolean). When `true`, renders minimal info. When `false`, renders full details. Default is `false` (full mode). Players can toggle via a collapse/expand button on each module header.

### State Management
Each module manages its own collapse state internally (like FlagTrackerPanel already does with `isPanelCollapsed`). No need for parent-level state.

---

## Files to Create
| # | File | Purpose |
|---|------|---------|
| 1 | `components/ShrineStatusPanel.tsx` | Sidebar shrine status widget (full + compact modes) |
| 2 | `components/FlagBearerPanel.tsx` | Compact flag bearer status (when player holds flag) |

## Files to Modify
| # | File | Change | Line |
|---|------|--------|------|
| 1 | `app/api/player/route.ts` | Add shrine boosts query + camelCase mapping | After line 58 |
| 2 | `app/game/page.tsx` | Fix FlagTracker visibility (`!==` instead of `===`) | Line 1142 |
| 3 | `app/game/page.tsx` | Add FlagBearerPanel when player IS bearer | After line 1154 |
| 4 | `app/game/page.tsx` | Add ShrineStatusPanel between FlagTracker and WMD | After FlagTracker |
| 5 | `components/index.ts` | Export ShrineStatusPanel + FlagBearerPanel | Add to exports |
| 6 | `components/AutoFarmPanel.tsx` | Add `compact` prop support | Add prop + conditional rendering |
| 7 | `components/FlagTrackerPanel.tsx` | Already has `compact` prop — verify it works correctly | Already implemented |
| 8 | `components/WMDMiniStatus.tsx` | Add `compact` prop support | Add prop + conditional rendering |

---

## Verification Checklist
- [ ] `npm run dev` starts without errors
- [ ] Activate shrine boost at shrine tile → ACTIVE badge appears in ShrinePanel
- [ ] Timer counts down in ShrinePanel
- [ ] Total gathering bonus updates in ShrinePanel
- [ ] HarvestCalculatorTab auto-detects shrine bonus
- [ ] ShrineStatusPanel shows in sidebar with correct tier statuses
- [ ] ShrineStatusPanel compact mode shows "⛩️ 2/4 +50%"
- [ ] FlagTrackerPanel shows when player is NOT the bearer
- [ ] FlagBearerPanel shows when player IS the bearer
- [ ] FlagTrackerPanel hidden when player is the bearer
- [ ] All modules have compact/foldable mode
- [ ] Movement Controls always show full size
- [ ] `npx tsc --noEmit` passes with 0 errors

---

## Notes
- The shrine activation API works correctly — only the data loading is broken
- The ShrinePanel UI is complete (554 lines) — no UI changes needed
- The HarvestCalculatorTab already has shrine bonus integration (reads from player API)
- The `shrineBoosts` field already exists on the Player type
- The `/api/shrine/status` endpoint already exists and returns correct data
- FlagTrackerPanel already has `compact` prop and collapse functionality
- No database schema changes needed
- ShrineStatusPanel follows WMDMiniStatus pattern (compact, fetches own data, 30s polling)
- FlagBearerPanel is new — shows bearer status when player holds the flag
