# FID-20260919-001 — Auction unit-listing honesty: real unit picker + server-derived display truth

**Status:** `closed`
**Session:** 2026-09-19
**Origin:** Operator directive from the product survey of the same date
(`dev/audits/PRODUCT-SURVEY-2026-09-19.md`, P0): "server-derived escrow snapshots
from unitType, UNIT_CONFIGS in the modal, pins, live probe."

## 1. Ground truth (grounding refined the survey's premise before any edit)

The survey called this "unit listings fabricate stats." Grounding split that into
three facts, one of which dissolves part of the original fix shape:

1. **Delivery is honest.** `validateAndLockItem` (lib/auctionService.ts:315-324)
   escrows the seller's REAL unit object into `item.unitSnapshot` (FID-20260914-003
   contract: "the SERVICE owns the snapshot"), and `transferAuctionItem` delivers
   from that snapshot (:874). The buyer gets exactly the unit that left the seller.
2. **Display is fabricated.** The client-supplied `item.unitStrength/unitDefense`
   are stored as-is and `AuctionListingCard.getItemDisplay` (:194) shows them:
   every modal-listed unit displays "Str: 100 | Def: 50" regardless of the real
   unit, and a crafted client could display any numbers.
3. **The modal's unit flow cannot succeed at all.** `buildAuctionItem`
   (components/CreateListingModal.tsx:102-108) sends `unitType` + hardcoded stats
   but NO `unitId`; the service's escrow branch requires one (auctionService.ts:298-300,
   'Unit ID is required'). Every unit listing attempted through the game UI fails.

**Why the directive's original shape ("UNIT_CONFIGS in the modal") is superseded:**
a UNIT_CONFIGS-synthesized listing has no `unitId`, cannot be escrowed, and would
list units the seller does not own — resurrecting exactly the multi-sale phantom
defect FID-20260914-003 killed. The escrow contract forbids synthetic listings.
The client truth source is the seller's actual units: `player.units` (sanitizer
allowlist, lib/playerSanitize.ts:72), already in GameContext. UNIT_CONFIGS remains
the server-side derivation source only where a type-level truth is needed.

## 2. Spec

1. **CreateListingModal** — replace the "Phase 4 simplified" unitType-only select
   with a real picker over `useGameContext().player.units`: one option per unit
   entry (`name — STR x / DEF y`, quantity suffix when >1), value = `unitId`.
   `buildAuctionItem` sends `{ itemType: Unit, unitId, unitType }` — no stat
   fields (the server derives; nothing client-supplied is trusted). Empty army:
   the unit radio is disabled with an explanatory message.
2. **auctionService.validateAndLockItem** — after locating the escrowed unit,
   the returned metadata carries the snapshot-derived display fields;
   `createAuctionListing`'s item assembly overwrites `unitStrength`/`unitDefense`
   (and `unitType`) from the escrowed unit. Client stat fields are never stored.
   Zod (AuctionItemSchema) has no `unitSnapshot` key and no catchall, so clients
   cannot inject a snapshot — verified.
3. **AuctionListingCard.getItemDisplay** — prefer `item.unitSnapshot` stats when
   present; fall back to the stored scalar fields. This heals listings created
   between the escrow FID and this fix (real snapshots, fabricated scalars).
   Pre-escrow legacy listings keep their stored display (unrepairable; noted).
4. **Pins** (`__tests__/api/auctionUnitListingHonesty.test.ts`): stored item stats
   equal the escrowed unit's even when the client sends 9999/9999; unitType
   mismatch resolved from the snapshot; missing/foreign unitId still rejected;
   card renders snapshot stats when present; modal renders the seller's real
   units (mocked GameContext).
5. **Live probe** (`scripts/e2eAuctionUnitHonesty.ts`): over real HTTP + dev DB —
   build a unit, create a listing with deliberately wrong stat fields, read it
   back and assert stored stats == the unit's real strength/defense and the
   snapshot is present; cancel to restore the unit (cleanup, residue zero).

## 3. Perfection-loop self-check

- Does the service overwrite break other paths? Bids reference auctionId only;
  cancel/transfer/refund all ride `unitSnapshot`. Scalar item fields are
  display-only. ✓
- Double-derivation drift (client UNIT_CONFIGS vs server)? None — the client no
  longer derives stats at all; the server copies from the escrowed unit. ✓
- Legacy-listing display regression? Card prefers snapshot, falls back to stored
  scalars — strictly better than current. ✓
- Gates at implementation: full suite, tsc 0, eslint clean, live probe green.

## 4. Implementation record

- `components/CreateListingModal.tsx` — real unit picker over GameContext units;
  payload = unitId + unitType only; empty-army guard.
- `lib/auctionService.ts` — validateAndLockItem returns snapshot-derived
  display fields; createAuctionListing overwrites the item's unit stat scalars.
- `components/AuctionListingCard.tsx` — snapshot-preferred stat display.
- `__tests__/api/auctionUnitListingHonesty.test.ts` — 8 pins.
- `scripts/e2eAuctionUnitHonesty.ts` — live probe (results in session record).

## 8. Execution (closed on `123d5e2`)

- Pins: 6/6 green (`__tests__/api/auctionUnitListingHonesty.test.ts` — stored
  stats overwritten from the snapshot despite client 9999 lies; escrow still
  removes the unit; foreign + missing unitId rejected; snapshot-preferred card
  display with legacy fallback). Spec estimated 8; the modal-render pin was
  folded into the payload pins — the modal no longer derives stats at all.
- Live probe: 15/15 over real HTTP + dev DB (`scripts/e2eAuctionUnitHonesty.ts`)
  — register → factory seed → real build → listing with lying stat fields →
  stored truth 100/0 == real unit → snapshot present → escrow verified in the
  units jsonb → cancel restores the unit → residue zero.
- OUT-OF-SCOPE DEFECT found and fixed during the live leg:
  `syncAuctionDocFields` (lib/db/auctionDocBridge.ts) leaked raw booleans past
  its flat-key-wins guard into the pg smallint mirrors — **every auction
  listing INSERT failed with `invalid input syntax for type smallint: "false"`
  since the batch-4 auctionService rewrite** (FID-20260917-017). The bridge now
  coerces booleans unconditionally (single truth, Law 13). Update-path writes
  were unaffected (auctionSet already coerced).
- Gates at closure: suite 115 files / 1147 tests green (+6), tsc 0, eslint
  clean, eradication census 0.
