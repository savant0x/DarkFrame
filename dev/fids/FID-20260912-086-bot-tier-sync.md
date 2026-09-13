# FID-20260912-086 — botConfig.tier sync + tier gradient in the admin registry

**Date:** 2026-09-12 · **Type:** fix + feature · **Follows:** FID-081 (beer base audit), FID-084 (registry identity)

## Problem

`botConfig.tier` is load-bearing: combat XP pays `50 + tier*25`, the bot factory-raid gate
(FID-067) only allows raids on **T4+** bases, the scanner displays it, and resource-regen
scales with it. But the field drifted:

- **Beer bases**: `spawnBeerBase` rewrote `level`/`rank` from the smart PowerTier after
  `createBotPlayer` had already stamped `tier` with the zone roll — an Elite base rolled
  into a T1 zone carried `tier: 1` forever (raid-exempt, underpaid XP, wrong scanner tier).
- **Regular bots**: tier written correctly at spawn, but nothing verified it (levels are
  static, so drift was latent rather than live).

FID-084's registry showed the tier only for beer bases (rank-derived client-side); regular
bots had no tier signal at all.

## Canonical derivation (single source, three signals)

| Row class | Canonical signal | Rationale |
|---|---|---|
| Beer bases | `rank` clamped 1–6 | rank IS the PowerTier index (Weak→Legendary), set once at spawn, never mutated |
| Bosses | pinned `7` | createBossBot is explicit |
| Regular bots | `ceil(level/10)` clamped 1–7 | inverse of `getPlayerLevelForTier`'s spawn mapping |

## Changes

- `lib/beerBaseService.ts` — spawnBeerBase now writes `botConfig.tier = clamp(rank, 1..6)`
  after the level/rank switch. New spawns can never drift.
- `lib/migrations/botTierResync.ts` — boot self-heal (factoryStatResync shape): marker +
  drift scan, so healthy boots are free and stale rows heal. Healed **5 of 54** live rows on
  first run; second boot reports "already applied (no drift)".
- `server.ts` — boot wiring after the FID-072 factory resync.
- `app/admin/AdminView.tsx` — `TierChip` (T1 green → T7 red, the scanner/WMD threat ramp)
  rendered for **every** bot row in the Type column; beer bases keep their inline `T{n}`
  text form.
- `__tests__/lib/botTierSync.test.ts` — 7 tests pinning the PowerTier→tier map, the
  spawn-path sync (zone-roll T1 → Legendary T6), clamping, raid-gate semantics, and the
  level-bracket/rank/boss derivations.

## Verification

- tsc 0 · eslint 0 · vitest **631** (7 new) · build clean.
- Live boot: `Bot tier resync complete: 5 of 54 bot rows healed`; SQL drift re-check `0 rows`;
  distribution T1×28 / T2×15 / T3×5 / T4×4 / T5×1 / T7×1.
- Downstream: the Elite beer base previously reading T1 is now raid-eligible (T4+ gate),
  and its defeat pays the correct Elite XP multiplier.
