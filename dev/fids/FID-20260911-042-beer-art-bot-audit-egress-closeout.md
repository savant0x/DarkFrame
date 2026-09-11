# FID-20260911-042 — Beer Art Spec + Bot Audit + Egress Closeout

## Beer Base art: spec written, wiring shipped
- dev/art/BEER-BASE-ART-SPEC.md: exact filenames public/assets/tiles/bases/beer/{1..10}.jpg,
  level→tier mapping (ceil(level/10), clamp 1..10), 1024×1024 JPEG ≤250 KB, NEON NOIR palette,
  verification recipe. Player-rank set sketched for phase 2.
- TileRenderer: Beer Bases now try beer/{tier}.jpg first, degrade to the shared bot tier set
  on 404 (tile never renders bare while art is incomplete). Gates: tsc 0 · eslint 0.

## Bot ecosystem audit: HEALTHY (no remediation required)
- 52 bots, 52/52 legal tile claims, zero ghost claims.
- Silent_Citadel (Beer Base): total power 15,070 ∈ WEAK band [15K–50K] — FID-034 contract HOLDS.
- Regular bots: armies are young (repopulated Sep 10) and mature through the hourly growth
  engine's BUILD_RATES (Raider 1.0/h, Fortress 0.5/h…) — current cross-level spread is age
  variance, not a defect. Flag_Bearer_1027 at 800 STR is by design (capturable flag).
- Apparent inversions (L25 Fission_Envy 3.4K < L15s) explained: Hoarder spec (0.25/h build rate).

## Egress: closeout
- Tutorial/index audit correction: all hot-path indexes EXIST (tutorial_action_player_step_unique,
  tutorial_progress_player_id_unique, player_activity_player_timestamp_idx, flag_trail_point_idx).
  The legacy scripts/create-tutorial-indexes.ts is MongoDB-era dead code — superseded.
- pg_timezone_names 40K-row query: NOT from app code (client-side polyfill; no server fix).
- dev/EGRESS-WATCH.md: dashboard reading plan, success criteria, one-command re-audit recipe.

## Rulings recorded
- Raid loot: full chosen stockpile stands (PvE economics); 20% was legacy PvP. (FID-038 addendum.)
- Tutorial fresh-account probe: PASS — all 7 steps validate, replay guard holds, cleanup clean.

## Verification
- tsc 0 · eslint 0 · vitest 493 passed/1 skipped · build exit 0 (post-042 gates: tsc+eslint on TileRenderer).
- 11 commits landed through the attribution guard (authors: savant0x only, zero codebuff footers).
