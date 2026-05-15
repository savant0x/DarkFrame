# FID-20260509-COMPREHENSIVE-AUDIT

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-20260509-COMPREHENSIVE-AUDIT  |
| **Date Created** | 2026-05-09                         |
| **Status**       | IN PROGRESS                        |
| **Priority**     | CRITICAL                           |
| **Phase**        | Active                             |

## Context
Deep audit of the entire DarkFrame codebase after economy/progression refactor (FID-20260508-BALANCE-V2). Server/DB is the single source of truth — nothing should be calculated or stored on the client. All values must come from the API.

## Issues Found

### CRITICAL (Fixed in this session)

| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|
| 1 | `lib/tutorialService.ts` | 148-151 | Metal Bank tutorial targets (25,25) — no bank exists there | Changed to (38,38) |
| 2 | `lib/tutorialService.ts` | 184-187 | Exchange tutorial targets (50,50) — no bank exists there | Changed to (38,112) |
| 3 | `lib/tutorialService.ts` | 220-223 | Energy Bank tutorial targets (75,75) — no bank exists there | Changed to (112,38) |
| 4 | `lib/tutorialService.ts` | 257-260 | "Far Corner" targets (100,100) — map is 150×150 | Changed to Auction House at (10,10) |
| 5 | `components/StatsPanel.tsx` | 68-101 | Energy harvest calc never uses energy bonus — parameter order bug (`calcHarvest(metal, energy)` but inner fn only uses first param) | Refactored to single-param `calcHarvest(bonus)` |
| 6 | `components/StatsPanel.tsx` | 68-96 | Harvest calc didn't include balance multiplier from server | Added `player.balanceEffects.gatheringMultiplier` |
| 7 | `components/StatsPanel.tsx` | 95-99 | `metalCalc`/`energyCalc` called as functions in JSX but were pre-computed strings | Changed JSX to use string values directly |
| 8 | `app/game/unit-factory/page.tsx` | 86-115 | Build POST to non-existent `/api/units/build` | Changed to `/api/player/build-unit` |
| 9 | `app/api/tile/route.ts` | 75-92 | Base tile rendering relied on stale `occupied_by_base` DB flag | Now dynamically queries `players` table for bases at tile coords |
| 10 | `app/game/page.tsx` | 1167-1216 | Sidebar had duplicated Shrine, WMD, AutoFarm, Flag panels (rendered both inside ControlsPanel and outside) | Removed duplicates; ControlsPanel = Position + Movement only; all other panels rendered once in game page fragment |
| 11 | `components/tutorial/TutorialQuestPanel.tsx` | 95 | Checked `data.success` but tutorial API returns `{quest, step, progress}` without `success` field | Changed to check `data.quest && data.step` |
| 12 | `components/tutorial/TutorialQuestPanel.tsx` | 132 | `previousQuestRef.current = currentQuest.id` — type mismatch (`string \| undefined` vs `string \| null`) | Changed to `currentQuest.id \|\| currentQuest._id \|\| null` |
| 13 | `types/tutorial.types.ts` | 101 | `TutorialQuest` only had `_id`, but components use `.id` | Added `id?: string` as alias |
| 14 | `lib/tutorialService.ts` | 711 | `getTutorialQuest` only matched `_id` | Now matches both `id` and `_id` |
| 15 | `scripts/reset-and-seed.ts` | 179-198 | Admin player created at (75,75) without setting `occupied_by_base` on tile | Added tile update step after player creation |

### HIGH (Needs fixing)

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 16 | `app/leaderboard/page.tsx` | 186-189 | Duplicate rank display for ranks > 3 (`#4 #4`) |
| 17 | `app/game/inventory/page.tsx` | entire file | Duplicate/unreachable inventory page — game uses `InventoryPanel` component, never navigates to this standalone page |
| 18 | `app/game/inventory/page.tsx` | 132-144 | `calculateTotalGatheringBonus` uses hardcoded per-rigity values instead of actual item bonuses from DB |
| 19 | `components/InventoryPanel_OLD.tsx` | entire file | Dead code — old inventory implementation with wrong data structure |
| 20 | `components/WMDHub.tsx` | 60-68 | Hardcoded gray Tailwind colors instead of CSS variables |

### MEDIUM (Needs fixing)

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 21 | `app/stats/page.tsx` | 88-94 | Inconsistent back button styling |
| 22 | `app/wmd/page.tsx` | 29-35 | Hardcoded `shadow-2xl` instead of design-system shadows |
| 23 | `lib/tutorialService.ts` | 1345 | Typo: `validateMoveToCordsAction` → `validateMoveToCoordsAction` |
| 24 | `components/chat/ChatPanel.tsx` | 65, 184 | Connection status always shows "Connected" — `isPollingMessages` hardcoded to `true` |

### LOW (Cosmetic)

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 25 | `app/leaderboard/page.tsx` | 60-63 | Raw emoji instead of icon system for ranks |
| 26 | Multiple pages | various | Missing `onFriendsClick` passed to TopNavBar |

## Verification Checklist
- [x] Build passes: `npx tsc --noEmit` (0 errors in app/components/lib)
- [x] Full Next.js build passes: `npx next build`
- [ ] Tutorial shows for new players (level 1-5)
- [ ] Tutorial step coordinates match actual map locations
- [ ] Harvest calculator matches actual harvest amounts
- [ ] Base tiles render correctly after map reset
- [ ] Sidebar shows: Position → Movement → AutoFarm → Flag(cond) → Shrine → WMD (no duplicates)
- [ ] Inventory page works when opened from game
- [ ] Unit factory page works (build units)

## Notes
- The `reset-and-seed.ts` and `dev/reset-and-seed.ts` scripts have pre-existing TypeScript errors from Supabase generated types not recognizing all table names. These are dev tools and don't affect the build.
- The `fix-base-tiles.ts` script exists as a post-reset repair tool to sync `occupied_by_base` flags with actual player base positions.
