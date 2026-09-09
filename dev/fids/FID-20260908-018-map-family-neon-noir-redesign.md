# FID-20260908-018: Map family neon-noir remediation — legacy token layer + un-gated game FX

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-018-map-family-neon-noir-redesign.md`
**ID:** FID-20260908-018
**Severity:** MEDIUM (the map is a primary gameplay surface; it renders on a retired token layer with un-gated animations)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

The Phase 6 census attributed ~35 banned instances to "map". RED proves the real scope
larger and different: `app/map/page.tsx` (11 core) and `components/TileRenderer.tsx`
(4 core + 8 un-gated `animate-pulse` game effects + 2 raw `gray-400/600` terrain stops)
were joined by `components/map/MapLegend.tsx` and `ZoomControls.tsx`, which still style
on the **legacy token layer** (`bg-glass-light`, `border-glass-border`,
`text-text-primary/secondary` — classes the old census pattern never counted), and
`TileHarvestStatus.tsx` (un-gated `Clock` pulse, chrome `shadow-lg`). Canvas 2D fill
colors (`CanvasMapRenderer`, `MapContainer`) are canvas paints, not CSS — recorded as a
documented exception.

## 2. Evidence (RED)

- `app/map/page.tsx` — 11 core: `bg-gradient-to-b from-bg-space to-black` shell,
  7× `bg-glass-light` (header, sidebar, 3 info cards, 2 mobile overlays),
  `border-glass-border` ×6, `bg-glass-dark` main, `bg-bg-void` canvas frame,
  un-gated `animate-spin` loading spinner, chrome `shadow-lg` ×4.
- `components/map/MapLegend.tsx` — `bg-glass-light` shell + `border-glass-border`
  + `text-text-primary/secondary` + mobile `bg-glass-light` rows.
- `components/map/ZoomControls.tsx` — same legacy layer on labels/kbd/rows; the
  inactive zoom button uses `bg-glass-light … hover:bg-glass-light` (same class
  twice — no hover state at all).
- `components/TileRenderer.tsx` — 8 un-gated `animate-pulse` sites (bearer edge,
  giant flag glyph, trail edge/glow/mark, attack edge, damage number) + one
  `animate-spin` class check; Metal terrain stops `from-gray-400 to-gray-600`
  (raw Tailwind grays, FID-011's own exception note says token fills).
- `components/TileHarvestStatus.tsx` — un-gated `<Clock className="… animate-pulse">`,
  chrome `shadow-lg`, `animate-fade-in` (un-gated mount anim).
- Canvas exception: `CanvasMapRenderer.tsx` / `MapContainer.tsx` fill/stroke via
  `ctx.fillStyle/strokeStyle` (canvas paint API, outside the CSS rubric).

## 3. Impact Analysis

- Files touched: 5 TSX (+ `app/neon-noir.css` if a gated trail utility is needed —
  decision: `nn-pulse` composes, no CSS change required).
- Risk: TileRenderer is 1,129 lines of game FX; **only the animation-gating and
  two terrain stops change — no geometry, no effect layers, no timings.** The
  bearer/trail/attack visual systems were redesigned in FID-011 and are not touched.
- No API, schema, or game-logic changes.

## 4. Five Questions

1. **Root cause?** Map family predated the FID-010 wave and the old census pattern
   missed the legacy token layer classes entirely (same undercount as FID-015).
2. **Reproduce?** `grep -rnE "bg-glass|text-text-|border-glass|bg-bg-|animate-(pulse|spin|fade-in)" app/map components/map components/TileRenderer.tsx components/TileHarvestStatus.tsx`
3. **Smallest correct fix?** Token-layer migration + gate every animation through
   `nn-pulse`/`nn-fade`/`nn-spin-icon`; token-ize the two raw gray stops; keep all
   FID-011 game FX intact.
4. **Verify?** Per-file tsc between edits; family eslint; census greps; handler
   census HEAD↔working; full vitest.
5. **Side effects?** Reduced-motion users gain correct behavior (animations stop
   instead of running forever). Visual identity of FX preserved (same opacity ramps).

## 5. Proposed Fix (GREEN)

1. `app/map/page.tsx` — shell `from-bg-space to-black` gradient → `var(--nn-void)`;
   header/sidebar/cards → `nn-panel` family; `text-text-*` → `--nn-text-*` tokens;
   spinner → `Loader2` + `nn-spin-icon`; mobile overlays → `nn-surface--dark`;
   emoji HUD icons in headings replaced per chat/message idiom (structural labels).
2. `MapLegend` — shell → `nn-panel`; rows/tip → token text; swatch colors are data
   (TILE_COLORS hex + `#2196F3` player blue) — data mapping retained (legend swatches
   mirror canvas paints; changing them would desync legend from map).
3. `ZoomControls` — labels → token text; inactive button → `nn-tabchip`-style token
   chrome with a real hover state; `kbd` → token bg.
4. `TileRenderer` — 8 `animate-pulse` → `nn-pulse` (opacity-only, composes with the
   inline color-mix backgrounds); `animate-spin` check → gated; Metal stops →
   `from-[color:var(--nn-text-tertiary)] to-[color:var(--nn-void)]` (token ridge→substrate,
   keeping the documented two-stop terrain art); damage/flag glyph untouched otherwise.
5. `TileHarvestStatus` — `Clock` pulse → `nn-pulse`; `animate-fade-in` → `nn-fade`;
   `shadow-lg` → token glow shadow.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint (family) / vitest / rubric greps | tsc 0 · family eslint 0 · vitest 362/0/1 · census 0 + 3 documented terrain-art gradients | pass |
| Method 2: manual re-read | per-file tsc between edits; handler census HEAD↔working | 22/22, 7/7, 25/25, 1/1, 1/1, 3/3, 16/16, 5/5 — identical | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete — hand-migrated file by file (no scripts), per-file tsc verification between each.
- **Changes applied:**
  1. `app/map/page.tsx` — `from-bg-space to-black` shell → `var(--nn-void)`; header → `nn-panel__header` + Orbitron display title; sidebar/3 info cards/mobile overlays → `nn-panel`; `text-text-*` → `--nn-text-*` tokens; emoji HUD glyphs in headings removed; spinner → `Loader2` + gated `nn-spin-icon`; `bg-glass-dark` main → token; `bg-bg-void`+`border-glass-border` canvas frame → token pair; 4 chrome `shadow-lg` → token glow shadows; mobile overlay dividers → token border.
  2. `components/map/MapLegend.tsx` — shell → `nn-panel`; tip row → token border/text; mobile rows → token bg; label text → token; legend swatch *data colors* (TILE_COLORS hex, `#2196F3` player blue) deliberately retained — they mirror the canvas paints so legend and map stay in sync.
  3. `components/map/ZoomControls.tsx` — labels → token text; the inactive zoom button's `bg-glass-light … hover:bg-glass-light` (same class twice — a hover state that could not exist) → token chip chrome with a real hover ramp; `kbd` → token bg + border.
  4. `components/TileRenderer.tsx` — 7 `animate-pulse` sites → gated `nn-pulse`; the giant flag glyph's **inline `animation:` shorthand** (which overrode its class and bypassed gating) → new gated composite `.nn-fx-flag` (nn-pulse + float, reduced-motion honored); Metal terrain stops `from-gray-400 to-gray-600` → `from-[--nn-text-tertiary] to-[--nn-void]` (keeping FID-011's documented two-stop terrain-art exception); bank badge `shadow-lg` → token amber glow. No effect geometry, layers, or timings altered.
  5. `components/TileHarvestStatus.tsx` — un-gated mount `animate-fade-in` → gated `nn-fade`; `Clock` pulse → `nn-pulse`; `shadow-lg` → token glow.
  6. In-scope lint remediation (family zero-error gate): 13 pre-existing `any`s across GridRenderer (5), MapContainer (4), PlayerMarker (4) — all were PixiJS custom-property bolting (`(g as any).tileData = …`); fixed honestly with **intersection-type aliases** (`TileGraphics`, `HighlightGraphics`, `MarkerGraphics`, `AnimatedMarkerGraphics`) and Pixi's own `Ticker`/`Container` types instead of casts. No `as any`, no eslint-disable.
- **Gate-caught self-corrections during the loop:** a `sm block` typo in my own replacement (caught by follow-up grep); an initial `bg-[color-mix(var(--nn-glass-dark)_100%,…)]` mis-formulation simplified to `bg-[color:var(--nn-glass-dark)]`; the flag-glyph inline-shorthand conflict (self-caught — class gate would have been inert).
- **Documented exception:** Canvas 2D paints (`ctx.fillStyle/strokeStyle` hex numbers in CanvasMapRenderer/MapContainer/PlayerMarker) are canvas paint API, outside the CSS rubric — unchanged.
- **Gates:** tsc 0 · eslint (family: app/map + components/map + TileRenderer + TileHarvestStatus) 0 · vitest **362 passed / 0 failed / 1 skipped** · rubric census **0** (only the 3 documented terrain-art gradients remain, per FID-011 §5.5).
- **Audit Method 2:** handler census identical HEAD↔working on all 8 files; the only non-class changes are the typed PixiJS aliases.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 (family) · [x] tests pass · [x] rubric census 0
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/map/page.tsx components/map/MapLegend.tsx components/map/ZoomControls.tsx components/TileRenderer.tsx components/TileHarvestStatus.tsx dev/fids/FID-20260908-018-map-family-neon-noir-redesign.md dev/fids/FID-20260908-006-neon-noir-full-internal-redesign.md dev/session-summaries/SESSION-2026-09-08-002.md`
- **Follow-through (proposed, not executed):** leaderboard (27), shop (16), then the
  remaining legacy-token-layer sweep (`bg-glass-light` consumers outside this family:
  leaderboard, shop/rp-packages, specialization, BankPanel, SafeHtmlRenderer,
  ConfirmDialog) and the Phase 7 re-audit.
