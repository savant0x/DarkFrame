# FID-20260912-084 — Admin registry: bot identity, Beer Base labeling, spec-count fix

## Operator report

"Are 'bots' different designs than beer bases? Why don't we see any of the other bot types
like Hoarder, etc? Those bots are supposed to be special design type bots with different
army makeups other than the beer bases. I don't even see 'beer bases' in the Player
Management section, nor the type. Beer bases should be in the player list showing the type
of beer base. Beer bases have a very specific design and are supposed to be resource rich,
but looking at these bots they don't seem to have much resources, so these bots are not
beer bases?"

## Answers

- **Bots vs Beer Bases:** Beer Bases ARE bots — regular bots with `is_special_base = 1`
  and the special spawner (tiered army, 3–20x resource multiplier, themed name). Same
  underlying table, different spawn pipeline and role.
- **The specializations exist** — live DB at audit time: hoarder 10, fortress 14,
  raider 14, ghost 9, balanced 7 (plus 3 Beer Bases). The admin panel showed all zeros.

## Defects found

1. **Spec counts all zero (case bug).** `bot-stats` counted with
   `spec in stats.bySpecialization` — DB stores lowercase enum values (`'hoarder'`),
   the buckets are PascalCase (`'Hoarder'`), so the case-sensitive check matched nothing.
   Fixed with case-normalized key lookup + regression tests.
2. **The registry was blind.** `/api/admin/players` selected no bot fields, so the Player
   Management table rendered beer bases and bots indistinguishably from players.
   Now exposes `isBot`, `isBeerBase`, `specialization`, `botTier`.
3. **UI:** Player Management gained a **Type** column (`🍺 BEER BASE · T{n}` /
   `Bot · hoarder` / `Player`), a name prefix icon (🍺 / 🤖), and a filter row:
   **All / Players / Bots / 🍺 Beer Bases**.

## On "these bots don't look resource rich"

They do where it counts — Shattered_Den (Beer Base, STRONG/raider) holds **2.9M metal /
2.9M energy**, Broken_Bunker 188k/188k. The poor-looking Silent_Citadel (3.2k) was spawned
Sept 10 under the pre-FID-081 starved pipeline; the weekly respawn replaces it. Regular
bots are *supposed* to look modest — beer bases carry the 3x+ multiplier loot.

## Files

- `app/api/admin/bot-stats/route.ts` — case-insensitive spec counting
- `app/api/admin/players/route.ts` — bot identity fields in the registry payload
- `app/admin/AdminView.tsx` — Type column, name icons, registry filter
- `__tests__/api/admin/botStatsSpecialization.test.ts` — 3 regressions

## Gates

tsc 0 · eslint 0 · vitest **621** (3 new) · build clean · server restarted on the build.
