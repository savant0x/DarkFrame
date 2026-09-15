# FID-20260914-001: troop-transport toggle missing from UI

**Filename:** `FID-20260914-001-troop-transport-toggle.md`
**ID:** FID-20260914-001
**Severity:** medium
**Status:** verified
**Created:** 2026-09-14 01:11

---

## Summary

The Troop Transport technology (7000 RP, `lib/research/techCatalog.ts:140`,
category `movement`, effect "Movement range increased to 5 spaces") has no UI
control: a player who buys it cannot activate it, and the movement pipeline
hard-codes 1 tile per action end to end. Operator directive: add a toggle
button where "PRESS A KEY OR CLICK A DIRECTION" renders
(`components/MovementControls.tsx:147`), spanning the full width of the 3x3
compass, visible only to tech owners; one click activates, a second click
deactivates. While active, every move covers 5 spaces instead of 1.

---

## Environment

- **OS:** Windows 11 (NTFS)
- **Node:** v25.2.1
- **Tool Versions:** Next.js app router, vitest 4.1.2, zod
- **Commit/State:** Working tree

---

## Detailed Description

### Ground truth (discovery evidence)

- **Tech definition** — `lib/research/techCatalog.ts:140-148`: `id:
  'troop-transport'`, cost 7000, prerequisites `[]`, category `movement`,
  effects `['Movement range increased to 5 spaces']`.
- **Ownership state** — `players.unlockedTechs` (jsonb string[]);
  `GET /api/research` returns `unlockedTechnologies: string[]`
  (`app/api/research/route.ts` GET); POST unlocks via
  `spendResearchPoints` + column append.
- **UI anchor** — `components/MovementControls.tsx`: 3x3 compass grid
  (`.nn-dpad`, `repeat(3, 1fr)`, `max-width: 220px`), footnote
  "PRESS A KEY OR CLICK A DIRECTION" below; rendered via
  `components/ControlsPanel.tsx:80`. No transport control exists anywhere.
- **Movement pipeline** — `context/GameContext.tsx:256` POST `/api/move`
  body `{username, direction}` -> `MoveSchema`
  (`lib/validation/schemas.ts:145`, direction only) -> server
  `movePlayer(username, direction)` (`lib/movementService.ts:119`) = ONE
  tile per call, wrap-around on the 1-150 grid.
- **Anti-cheat** — the route calls `detectSpeedHack(username, from, to, ts)`
  (`lib/antiCheatDetector.ts:119`) after every movement:
  `IMPOSSIBLE_DISTANCE: 10` (single action) and `MAX_MOVEMENT_RATE: 1.5
  tiles/sec` (10s window). A transport move legitimately covers 5 tiles —
  at the normal ~2s click cadence that is 2.5 tiles/sec > 1.5, so
  **unmodified thresholds would create false CRITICAL/MEDIUM SPEED_HACK
  flags (DB writes via createFlag) for legitimate tech owners.**

### Root cause

The tech was sold (FID-20260912-058) with a documented effect but no
consumer wiring: no UI toggle, no server-side multi-step path, and
anti-cheat thresholds that assume 1 tile per action.

---

## Impact Assessment

### Affected Components

- `lib/validation/schemas.ts` (MoveSchema steps field)
- `app/api/move/route.ts` (ownership gate + multi-step loop)
- `lib/antiCheatDetector.ts` (step-normalized thresholds)
- `context/GameContext.tsx` (movePlayer steps param)
- `components/MovementControls.tsx` (toggle button + ownership probe)
- `app/neon-noir.css` (toggle styles)
- `components/MovementControls.test.tsx` (toggle coverage)

### Risk Level

- [x] Medium: purchased tech is inert; anti-cheat false positives once active

---

## Proposed Solution

1. **Schema** — `MoveSchema` gains optional `steps: int 1-5` (default 1;
   existing bodies stay valid).
2. **Route** — server-side gate: `steps > 1` requires `unlockedTechs` to
   include `troop-transport` (drizzle read, same pattern as the research
   route — session identity, never client-trusted). Then loop `movePlayer`
   `steps` times in the chosen direction (wrap-around honored per step);
   final player+tile are the response. One request = one rate-limit token
   (the 120/min limiter never sees 5 rapid calls).
3. **Anti-cheat** — `detectSpeedHack` gains an optional `steps = 1` param;
   both thresholds scale with the server-verified step count (10->50,
   1.5->7.5 for transport). Teleportation is still caught; every
   pre-existing call site is behavior-identical at the default.
4. **Client context** — `movePlayer(direction, steps?)`; the body carries
   `steps` only when > 1 (default-path bodies byte-identical).
5. **Toggle UI** — MovementControls probes `GET /api/research` on mount
   (non-critical: on failure the toggle stays hidden); renders the toggle
   only for owners, between the compass and the footnote, full compass
   width; click toggles active state; moves pass `steps: 5` when active.
6. **CSS** — `.nn-dpad__transport` / `--active` reusing the exact nn-dpad
   HUD language (squared, cyan-mix border, Orbitron display font).

### Decisions

- **Toggle state is client-session** (no persistence): the server gates
  multi-step on tech OWNERSHIP, not toggle state — the toggle only controls
  what the client requests, so a page refresh losing the toggle is safe and
  no schema/API surface is added.
- **Server-side loop, not 5 client calls**: avoids 5x rate-limit
  consumption and keeps tutorial tracking (one move per action) and flag
  trail recording (final position) correct.

---

## Verification Gates

- gate: tsc (full repo)
- gate: eslint (full repo)
- gate: vitest (full suite + MovementControls scoped)

---

## Perfection Loop

### Loop 1 -- RED

- **RED:** Discovery complete (evidence above). The tech has no consumer:
  no UI toggle, no multi-step movement, anti-cheat assumes 1 tile/action.
- **GREEN:** 7-file change per the Proposed Solution.
- **AUDIT:** Verifier agent (touches an active FID).

---

## Implementation Evidence

- **Files changed (7):** `lib/validation/schemas.ts` (steps field),
  `app/api/move/route.ts` (ownership gate + multi-step loop),
  `lib/antiCheatDetector.ts` (step-normalized thresholds),
  `context/GameContext.tsx` (movePlayer steps param),
  `components/MovementControls.tsx` (toggle + ownership probe),
  `app/neon-noir.css` (toggle styles),
  `components/MovementControls.test.tsx` (2 toggle tests).
- **tsc:** exit 0 (re-verified 2026-09-14 11:08 EDT).
- **eslint:** exit 0 (re-verified 2026-09-14 11:08 EDT).
- **vitest:** 75 passed | 1 skipped (76 files), 736 passed | 1 skipped
  (737), 0 failures, 16.78s (re-verified 2026-09-14 11:08 EDT) — includes
  the 2 new Troop Transport toggle tests.
- **Law 4 reachability:** `nn-dpad__transport` CSS defined
  (`app/neon-noir.css:1025`) + consumed (`MovementControls.tsx:189`);
  `TRANSPORT_STEPS` declared (`MovementControls.tsx:18`) + consumed
  (`:73`, `:86`); the server gate reads `troop-transport` ownership
  (`app/api/move/route.ts:100`); MovementControls renders via
  ControlsPanel -> game page (production entry).
- **Self-correct note:** the initial str_replace batch lost leading
  whitespace on CRLF files (concatenated lines in antiCheat/GameContext,
  a syntax break in route.ts) — repaired via a deterministic node script
  (normalize-to-LF, replace, restore CRLF), then verified green.

---

## Resolution

- **Status:** verified (Verifier AUDIT PASS, 8/8 checks,
  2026-09-14 11:31 EDT).
- **Fix Description:** Troop Transport toggle added where
  "PRESS A KEY OR CLICK A DIRECTION" renders — full compass width,
  owner-only (GET /api/research probe), one click activates, second
  deactivates; while active every move covers 5 spaces (server-gated on
  tech ownership, step-normalized anti-cheat thresholds).
- **Advisories (non-blocking):** the ownership probe parses json() without
  a response.ok check (handled by the catch + success guard; optional
  hardening); the toggle state is client-session (refresh resets to OFF —
  FID-documented decision, no security gap).
- **Verification Evidence:** tsc exit 0, eslint exit 0, vitest 76 files /
  736 tests / 0 failures, Law 4 reachability grep receipts.

---

## Lessons Learned

1. A tech sold with a documented effect but no consumer is inert — every
   effect needs its wiring verified end to end (Law 4).
2. Anti-cheat thresholds are behavior contracts: any feature that changes
   per-action ranges must normalize them or it false-flags legitimate users.
