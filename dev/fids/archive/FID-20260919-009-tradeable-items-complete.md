# FID-20260919-009 — Tradeable items, complete: escrowed instance trading with real names

**Status:** `loop-complete (design presented + decisions D1b/D2/build received; implemented and live-verified same session)`
**Session:** 2026-09-19 (064)
**Origin:** Operator directive: "Design the items table FID: a persisted items
catalog that gives tradeable listings real names, makes them chat-linkable, and
retires the 'Tradeable Item' placeholder — design-first, present before building."

## 1. Ground truth (why "items table" is the wrong shape)

1. **Tradeable listings are blocked at the front door.** `createAuctionListing`
   refuses `TradeableItem` (`TRADEABLE_NOT_TRADEABLE_YET`, auctionService:361-370)
   because `transferAuctionItem`'s tradeable branch is an **empty TODO**
   (auctionService:801-804) — FID-20260914-003 gated creation after finding
   buyers paid fees and received nothing. Naming listings without lifting this
   gate would name a flow no one can use.
2. **There is no fixed item catalog to persist.** Tradeable items are
   *unique instances*: `InventoryItem` (types/game.types.ts:668) carries a
   **procedurally generated name** (`generateTradeableItemName(rarity)`,
   FID-20260912-066), rarity, id — minted per cave-harvest (caveItemService:111-115)
   and consumed at the Shrine for boost duration by rarity
   (shrine/activate:170-179 filters by consumed id). A static `items` table would
   not describe this universe; the instance *already is* the persisted record
   (`players.inventoryItems` jsonb).
3. **The correct pattern already exists in this codebase**: unit escrow
   (FID-20260914-003) — snapshot frozen into the listing at creation, instance
   removed from the seller, returned on cancel/expire, delivered on settlement.

## 2. Design

### 2.1 Identity & escrow (the core)

- `AuctionItem` (tradeable) extended with an **instance snapshot**:
  `{ itemId, name, rarity, description }` alongside `tradeableItemQuantity: 1`.
- `createAuctionListing` (tradeable branch): locate the item in the seller's
  inventory by id (owner-derived, like the unit flow), atomically **remove it
  from `inventoryItems`** (real escrow — prevents double-sale and
  sell-while-at-shrine), freeze the snapshot into `itemData`.
- `transferAuctionItem` (tradeable branch — the empty TODO): append the
  snapshot as a new `InventoryItem` to the buyer's inventory (new instance id,
  preserved name/rarity/description, `foundDate = settlement`).
- Refund paths (cancel-before-bid, expire-no-bid): re-append the instance to
  the seller. Mirrors the unit-escrow return.
- Shrine interplay comes free: escrowed items are out of `inventoryItems`, so
  they cannot be consumed while listed — same law as escrowed units not fighting.

### 2.2 Naming (the directive's "real names")

- `AuctionListingCard`: tradeables display the snapshot name + rarity chip
  (amber/magenta by rarity tier) — the "Tradeable Item" placeholder retires.
- `getAuctions` name filter: extend the existing ILIKE OR-chain with
  `doc->'item'->>'name'`, so procedural names are searchable in the panel.
- **No migration needed**: the creation gate means zero tradeable listings exist;
  the type extension is purely additive.

### 2.3 Chat-linkability (decision D1)

Procedural names cannot be validated against the static catalog
(`lib/catalogService`). Options:

- **D1a — Search-only (smallest):** tradeables are reachable via the panel's
  name search; chat `[name]` links stay static-catalog. No new client fetching.
- **D1b — Async existence validation (recommended):** when a bracketed name is
  not in the static catalog, ChatPanel resolves it against live listings
  (`/api/auction/list?name=<n>&limit=1`, `totalCount > 0`), cached per session
  (the corpse's cache pattern, now against real data). Valid → deep-link
  `/game?market=<name>`; the game-page opener already opens the panel for any
  param (catalog-valid fast-path, this adds the listing-backed path); the panel
  filters and shows the listing or an honest empty state. One fetch per unknown
  name per session; invalid stays literal text.

### 2.4 Stacking (decision D2)

- **D2a — one instance per listing (recommended):** matches item reality
  (each instance unique), zero partial-stack math, escrow/return trivially
  correct. The modal lists one item per listing.
- **D2b — stack quantity:** `quantity`-based partial escrow inside a stacked
  jsonb entry; more surface, no live demand (no stacking writer exists today —
  probe: no `quantity` writers outside the type).

### 2.5 UI flow

- `CreateListingModal`: real tradeable picker over the seller's actual inventory
  (`type === TRADEABLE_ITEM`), showing name + rarity; stat-free (rarity is the
  value signal, shrine duration table is public). Post-listing player refresh.
- Seller protection mirrors the unit flow: only unescrowed, in-inventory items
  are listable.

## 3. Scope (implementation, post-approval)

Service seams (create/transfer/refund), AuctionItem type extension, card +
modal UI, name-filter extension, D1 chat resolution (per D1 decision), pins for
escrow invariants (remove-on-list / deliver-on-sale / return-on-cancel / no
double-list), live probe: list → item gone from seller → name-search finds it →
cancel → item returned (and, if D2a, the settlement delivery pinned at service
level with a two-player HTTP probe).

## 8. Closure (2026-09-19)

- **Shipped:** lib/tradeableEscrow (pure escrow planner: whole-instance selection by seller-chosen ids, no-partial-escrow failure, delivery/refund builders) pinned 9/9; createAuctionListing's prohibition lifted — tradeable listings now ESCROW (seller inventory rewritten without the instances; server-derived per-instance snapshot: itemId/name/rarity/description/type/bonusPercent/foundAt/foundDate); transferAuctionItem's empty-TODO branch replaced with snapshot-driven delivery (fresh instance ids, identities preserved) and refund on cancel/expire/settlement-failure via buildRefundInstances (snapshot itemId → original instance id); CreateAuctionSchema + AuctionItem carry tradeableItemQuantity/tradeableItemIds/tradeableSnapshot; CreateListingModal tradeable picker (enabled, instance multi-select with name+rarity, quantity, cap 20) with real names on AuctionListingCard; auction name-search + chat deep-links accept live-listing names (catalog OR listings check in the game-page opener); chat item links resolve verified tradeable names to market deep-links with tab mapping.
- **Two real defects caught by the live probe before landing:** the escrow snapshot dropped type/bonusPercent/foundAt (delivered rows were typeless — every type-filtering consumer broken) and refunds spread snapshot entries verbatim, minting id-less inventory rows (itemId was never mapped back to id). Both fixed at the source (snapshot completeness + refund mapping) and pinned.
- **Pins:** 9 (__tests__/lib/tradeableEscrow.test.ts) + 1 rewritten honestly (auctionSettlement's TRADEABLE_NOT_TRADEABLE_YET pin codified the prohibition this FID lifts; its real invariant — rejection before any lock or fee — now pinned via the escrow gate's ITEMS_NOT_FOUND path).
- **Live probe:** 14/14 (scripts/e2eTradeableAuctionLive.ts vs tsx server.ts:3003) — premise/mint, quantity-2 escrow (3→1), findable by real procedural name, wire carries per-instance real names, placeholder census zero, buyout → 2 full instances with fresh ids, listing consumed, cancel → original instance id back, empty-escrow no-ghost. Probe-side corrections (3): wire shape (itemData.tradeableSnapshot array), inventory reads (players.inventory_items jsonb, no table), id extraction (auction.auctionId). The code needed the two snapshot fixes; the rest was the probe learning the real contracts.
- **Gates at close:** suite 1200/1200 green (+9 pins, 1 rewritten), tsc 0, eslint clean (all touched files).

## 4. Acceptance

- A player can list a cave-found item by its real name; while listed it is not
  in their inventory (not shrine-consumable, not double-listable); the buyer
  receives the named item; cancel/expire returns it; the card and search speak
  the real name everywhere; chat links per D1.
