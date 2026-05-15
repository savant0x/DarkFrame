# FID-20260509-HARVEST-CALC

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-20260509-HARVEST-CALC         |
| **Date Created** | 2026-05-09                         |
| **Status**       | CLOSED                             |
| **Priority**     | HIGH                               |
| **Phase**        | Complete                           |

## Context
- Refactored StatsPanel Harvest Calculator shows "+620.87% Gathering Bonus" producing Base 400–750 → Expected 26,015–48,778
- Also fixed `next/headers` build error from `xpService.ts` being pulled into client components

## Issue / Plan
1. StatsPanel `calcHarvest` multiplied `rawBonus` by 100: `remaining = rawBonus * 100`
2. `GatheringBonus.metalBonus` stores whole-number percentages (e.g. 620.87 = 620.87%), so the `* 100` caused remaining=62087 and a 65× multiplier
3. Client import of `xpService.ts` → server-only `next/headers` violation

### Impact Matrix
| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `components/StatsPanel.tsx` | Fix `remaining = rawBonus` (remove `* 100`) | All harvest calc rendering | LOW |
| 2 | `lib/xpUtils.ts` | Extract client-safe pure XP functions from `xpService.ts` | Client components using XP calc | LOW |
| 3 | `components/StatsPanel.tsx` | Import `getXPProgress` from `xpUtils.ts` instead of `xpService.ts` | Removes server-only import chain | LOW |
| 4 | `types/game.types.ts` | Add `is_vip` / `vip_expiration` properties to `Player` interface | Typing across VIP pages | LOW |

## Verification Checklist
- [ ] Build passes: `npx tsc --noEmit` (0 errors in relevant files)
- [ ] Harvest calc shows realistic ranges for high bonus values
- [ ] No `next/headers` client import errors

## Notes
- Original `* 100` was likely introduced during the refactor as a mistaken scale adjustment.
