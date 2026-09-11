# FID-20260910-038 — Base Intel Surface, Flag Panel Correctives & Resource-Choice Raids

**Date:** 2026-09-10 · **Trigger:** user's live-session screenshot batch (Titan_Gamma tile,
flag panel, OUT OF RANGE strikethrough, single ATTACK BASE button).

## Defects (all user-presented)

### D1 — Base tiles must show level + base class (BOT / BEER BASE)
- Tile-view hostile badge showed owner but not the base class. Now: `☠ BOT BASE (Owner) · LV n`
  or `🍺 BEER BASE (Owner) · LV n` (own base keeps the Home/rank treatment).
- World map (`/map`) rendered terrain only — occupied base tiles were invisible. New
  `/api/map/bases` returns occupied tiles with owner/level/isBeerBase (small payload: 52 bots +
  players); map overlays a per-tile chip with type + LV.

### D2 — Flag panel shows tracker while YOU hold the flag
- Self-view gate was `flagDetail?.actions.isBearer ?? false` — if flagDetail was stale (30s
  poll; capture/challenge/flee/claim didn't refetch), a new holder kept seeing the TRACKER view
  ("Flag_Bearer_1027 is holding it") — tracking yourself, which is pointless.
- Fix: client-side fallback `flagBearer?.username === player?.username` ORs into the gate, and
  every flag action now triggers an immediate flag-data refetch (no more 30s of stale view).

### D3 — "OUT OF RANGE" renders with a strikethrough
- Root cause: `.nn-range` defined twice in neon-noir.css — the flag panel's range PILL
  (FID-032 §3-C) and a 4px `appearance:none` range-SLIDER for FactoryManagementPanel's
  batch-release threshold. The slider block (later in the file) flattened the pill into a
  4px sliver with a track line = fake strikethrough.
- Fix: slider block renamed `.nn-slider` (plus thumb pseudo-selectors); FactoryManagementPanel
  updated. Pill restored.

### D4 — Base attacks need the metal/energy choice (per FID-20251017-023)
- Design doc (archived FID-20251017-023): base raids carry a resource selection (metal/energy).
  Live UI had a single ATTACK BASE button, and the victory readout reused factory vocabulary
  ("FACTORY CAPTURED") — hence "it acts like it's a factory".
- Fix: two-button dispatch — ATTACK · METAL / ATTACK · ENERGY — sending
  `{ defender, resource }`. `/api/combat/attack` accepts `resource` and loots the chosen
  stockpile (multiplier semantics from FID-037 preserved: Beer 3×, regular 1×). FID-023's 20%
  figure belonged to the legacy PvP base-raid path, not the live PvE loop — deviation noted.
- Victory readout: base wins now render `BASE SACKED` (never "FACTORY CAPTURED"), with
  per-resource loot numbers.

## Gates
tsc 0 · eslint 0 · vitest suite · next build; live smoke on :3001 (move-path payload, badge
copy, resource-param attack).

## Verification (live, :3001 production build)
- /api/map/bases: 58 occupied tiles (1 Beer, 57 bot) with owner/level/class ✓
- Flag self-view: API reports fame as holder → actions.isBearer true; client fallback
  ORs bearer identity so the self-view flips immediately after any capture ✓
- Resource raids: invalid resource → 400; valid + wrong tile → 403 presence; live
  metal raid on Titan_Gamma looted metal-scoped (energy delta 0), +800 XP ✓
- Gates: tsc 0 · eslint 0 · vitest 475 passed / 1 skipped · next build exit 0

## Files touched
app/api/combat/attack/route.ts · app/api/map/bases/route.ts (new) · app/game/page.tsx ·
app/map/page.tsx · app/neon-noir.css · components/TileRenderer.tsx ·
components/FlagTrackerPanel.tsx · components/FactoryManagementPanel.tsx ·
components/map/CanvasMapRenderer.tsx
