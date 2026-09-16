# FID-20260912-089 — Animated fly-to warp + SHIP terrain heal

**Filename:** `FID-20260912-089-flyto-warp.md`
**ID:** FID-20260912-089
**Severity:** MEDIUM
**Status:** closed
**Created:** 2026-09-13

**Date:** 2026-09-13 · **Type:** feature (map camera) + fix (terrain data) · **Builds on:** FID-087 (camera), FID-088 (relief)

## Part 1 — the fly-to warp

Clicking the minimap (or double-clicking a tile, or pressing Home) now **flies** the
camera to the target instead of snapping.

**Math (lib/mapCamera.ts, pure, 12 tests):**
- `easeInOutCubic` — flat at both ends, no start/stop jerk.
- `resolveFlyToTarget` — warps land at **Region scale (fit×8)**, never zooming OUT
  (a cross-map pan at fit zoom doesn't force a pointless dive); above Region the
  current scale is preserved; target pre-clamped to bounds.
- `sampleFlyTo` — position eases linearly-in-eased-space; scale blends **geometrically**
  (constant perceived zoom rate — the visual zoom doesn't race then crawl). Monotone
  non-decreasing scale + pre-clamped endpoints ⇒ every frame stays on the map by
  construction (no mid-flight clamping needed — an earlier draft's clamp would have
  snapped frames to map center).
- `flyToDuration` — distance-scaled, clamped [450, 1100] ms: hops snap, sweeps glide.

**Page wiring (app/map/page.tsx):**
- Flight lives in refs, sampled per rAF into `cam`; **any manual input cancels
  instantly** (wheel, drag, WASD/arrows, ±, presets, resize) — the warp never fights
  the user.
- Minimap click + tile double-click + Home/H all route through `flyTo`.
- **Zoom preset label now follows reality**: after any flight, the sidebar highlights
  the nearest preset for the actual scale (previously the label could lie after wheel/
  warp zooms).
- Shortcuts panel documents the new verbs.

**Renderer:** `onTileDoubleClick` prop added (page owns all animation).

## Part 2 — the SHIP terrain heal (found in-flight, user-facing)

Live verification exposed `GET /api/map/terrain → 500`: two tiles at (25,110)/(26,110)
hold terrain **`SHIP`** — remnants of a removed naval feature. `SHIP` has no wire
character in `lib/terrainCodec.ts` (by design — Law 14: fail loudly, never fabricate),
so ONE unknown row threw during encode → 500 → **the map page silently rendered
`generateMockMapData()` instead of the real world**.

Fix: `lib/migrations/shipTerrainHeal.ts` (FID-072/086 self-heal shape, marker
`0030_ship_terrain_heal`) — every boot, any tile whose terrain isn't codec-expressible
is demoted to Wasteland; re-runs are free. Wired into server.ts after the FID-086 block.

Live result: `Ship terrain heal complete: 2 unknown-terrain tile(s) demoted to
Wasteland` → terrain endpoint 200 → the map now shows the REAL terrain grid (with
FID-088 relief shading) instead of the mock.

## Gates

tsc 0 · eslint 0 · vitest **667** (12 fly-to + 4 heal) · build clean · live-verified:
minimap click → animated flight → Region landing, preset label synced, real terrain served.
