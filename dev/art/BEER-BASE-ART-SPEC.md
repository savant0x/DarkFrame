# Beer Base & Bot Base Art Spec — FID-20260911-042

**Audience:** artist (human) · **Status:** wiring is LIVE in code — files can land any time.
**Last verified against code:** 2026-09-11 (`components/TileRenderer.tsx`, FID-036/037-R2 seam).

## What the code does today (read this first)

- Every tile view of a base **not owned by you** renders a tier image derived from the
  base's level: `tier = ceil(level / 10)`, clamped to 1..10.
  - L 1–10 → `1.jpg` · L 11–20 → `2.jpg` · L 21–30 → `3.jpg` · … · L 91+ → `10.jpg`.
- **Bot bases** currently load `/assets/tiles/bases/{tier}.jpg` (the existing 1024×1024 set).
- **Beer Bases** now load `/assets/tiles/bases/beer/{tier}.jpg` — the new namespace wired
  in FID-042. If a beer file is missing, the loader **falls back to the shared bot set**,
  so nothing breaks while art is in progress.
- Both render through `next/image` with `fill` + `object-cover` inside a ~672px panel.

## Deliverable 1 — Beer Base set (priority)

`public/assets/tiles/bases/beer/1.jpg` … `beer/10.jpg`

| File | Covers levels | Concept |
|---|---|---|
| beer/1 | 1–10 | Roadside shanty still — tarp roof, one barrel, dim neon sign |
| beer/2 | 11–20 | fortified roadhouse — scrap walls, keg barricades |
| beer/3 | 21–30 | Wasteland tavern — brew vats, neon 🍺 marquee |
| beer/4 | 31–40 | Distillery compound — copper stills, pipe web |
| beer/5 | 41–50 | Brewhall fortress — catwalks, storage silos |
| beer/6 | 51–60 | Brewery plant — fermentation towers, steam |
| beer/7 | 61–70 | Mega-brewery — conveyor cities of kegs |
| beer/8 | 71–80 | Arcane brewery — glowing vats, coolant veins |
| beer/9 | 81–90 | Citadel of brew — integrated fortress-brewery |
| beer/10 | 91+ | The Grand Brewery — endgame monolith, sky-sign |

Identity: unmistakably ** beer/keg/tavern iconography** + NEON NOIR palette
(cyan `#22d3ee`, magenta `#e879f9`, amber `#fbbf24` on dark wasteland ground).
The map chip and tile badge already carry 🍺; the art should echo that silhouette.

## Deliverable 2 — Bot Base set (refresh, optional)

`public/assets/tiles/bases/1.jpg` … `10.jpg` (replaces in place, same tier mapping).
Military-industrial ladder: shack outpost → watchpost → compound → fort →
garrison → bunker complex → war factory → command bastion → citadel → mega-fortress.

## Deliverable 3 — Player base set (phase 2, when you're ready)

Player bases are keyed by **rank**, not level. Suggested namespace
`public/assets/bases/rank/{1..10}.jpg` — I'll wire it when art exists (the old
`rank1/base_png.png` was deleted as dead weight).

## Technical constraints (hard)

- **1024×1024 px**, square. `object-cover` crops edges — keep the structure inside a
  centered **80% safe zone**.
- **JPEG, quality ~80, ≤ 250 KB per file.** No alpha/transparency needed.
- Exact lowercase filenames above; `.jpg` only (the loader is extension-explicit).
- No text/watermarks baked in; level & owner render as UI badges over the art.

## How to verify art landed correctly

Drop a file, hard-refresh, and visit any base of the matching level band — e.g. a
level-15 bot base must show `2.jpg`/`beer/2.jpg`, level-29 (the live Beer Base) → `3.jpg`.
Missing beer files silently show the bot art for the same tier (by design).
