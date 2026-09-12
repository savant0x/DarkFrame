# FID-20260912-077 — Bearer-restriction parity audit + real-reason surfaces

**Date:** 2026-09-12
**Request:** "Audit all flag-bearer restrictions across the API and give each blocked UI surface the same real-reason treatment the unit factory got."

## 1. Audit map

Enforcement lives in `lib/flagBonusService.ts`:
`HOLDER_RESTRICTIONS` — 9 actions blocked while holding the Flag:
`build-unit`, `upgrade-unit`, `factory-produce`, `factory-capture`,
`auction-create`, `auction-bid`, `auction-buyout`, `bank-deposit`,
`bank-withdraw`. Every gated route returns **403 `{ success:false, … reason }`**
via `assertHolderMayTransact(stack, action)`.

| Action | Route | Gate present before audit | UI surface | Error treatment before |
|---|---|---|---|---|
| build-unit | `/api/player/build-unit` | ✅ | unit-factory page | ✅ real reason (FID-075) |
| build-unit | `/api/factory/build-unit` | ❌ **MISSING** | UnitBuildPanelEnhanced | ❌ `data.error` raw / generic catch |
| upgrade-unit | `/api/player/upgrade-unit` | ✅ | (no UI caller — legacy) | n/a |
| factory-produce | `/api/factory/produce` | ✅ | (no UI caller — legacy) | n/a |
| factory-capture | `/api/factory/attack` | ✅ | game page tile attack | ✅ extractApiError (FID-041) |
| auction-create | `/api/auction/create` | ✅ | CreateListingModal | ✅ extractApiError inline |
| auction-bid / buyout | `/api/auction/bid`, `/buyout` | ✅ | AuctionListingCard | ✅ extractApiError inline |
| bank-deposit / withdraw | `/api/bank/*` | ✅ | BankPanel | ✅ extractApiError toast |

**Enforcement hole found:** `HOLDER_RESTRICTIONS` says `build-unit` is blocked,
the bearer's own FlagTrackerPanel says "unit building … disabled", and
`/api/player/build-unit` enforces it — but `/api/factory/build-unit` (the
in-game factory build panel's actual endpoint) **never implemented the gate**.
A bearer could build units at factories while the UI told them they couldn't.
Doc/UX/enforcement disagreed; enforcement was the liar's opposite — the gap.

## 2. Changes

1. **Gate parity** — `app/api/factory/build-unit` now runs
   `assertHolderMayTransact(stack, 'build-unit')` right after input validation,
   same 403 shape as every other gate, before any write.
2. **`hooks/useBearerStatus.ts`** (new) — client-side bearer awareness:
   polls `/api/flag` (60s + focus refetch), exposes `isBearer` +
   `holderUsername`. Barrels through `hooks/index.ts`.
3. **Proactive surfaces** — each blocked panel now *shows the restriction
   before the form is filled*, instead of a post-hoc 403:
   - **BankPanel**: amber banner (banking locked, ×2 harvest note) + submit
     disabled with tooltip.
   - **AuctionHousePanel**: banner under the toolbar (create/bid/buyout locked).
   - **FactoryManagementPanel**: banner (produce/build locked; upgrades and
     slot management stay available).
   - **UnitBuildPanelEnhanced**: banner + every Build button disabled w/ tooltip.
   - **unit-factory page**: Confirm Build disabled while bearer; POST error now
     reads `data.error || data.message` (the bearer gate 403s via `message`).

Reactive treatment (extractApiError / real-reason rendering) was already
shipped by FID-20260911-041 and FID-075 for most of these surfaces; this FID
completes the matrix and closes the two gaps (build-unit enforcement, and the
unit-factory build path's `message`-shaped rejection).

## 3. Tests

- `__tests__/api/factory/buildUnitBearerGate.test.ts` (new, 3): bearer blocked
  403 with real reason *before any write*; non-bearer passes to the build path;
  `HOLDER_RESTRICTIONS` ∋ 'build-unit' (docs/enforcement parity pin).
- `build-unit-units-shape.test.ts`: mocked the gate (non-bearer) — write-shape
  tests unchanged and green.

## 4. Gates

tsc 0 · eslint 0 · vitest **584** (3 new) · build exit 0.

## 5. Explicitly out of scope

- `/api/player/upgrade-unit` and `/api/factory/produce` have no remaining UI
  callers (legacy); their gates are correct server-side. Removal is a separate
  cleanup FID if desired.
- `FactoryButton.tsx` is exported but unmounted (dead); not touched.
