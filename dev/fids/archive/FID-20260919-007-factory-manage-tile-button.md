# FID-20260919-007 — Factory Manage tile button: rewire to unit-factory, mount for owners

**Status:** closed (2026-09-19, commit `a266d5f`)
**Session:** 2026-09-19 (061)
**Origin:** Operator decision on the survey-refresh recorded call: "rewire
TileRenderer's commented factory-tile button to /game/unit-factory and mount it
for owners."

## 1. Ground truth

- The commented block (TileRenderer:1040-1048) pointed at `/game/factory-management`
  — a route that never shipped (its own TODO said so). The operator-selected
  destination `/game/unit-factory` exists and is the live unit-building surface.
- The commented button referenced a `router` binding that has never existed in
  the component (the actual binding was `_router`, unused) — a naive uncomment
  would not compile.
- Ownership truth: `Factory.owner` is `string | null` holding the **username**
  (types/game.types.ts:957); live comparisons (`factoryService:367`,
  `factory/status` route:64) compare it to the username. TileRenderer's
  `player` comes from `useGameContext`; the guard
  `factoryData && factoryData.owner === player?.username` mirrors the live
  pattern and handles the ownerless-factory case (owner === null never matches).
- No test pins the button's absence (census clean).

## 2. Scope (implemented)

- Uncomment-and-repair the block as a real `nn-btn` → `router.push('/game/unit-factory')`,
  mounted only on Factory tiles for the owner; `_router` renamed to `router`.
- Collateral repair from the FID-006 corpse move: `components/index.ts` still
  re-exported the deleted chat barrel (`export * from './chat'`) — a latent
  `tsc` break that vitest could not catch (FID-006 ran tsc before the `git mv`
  landed; recorded honestly). Replaced with a direct `ChatPanel` re-export.

## 3. Out of scope

- In-tile factory management UI (produce/collect/upgrade controls live in the
  existing FactoryManagementPanel on the game page); the button is a jump, not
  a duplicate surface.

## 4. Acceptance

- tsc/eslint clean; suite green; `/game/unit-factory` route exists (verified).
- Verification is compile-level + route-existence for a client-side nav rewire —
  no browser probe claimed.


## 8. Closure (2026-09-19)

- **Shipped:** owner-only Manage Factory tile button → /game/unit-factory (uncommented, repaired: real router binding, nn-btn classes, ownership guard mirroring the live username comparison); _router renamed to router. Collateral: components barrel chat re-export repaired (direct ChatPanel export) — FID-006 residue honestly recorded in §2.
- **Gates at close:** suite 118 files / 1177 tests green, tsc 0 (post-repair), eslint clean (TileRenderer), no test pinned the button's absence.
