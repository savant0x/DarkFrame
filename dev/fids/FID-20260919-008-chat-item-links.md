# FID-20260919-008 — Chat item linking on the live renderer + auction name-search and deep-link

**Status:** `created`
**Session:** 2026-09-19 (062)
**Origin:** Recorded product call (FID-20260919-006 §3): chat item linking was
never live — the machinery existed only in the archived ChatMessage corpse —
and clicks had nowhere useful to land.

## 1. Ground truth

1. **The "existing validation route" validates nothing.** Its engine,
   `chatService.validateItem` (chatService.ts:246), is a stub: `TODO: Implement
   when items table is added to schema` → `return false`. The corpse's
   client-side fetch/cache would have classified every item invalid. The route
   `/api/chat/item-link` itself is honest plumbing (public, GET, `{exists}`).
2. **The item universe is units + resources — that is the whole catalog.** There
   is no items table; the auction card renders tradeable listings as the literal
   string "Tradeable Item" (AuctionListingCard:205). Real, player-meaningful
   names: every `UnitType` in UNIT_CONFIGS (as listed, e.g. T1_SCOUT) and
   `ResourceType` METAL/ENERGY (as stored in `item.resourceType`).
3. **Where names live server-side:** `auctions.item_data` jsonb (`doc->'item'`
   in the service's own filter SQL — getAuctions already queries
   `doc->'item'->>'itemType'` etc.). `getAuctions` has unitType/resourceType
   filters but **no name filter**; the route accepts no `name` param;
   AuctionHousePanel has no search box.
4. **Deep-link destination:** the auction house is a game-page modal
   (`showAuctionHouse`), not a route. A chat click must therefore navigate to
   `/game?market=<item>` and the panel must consume the param on mount.
5. **Renderer:** ChatPanel's `renderMessageContent` splits @mention markup, then
   Linkify. Item parsing slots into the plain-text branch.
6. Precedent check corrected: the game page does **not** read query params today
   (clanId flows as a prop, not a URL param — an earlier draft of this section
   claimed otherwise). `useSearchParams` must be added fresh for the deep-link.

## 2. Scope

- **`lib/catalogService.ts` (new, pure, pinned):** `ITEM_CATALOG` built from
  UNIT_CONFIGS + ResourceType; `validateItem(name)` — case-insensitive catalog
  match; `ITEM_CATALOG_NAMES`. `chatService.validateItem` rewritten to delegate
  (the TODO stub dies; the item-link route becomes truthful without changes).
- **`lib/chatItemLinks.ts` (new, pure, pinned):** bracket regex
  `/\[([^\[\]\n]{1,64})\]/g` (no nesting/newlines, bounded), segment parser, and
  `resolveItemLink` (valid → catalog type; invalid → plain text). Links render
  in **all** channels — only catalog-valid names become links, so no spam
  surface; the corpse's TRADE-only restriction was arbitrary.
- **ChatPanel:** plain-text parts render item segments as buttons →
  `router.push('/game?market=<name>')`; invalid brackets stay literal text.
- **Auction deep-link:** `/api/auction/list` accepts `name` (trimmed, ≤64,
  `%`/`_` stripped) → `filters.name`; `getAuctions` adds
  `(doc->'item'->>'unitType' ILIKE %n% OR doc->'item'->>'resourceType' ILIKE %n%)`.
  AuctionHousePanel: name-search input (ref-fed to avoid keystroke refetches;
  Apply/tab/page refetch reads it) + `useSearchParams` mount deep-link that
  pre-sets the name, switches view to marketplace, and picks the category tab
  (unit → units, resource → resources, else all).

## 3. Out of scope

- A dedicated item-details modal; tradeable-item naming (no items table exists —
  recorded, not assumed fixable).
- Server-side link rewriting at message send time (parse stays render-side, like
  the corpse's design and the mention markup's).

## 4. Acceptance

- `[T1_SCOUT]` and `[metal]` in a chat message render as links (case-insensitive);
  `[notarealitem]` stays text; clicking navigates to `/game?market=<name>`.
- `/api/auction/list?name=METAL` filters live listings; the panel opens
  pre-filtered from the `market` param with the right category tab.
- Pins green for the pure modules; live HTTP check on the name filter; gates green.
