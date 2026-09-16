# FID-20260912-088 — Procedural elevation hillshading for /map

**Filename:** `FID-20260912-088-map-hillshading.md`
**ID:** FID-20260912-088
**Severity:** LOW
**Status:** closed
**Created:** 2026-09-13

**Date:** 2026-09-13 · **Type:** feature (map visual) · **Spec:** dev/art/MAP-OVERHAUL-SPEC.md § Elevation

## Problem

FID-087 rebuilt the map but terrain still reads flat — a patchwork of base colors with
per-tile jitter, no sense of landform. Real cartography gets depth from **relief
shading**: light a height model from a fixed direction and shade slopes accordingly.
No art assets required — just math over the tile grid.

## Design

**`lib/mapElevation.ts`** — pure, deterministic, UI-free:

- `elevationAt(x, y)` — two-octave value noise (lattice 22 tiles + 11 tiles at 25%
  weight), smooth-hermite interpolation, normalized [0, 1]. Same input → same output,
  every process, forever.
- `hillshadeAt(x, y)` — central-difference gradient at the tile, dot product against a
  fixed **NW sun** (−0.7, −0.7), folded around 0.5 (flat = mid-gray), clamped [0, 1].
- `tileShade(x, y, terrain)` — the single shading decision consumed by BOTH renderer
  terrain paths (cached layer + culled direct draw), multiplied with FID-087 jitter:
  - landmark specials (Bank/Shrine/AuctionHouse) **exempt** — glyphs never lurk in shade;
  - resource land spans the tuned band **0.86×–1.18×**;
  - wasteland tamed **60%** toward flat — dead ground reads calm, resource land dramatic.

**Renderer** (`CanvasMapRenderer.tsx`): two one-line changes — cache fill and direct
draw both use `shadeHex(base, tileShade(…) * tileJitter(…))`. No new passes, no
per-frame cost (shade is baked into the cached layer; the direct path re-derives it
from the same pure function).

## Bugs the probe caught (would have shipped invisible shading)

1. **RELIEF normalization mismatch.** The first constant (1.35) assumed gradients the
   field never produces — actual max |∇h| ≈ **0.027**. First pass would have modulated
   lightness by ±1%, i.e. imperceptible. RELIEF set to 0.03 (probed, not guessed); shade
   now spans **0.21–0.79** (p1–p99).
2. **Wrong y-gradient sample point.** `hillshadeAt` differenced elevation at
   (x±1, **y+1**) — the x-gradient of the row below, not the y-gradient at (x, y). The
   sun's y component acted on correlated-but-wrong data. Fixed to the proper central
   difference at (x, y±1).

## Tests (10, `__tests__/lib/mapElevation.test.ts`)

- Purity (bit-identical outputs), normalization, spatial coherence (neighbor delta ≪
  field range — smooth, not white noise).
- **Light direction as a zero-violation conditional**: with the y-gradient filtered
  out, east-rising tiles are lit and east-falling tiles shadowed on *every* tile —
  tile-count comparisons rejected (field-asymmetry noise), violation counting pinned.
- Flat ground ≈ 0.5 exists; shade band respected for all shadeable terrains; specials
  exactly 1; wasteland deviation < 0.12; determinism (cache/direct agreement).

## Gates

tsc 0 · eslint 0 · vitest 651 (10 new) · build clean · live screenshot verified.
