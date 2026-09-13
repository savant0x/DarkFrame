# MAP-OVERHAUL-SPEC — the AAA cartographic rebuild of /map

**Created:** 2026-09-12 · **Status:** implementing (FID-20260912-087) · **Referenced by:** FID-068 (map nav link)

## Why

The current /map is a 2015-era flat color grid bolted into a scroll box:

1. **Fake zoom.** `zoomLevel` state + `ZOOM_SCALES` exist, but the renderer ignores them —
   it always draws the full 150×150 world at a fixed 24px/tile inside a 3600×3600 scroll
   container. The zoom buttons are cosmetic.
2. **Palette collision.** Canvas uses raw Material colors (`0x4CAF50`, `0xF44336`,
   `0x424242`) while the entire app speaks neon-noir (`--nn-*`). Axis rulers are `#00ff00`.
3. **No camera.** Panning = browser scrollbars. No drag, no wheel zoom, no fit-to-view,
   no DPR awareness (blurry on retina).
4. **No wayfinding.** No minimap, no sector framing, no hover feedback, labels either
   always-on (cluttered) or absent.

## Goals

A dark, glowing, readable tactical map that feels native to DarkFrame's neon-noir design
system, with a real camera (zoom/pan/minimap) and zoom-aware information density.

## Architecture

```
lib/mapPalette.ts     terrain + marker colors, tier rings (shared with MapLegend)
lib/mapCamera.ts      pure camera math: worldToScreen / screenToWorld / zoomAtPoint /
                      clampCenter / fitScale (unit-testable, no canvas)
components/map/CanvasMapRenderer.tsx   rewrite: cached terrain layer + per-frame overlays
app/map/page.tsx      owns camera state; drag-pan, wheel zoom, keyboard pan, minimap
```

### Camera model

- `scale` = **pixels per tile** on screen. Camera = world center `(cx, cy)` in tile coords.
- `fitScale = min(canvasW, canvasH) / 150` — FullMap fits the whole grid, no scroll.
- Zoom presets multiply fit: FullMap ×1, Quadrant ×2, Zone ×4, Region ×8 (existing
  `ZoomLevel` contract kept; `ZOOM_SCALES` semantics preserved).
- Wheel zoom anchors the world point under the cursor (`zoomAtPoint`); drag pans 1:1
  (`dx / scale`); WASD/arrows pan; Home/H re-centers on player; camera clamped to map bounds.

### Rendering pipeline (performance)

- **Terrain layer cached offscreen**, invalidated only when mapData / scale / canvas size
  changes: terrain fills (bucket-batched, FID-026 §2 preserved), per-tile deterministic
  lightness jitter (hash of x,y → ±6% — organic patchwork, not Excel cells), 10-tile
  coordinate grid + neon rulers, 50-tile sector borders with sector labels, special-tile
  glyphs (bank/shrine/auction).
- **Per-frame overlay pass** (cheap): markers, trails, hover crosshair, selection ring.
  rAF loop; overlay-only redraw when nothing animated.
- **devicePixelRatio-aware** — crisp on retina.
- **Zoom-aware density:** Region/Zone show base labels + grid; Quadrant drops labels;
  FullMap shows only flag, player, and beer bases (bases still visible at map scale —
  FID-038's requirement).

### Palette (neon-noir adaptation)

| Terrain | Base | Reads as |
|---|---|---|
| Wasteland | near-void violet-gray | dead ground |
| Metal | deep teal | cyan resource (matches UI's Metal=cyan) |
| Energy | dark amber-brown | hot resource (UI's Energy=amber) |
| Cave | deep violet | danger/depth |
| Forest | deep green | cover |
| Factory | steel blue-gray | industry |
| Bank/Shrine/AuctionHouse | gold/violet/magenta | specials pop with glow |

Markers: player = cyan glow disc + white core; flag = gold pulsing (existing trail fade
preserved); beer bases = magenta diamonds with **tier rings** (FID-086 ramp T1 green →
T7 red); bot bases = red diamonds. Labels in `nn-lab` chip style.

### Minimap

150×150 offscreen terrain thumbnail (1px/tile, rendered once per mapData change) bottom-right:
viewport rectangle, player dot, flag dot; click-to-jump. Toggleable.

### Non-goals (this FID)

Fog of war, live other-player movement, PixiJS/WebGL. These are additive layers on the new
camera/render pipeline and stay parked in dev/planned.md.

## Acceptance

- Zoom presets actually change magnification; wheel + drag + keyboard all work; camera
  never leaves the map bounds.
- Full map visible without scrollbars; retina-crisp.
- Legend colors match canvas exactly (single palette module).
- Camera math unit-tested (round-trips, cursor-anchored zoom, clamping).
- Gates: tsc 0 · eslint 0 · vitest green · build clean; live page loads with data.
