# FID-20260917-008 — /api/player/inventory: Mongo-era route migrated to pg

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-17 (048)
**Origin:** Operator directive after the clan-UI live verification (session 046)
surfaced the route's 401s in the network log while every other authenticated call
rode 200.

## 1. Goal

`GET /api/player/inventory` — the endpoint `InventoryPanel` fetches on every game
load — is a Mongo-era fossil that survived the pg pivot on the Mongo stack:

- **Dead auth:** it reads a `playerId` cookie that nothing in the app sets
  anymore (auth moved to the `darkframe_session` JWT in FID-20251017-004's
  consolidated model). Every call since the pivot has 401'd.
- **Dead DB:** it queries `clientPromise`/`db.collection('players')` — the
  MongoDB driver the pivot replaced. Even with a valid session it would read a
  database that is no longer the game's source of truth.
- **Silent failure:** `InventoryPanel` guards with `if (response.ok)`, so the
  401 collapsed into an eternally-empty inventory with zero console noise.

This is the row-#24 Mongo-shim disease in its first *client-facing* instance —
every catalogued row-#24 item so far was service-layer.

## 2. Evidence (RED, all verified in context)

- Live network log (session 046, preview browser): repeated
  `GET /api/player/inventory → 401` while `/api/clan/[id]`, `/api/research`,
  `/api/wmd/status` etc. rode 200 with the same session.
- Route source (`git show bb34e34:app/api/player/inventory/route.ts`): cookie
  `playerId` + `clientPromise` — confirmed both defects at line level.
- The pg schema carries the inventory the route should serve:
  `players.inventory_items` (jsonb, NOT NULL, default `[]` — physically holds
  the mixed `InventoryItem | TutorialInventoryItem | Unit` array),
  `inventory_capacity` (default 2000), `inventory_{metal,energy}_digger_count`,
  `gathering_bonus_{metal,energy}_bonus` (numeric), `active_boosts_*`.
- **Premise probe (live dev DB, player `fame`):** 47 items, cap 2000, diggers
  25+23, bonuses "39.00"/"37.00" — matching the 39%/37% gathering figures the
  operator's own screenshot shows in the harvest calculator. The data has been
  in pg all along; only the route was dead.

## 3. Loop

- **Convergence check:** the fix is a mechanical contract translation, not a
  design debate. Sole consumer, fixed wire shape, schema already present.
  No Open questions — loop to loop-complete directly.
- **Contract derivation (from the consumer, not the old route):**
  `components/InventoryPanel.tsx:180` does `setInventory(data)` directly →
  the payload must be the **UNWRAPPED** `InventoryData`:
  `{ capacity, items, gatheringBonus: {metalBonus, energyBonus},
  metalDiggerCount, energyDiggerCount, activeBoosts: {gatheringBoost,
  expiresAt} }`. `expiresAt` feeds `new Date(...)` → must ship as an ISO
  **string**. The old route's `resources`/`equipment` fields are consumed by
  no client and are not reconstructed (dead-twin doctrine: no speculative
  surface).
- **Decision — mixed jsonb rides unfiltered:** `inventoryItems` physically
  holds `InventoryItem | TutorialInventoryItem | Unit` entries (schema comment;
  `factoryService.ts:234` documents the `isUnitEntry` discriminator). The panel's
  own filters (`type: 'diggers' | 'tradeable'`) simply never match Unit entries,
  so the read path ships the array as-is — consistent with how
  `battleService.ts:1343` already passes the column through. Narrowing is the
  write/consumption paths' job, not this read's.
- **Decision — auth failure code:** `requireAuth`'s refusal (401) passes
  through untouched. The only reachable not-found is a mid-session row
  deletion race → `AUTH_USER_NOT_FOUND` (maps to 401 in the house status map —
  `RESOURCE_NOT_FOUND` maps to 400 and is semantically wrong for a session
  subject).

## 4. Implementation (GREEN)

`app/api/player/inventory/route.ts` rewritten: `requireAuth` (darkframe_session)
→ `db.select` of exactly the eight inventory columns off
`eq(players.username, auth.playerId)` → contract translation:

- `gatheringBonus.*` / `activeBoosts.gatheringBoost`: pg `numeric` → `parseFloat`
  (pg returns strings; the panel does arithmetic + renders percentages).
- `activeBoosts.expiresAt`: `Date → toISOString()` or null (client pins wire
  format via `new Date(...)`).
- `items`: the jsonb array as-is (mixed-entry rationale above).
- House error envelopes on both failure paths; `withRequestLogging` wrapper
  retained.

## 5. Verification

- **Pins (5)** — `__tests__/api/playerInventory.test.ts`: auth pass-through
  (rejection object returned untouched, no DB hit); EXACT unwrapped contract
  with numeric-string parsing (39.00→39) and mixed jsonb riding through;
  `expiresAt` ISO-string serialization; row-deletion race → 401
  `AUTH_USER_NOT_FOUND` envelope; DB failure → 500 `INTERNAL_ERROR` envelope.
  Real error-envelope helpers throughout; only `requireAuth` + the `db` handle
  mocked. Test-authoring lesson recorded: `@/lib/db/schema` must stay REAL in
  mocks — the `@/lib` barrel re-exports it, so a full-replace mock starves the
  barrel of unrelated tables (`userPresence`) and breaks imports.
- **LIVE probe 3/3, exit 0** — `scripts/e2ePlayerInventory.ts` against the real
  dev DB: PREMISE (47 items / 2000 / 25+23 / 39.00·37.00), AUTH (cookie-less →
  401 envelope; observed live shape `{ success:false, error:"Unauthorized" }`
  — string error, driver assertion updated to the observed truth), CONTRACT
  (cookie → 200, exact six keys, items=47, bonuses parsed to 39/37, boost
  null@null). Read-only driver; explicit `process.exit` (FID-009 lesson).
- **Live server confirmation** — the running dev server (:3000) hot-reloaded
  the route: curl with a real minted cookie → **HTTP 200** with the full
  contract; cookie-less → 401. (Session 046's verification showed the same
  route 401-ing for the operator's own browser.)
- **Full gates:** tsc 0 · eslint 0 (all three paths) · vitest **1004+1skip**
  (999 → 1004, the 5 new pins).

## 6. Loop record

Filed and implemented in the same session on operator directive (the pattern
ratified for FID-20260917-007). Contract derived from the sole consumer;
schema present; premise proven live before implementation. No open questions
remained at implementation time. Status: **loop-complete**.

## 7. Notes

- The client's silent-skip guard (`if (response.ok)`) is why this defect lived
  through at least two full sessions of play without a whisper. The same
  pattern still hides failures in other panels (TopNavBar/StatsPanel hid the
  FID-006 twins the same way). A follow-up FID could add a dev-mode console
  warn on non-ok inventory/clan-family fetches — filed as an idea, not
  implemented here.
- Row #24 (Mongo shim residuals) remains open at the service layer; this fix
  retires its most visible member. The remaining `clientPromise` importers
  (`lib/mongodb` consumers) are next in line for the same treatment.

## 8. Closure

- **Gates:** [x] 5 pins green · [x] live probe 3/3 exit 0 · [x] live server 200
  with real cookie · [x] tsc 0 · [x] eslint 0 · [x] vitest 1004+1skip
- **Commit hash (G2):** `90f7f5f` (implementation batch; closure batch fills row 83's disposition).
- **Post-commit:** FID archived; SCOPE row 83 → Closed (in-place substitution);
  CHANGELOG entry; VERSION bump.
