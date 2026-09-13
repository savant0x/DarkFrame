# FID-20260912-087 — AAA map rebuild (real camera, neon-noir cartography, minimap)

**Date:** 2026-09-12 · **Type:** feature (full /map overhaul) · **Spec:** dev/art/MAP-OVERHAUL-SPEC.md

## Problem

The old /map faked everything a map should do:

1. **Fake zoom** — `zoomLevel` + `ZOOM_SCALES` existed but the renderer ignored them; it
   always drew the full 150×150 grid at 24px/tile inside a 3600×3600 scroll box. The zoom
   buttons were cosmetic.
2. **Palette collision** — raw Material hexes (`0x4CAF50`, `0xF44336`) + `#00ff00` rulers
   against an otherwise neon-noir app; legend colors were a second, drifting copy.
3. **No camera** — panning was browser scrollbars; no drag, no wheel zoom, no fit-to-view,
   no DPR awareness.
4. **No wayfinding** — no minimap, no hover, labels either always-on or absent.

The spec this FID implements was referenced by FID-068 but never landed; it was written
first here (dev/art/MAP-OVERHAUL-SPEC.md), then built to it.

## Architecture

- **`lib/mapCamera.ts`** — pure camera math: continuous world space (map spans [0,150]²,
  tile centers at n−0.5), `worldToScreen`/`screenToWorld`, cursor-anchored `zoomAtPoint`,
  bounds `clampCameraToMap` (centers when zoomed out past fit), `fitScale`, `panByPixels`.
  10 unit tests pin the invariants (round-trips, anchor stability, clamping).
- **`lib/mapPalette.ts`** — single source of color truth: `TERRAIN_PALETTE` (deep
  desaturated neon-noir bases, glow accents reserved for specials), `MAP_MARKERS`,
  FID-086 `tierColor` ramp, deterministic per-tile jitter (±3%), `shadeHex`. Consumed by
  the renderer AND MapLegend — they cannot drift.
- **`components/map/CanvasMapRenderer.tsx`** — rewritten as a pure drawing surface:
  - Terrain layer cached offscreen at 8px/tile (bucket-batched fills, FID-026 §2 preserved),
    blitted through the camera; direct culled draw above 8px/tile for sharpness.
  - Overlay pass: trail fade, base diamonds with FID-086 tier rings, pulsing flag, player
    glow disc, hover crosshair, selection ring, 10-tile grid + 50-tile sector borders with
    NW/NE/SW/SE labels, zoom-aware label density (labels only at Zone+).
  - devicePixelRatio-aware; rAF only while the flag pulses.
- **`app/map/page.tsx`** — owns the camera: fit-to-view on load, 4 real zoom presets
  (fit ×1/2/4/8, ZoomLevel contract preserved), cursor-anchored wheel zoom, drag pan
  (click-vs-drag discrimination at 6px), WASD/arrows/Home/H/+− keys, and a 1px/tile
  minimap (viewport rect + player/flag dots, click-to-jump, hideable).

## Verification

- tsc 0 · eslint 0 · vitest **641** (10 new camera tests) · build clean.
- Live-previewed at both extremes: FullMap fit (whole grid, no scrollbars, clean marker
  field) and Zone (16px/tile, legible base labels, minimap rect tracking). Screenshot-
  verified after fixing the two fit-zoom polish issues the first screenshot exposed
  (label pileup → Zone+ only; jitter ±6% → ±3%).

## Non-goals (parked, per spec)

Fog of war, live other-player movement, WebGL. The camera/pipeline makes them additive later.
