# FID-20260912-085 — Beer Base loot drilldown in the admin registry

**Date:** 2026-09-12 · **Type:** feature (admin UX) · **Follows:** FID-084 (bot identity in registry)

## Problem

FID-084 put beer bases in the Player Management table with a Type column, but comparing base
wealth meant eyeballing the Metal/Energy cells. The interesting comparison — total loot vs.
defensive strength vs. army size — required opening each base in the player viewer one at a time.

## Design

- **Loot cells toggle the drilldown.** For beer-base rows, the Metal and Energy cells are
  clickable (dotted underline affordance); clicking expands a detail row beneath.
- **The drilldown row** renders per-base: Metal, Energy, Combined loot, STR, DEF, Army size
  (summed from the `units` jsonb), and Tier — one row per base, no extra requests.
- **Regular players/bots keep static cells** — the toggle and affordance only exist on
  beer-base rows, so the table doesn't grow noisy click targets.

## Implementation

- `app/api/admin/players/route.ts` — select now includes `totalStrength`, `totalDefense`,
  `units`; the response mapping exposes `totalStrength`, `totalDefense` (null-coalesced to 0
  for legacy rows) and `armySize` (Σ `unit.quantity` from the units jsonb).
- `app/admin/AdminView.tsx` — `lootOpen` Set state (username-keyed), `toggleLoot` handler,
  clickable loot cells, and the expanded `<tr>` inside a `Fragment` (the map previously
  returned a single `<tr>`; two siblings per iteration required the fragment wrap).
- `__tests__/api/admin/playersLootFields.test.ts` — contract tests: every row exposes the
  three numeric fields (the UI never guards against missing keys), `armySize` sums quantities
  (120+80+25 → 225), and legacy null stat blocks coalesce to 0 rather than leaking `undefined`
  onto the wire.

## Verification

- tsc 0 · eslint 0 · vitest 624 passed (3 new) · production build clean.
- Server restarted on the new build; `/game` answers 307 (auth redirect) as expected.
- Regression note: the map's second-sibling return was a real parse error (TS1005) caught by
  tsc before runtime — the Fragment wrap is the documented React pattern for multi-`<tr>`
  rows and is now the pattern for any future per-row expansion in this table.
