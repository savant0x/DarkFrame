# FID-20260912-082 — Flag-bearer overlay & status-strip alignment

## Operator report

"fame / LVL 18 / YOU HOLD THE FLAG — this section is overlapping the bottom bar of the
picture; also when that is visible, the section on the bottom right showing the 'time until'
next harvest seems to be cut off on the bottom. Review how this is designed and ensure it's
aligned properly."

## Root causes — two layout collisions in the tile viewport

### Collision 1: two `.nn-viewport__chip` rules fighting each other

The status strip's cooldown chip ("`14h 32m until reset`", the bottom-right "time until next
harvest" readout) and the shrine corner badge **shared the same class**, styled twice:

- Line ~955 (strip context): `.nn-viewport__chip { margin-left: auto; }` — in-flow chip at
  the bar's right end.
- Line ~1847 (shrine badge context): `.nn-viewport__chip { position: absolute; top: 14px;
  right: 14px; ... }` — a corner badge.

Later stylesheet position wins: the strip chip was dragged out of the bar flow into an
absolute top-right position, while the badge's own `--violet` modifier made the cooldown chip
render as a violet corner pill floating over the viewport — vertically clipped by the bar's
bottom edge on cooldown tiles. The reported "cut off on the bottom" is exactly this chip.

### Collision 2: the bearer info card sinks into the status strip

`.nn-bearer__info` ("fame · LVL 18 · YOU HOLD THE FLAG") anchored at `bottom: 12px` — inside
the 44px `.nn-viewport__status` strip's territory, with no max height and no overflow bound.
When you're on the flag tile, the card overlaps the bar; on short viewports it swallows it.

## Fixes

1. **One chip class for the strip** — `.nn-viewport__chip` is now a single in-flow rule
   (inline-flex, `margin-left: auto`, `flex: 0 0 auto`, `white-space: nowrap`,
   tabular-nums). The strip's own `overflow: hidden` guard was added so long cooldown text
   degrades horizontally, never vertically.
2. **Corner badge gets `.nn-viewport__badge`** — the shrine indicator's absolute top-right
   rule (and its `--violet` modifier) now live on a dedicated class; TileRenderer updated.
3. **Bearer card anchored above the bar** — `.nn-bearer__info` now sits at
   `bottom: calc(var(--nn-viewport-strip-h, 44px) + 10px)` with
   `max-height: calc(60% - strip - 10px)` + `overflow: hidden` and a `max-width` bound: the
   card grows upward from the bar, can never reach the strip, and can't overflow its tile.

## Verification

- Single `.nn-viewport__chip` rule block (grep-verified), badge rules renamed, consumers updated.
- tsc 0 · eslint 0 · vitest full suite · production build clean; server restarted on the build.
- Visual check: on the flag tile the "YOU HOLD THE FLAG" card clears the bottom bar; on a
  cooldown tile the "Xh Ym until reset" chip sits inside the strip at the bar's right end,
  fully visible.

## Notes

`TileHarvestStatus` (the fixed top-right "Harvest Cooldown" toast on the stats view) was
audited and is a different surface — fixed-position, `z-40`, top-anchored; unaffected.
