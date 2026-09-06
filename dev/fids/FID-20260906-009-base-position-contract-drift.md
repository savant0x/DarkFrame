# FID-20260906-009: Base Position Contract Drift — Sidebar Reads (0,0)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-009-base-position-contract-drift.md`
**ID:** FID-20260906-009
**Severity:** HIGH (every player sees a wrong base location; the same seam also nulls the public profile's base and previously crashed TileRenderer)
**Status:** created → GREEN
**Created:** 2026-09-06

---

## 1. Summary

The left-sidebar PLAYER INFO "Base" readout renders `(0, 0)` for every player whose base is not actually at the origin. DB truth is correct; the data is lost at one seam — the §5.0 public projection.

## 2. RED — Evidence (file:line, live-probed)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Sidebar renders **nested** `player.base?.x ?? 0` | `components/StatsPanel.tsx:193` |
| F2 | Client contract declares **nested** `base: Position` | `types/game.types.ts` (`Player` interface, `base: Position`) |
| F3 | Service mapper produces **nested** `base: { x: row.baseX, y: row.baseY }` | `lib/playerService.ts:31` |
| F4 | §5.0 sanitizer allowlist carries flat `baseX`/`baseY` but has **no `base` field** → nested object stripped on every projection | `lib/playerSanitize.ts:47-49` (allowlist), absence of `base` in `PUBLIC_FIELDS` |
| F5 | **Live probe:** `/api/player?username=fame` → `base: undefined`, `baseX: 73`, `baseY: 70`, `currentPosition: {x:55,y:1}` (nested currentPosition *survives* because it IS allowlisted — proving F4 is the delta) | curl against dev server, 2026-09-06 |
| F6 | DB truth correct: `fame` base = (73,70) | direct DB row read, 2026-09-06 |
| F7 | Downstream victims of the same seam: public profile returns `base: null` (`app/api/profile/[username]/route.ts:99` guards on `player.base` which is stripped) and its page renders `profile.base.x` **unguarded** (`app/profile/[username]/page.tsx:177`) → TypeError for any player. `TileRenderer.tsx:292` reads `player.base.x` (now guarded with `player?.base &&` — the guard exists because this seam already crashed the tile renderer once this session). | file reads + `/api/profile/fame` live probe → `"base":null` |

## 3. Root Cause

Contract drift across the projection seam introduced by the §5.0 allowlist (FID-20260904-005 §5.0): the allowlist was written from the *row* shape (flat columns) while consumers are written against the *documented* shape (nested `base: Position`). `currentPosition` got both representations; `base` got only flat. Every consumer of nested `base` downstream of `sanitizePlayer` silently degraded to `?? 0` fallbacks or `null`.

## 4. Five Questions

1. **What exactly is broken?** Nested `base` never reaches any client after §5.0 projection.
2. **Since when?** Since the §5.0 allowlist landed (FID-20260904-005); pre-existing user-visible symptoms (TileRenderer crash) reported this session.
3. **What's the blast radius?** Every `/api/player` consumer (GameContext → StatsPanel, TileRenderer), the public profile API/page. **No security impact** — base coords are public tile data by design (`isAnyBase` visibility).
4. **What's the minimal correct fix?** Compose the nested `base` at the projection seam — one truth, all consumers repaired.
5. **How do we prove it fixed?** Live API probes (both endpoints return `{x:73,y:70}`), UI probe of the live sidebar, full gates.

## 5. GREEN — Design

- **R1 (`lib/playerSanitize.ts`):** after the allowlist copy, compose `out.base = { x, y }` from numeric `baseX`/`baseY`; if the input already carries a nested `base` (mapped Player shape), pass it through. Documented in the allowlist comment block. FORBIDDEN invariant untouched.
- **R2 (`app/profile/[username]/page.tsx`):** ~~defensive guard~~ **already satisfied** — audit pass found the page types `base` as `{ x; y } | null` (line 29) and guards every access (`{profile.base && ...}`, line 176). No change required; finding struck, not silently dropped.
- **Non-goals:** no consumer renames (the documented `Player` contract is the truth; projection conforms to it, not vice versa). No changes to FORBIDDEN list.

## 6. Verification Plan

1. `tsc --noEmit` → 0; eslint on touched files → clean; full suite → pass.
2. Live: `/api/player?username=fame` → `base:{x:73,y:70}`; `/api/profile/fame` → `base:{x:73,y:70}`; bot profile still 200.
3. UI drive: live `/game` sidebar PLAYER INFO → `Base (73, 70)`.
4. Loop record appended; archive; CHANGELOG; commit & push (standing authorization).

## 7. Loop Record

- **Pass 1 (RED audit):** F5 live probe re-run post-design — confirms F4 is the sole delta (nested `currentPosition` survives; nested `base` does not). R2 confirmed required by reading `page.tsx:177` unguarded access. No design corrections needed.
