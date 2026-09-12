# FID-20260912-064–071 — UI Restoration & Economy Simulation Batch

**Date:** 2026-09-12 · **Trigger:** seven broken/placeholder surfaces reported in one pass.
**Completion loop:** every fix typechecked, linted, and (where applicable) verified live
against the running database before landing.

## FID-064 — Bank "Coming Soon!" (one-line mount bug)

The 580-line BankPanel (tabs, fee previews, MAX buttons) and all three API routes
(deposit 1k flat fee on bank tiles / withdraw / 20% exchange) were fully built — the
game page just mounted a placeholder string instead of the component. **Fix:** mount
the real `BankPanel`, delete the placeholder. Nothing else was wrong.

## FID-065 — Auction House: a museum of TODOs with four live money holes

Backend list worked, but the economy was fake:

1. **Bids were never escrowed** (`placeBid` checked metal but deducted nothing) —
   winners could be broke at settlement. **Fix:** bid deducted at placement;
   the previous leader's escrow refunds atomically on outbid.
2. **Expired auctions never settled** — the board filled with zombie listings.
   **Fix:** `settleExpiredAuctions()` engine + 5-min scheduler job
   (`auctionSettlementManager`, wired into server.ts + jobs-status panel with
   start/stop/run-now). Claim-guard (`status Active→Expired` conditional update)
   makes concurrent settlement impossible. Sold-at-hammer pays seller
   `finalPrice − saleFee` and records trade history; no-bid expiry refunds
   escrowed goods.
3. **Cancelled resource listings kept the seller's escrow** — listing fee AND
   goods lost. **Fix:** refund on cancel.
4. **Resource buyers never received goods** — `$inc: { metal: … }` resolved to no
   column in the Mongo→Postgres seam and silently dropped. **Fix:** `resources_metal`/
   `resources_energy` snake aliases (seam-resolvable), contract-tested.

**Plus (user addendum): inbox notifications.** New `auctionNotification.ts` mirrors the
battle-report delivery (SYSTEM conversation, unread bump, `metadataSystemType =
'auction_event'` marker) for: outbid, sold (seller+winner), settlement win, expired
(no-bid), and cancel refund. Contract tests: `__tests__/lib/auctionSettlement.test.ts`
(8 cases: settle-sold pays 475/500, no-bid refund, energy-key isolation, claim-lost
skip, cancel refund, bid escrow + release, no-wallet-touch on low bid, buyout delivery).

## FID-066 — Procedural item names

`lib/itemNameGenerator.ts` replaces `"COMMON Tradeable Item"` / `"Metal Digger"` with
scrapworld-flavored names: rarity-weighted material/prefix pools, tradeable
`[prefix] [material] [object] [suffix?]` and digger `[era] [material] [kind] [MK-n]`
shapes, seedable RNG for deterministic tests. Cave + forest generators consume it;
forest tradeables also gained the documented better rarity curve (was hardcoded
Uncommon). **Purity contract:** names are cosmetic — zero mechanical coupling.
Tests: determinism, 40-draw variety (no placeholder regression), no rarity-enum leak,
kind-specific digger nouns, Legendary always carries MK rev, 100k-draw 60/25/10/4/1
rarity curve.

## FID-067 — Bot-driven factory economy (the simulated world)

All 961 wild factories sat at Level 1 forever. Now the bot population IS the economy:

- **Engine** (`botFactoryEconomy.ts`): each hourly cycle, bots pay the real player
  upgrade cost (same `calculateUpgradeCost` formula) from their live stockpiles to
  raise nearby wild factories one level. Proximity radius 25, tier-based district
  caps (starter zones cap L2, endgame L9), batch ≤12/cycle, broke bots can't invest —
  scarcity makes the industrial gradient organic.
- **Seed pass:** first run writes "history" — weighted level draw per factory, paid
  by the nearest bot if it can afford the full tab (tapped-out districts stay honest).
  Marker row in `game_config` (`bot_factory_economy`) makes it once-ever.
- **Admin surface:** `/api/admin/bot-factory-economy` (GET stats + live level
  distribution, POST trigger-on-demand), jobs-status panel card with
  start/stop/run-now. **Tests** would mock the seam; the seed pass was verified
  structurally (idempotent marker, bounded batches).

## FID-068 — Map: title-bar link

`/map` had **zero navigation links anywhere** — that's why it "wasn't showing."
**Fix:** Map NavItem in TopNavBar (between Leaderboard and Stats). The full AAA
cartographic overhaul (terrain shading, labels, overlays) is scoped in
`dev/art/MAP-OVERHAUL-SPEC.md` as a dedicated follow-up — it's an art+rendering
project, not a bug.

## FID-069 — Player Rankings: math verified, centering fixed, Beer Bases added

- **The data was correct.** fame = 653,350 = (1,072,500 STR + 234,200 DEF) × 0.5
  CRITICAL multiplier — verified to the digit, same for pamtpkziq5's 9,500.
- **Centering:** header block centered; new `.nn-table--center` variant centers all
  headers/cells.
- **Beer Bases missing** (user spot-on): they're bots (`isSpecialBase=1`), excluded
  with all bots by design. **Fix:** `getTopBeerBases()` ladder (raw STR+DEF ranking),
  exposed in `/api/leaderboard` (`beerBases[]`) and rendered as its own
  🍺 Beer Base Rankings table with level/STR/DEF/total power. (Live count is
  currently 1 — the weekly respawn job replenishes.)

## FID-070 — Statistics tracking: the A-Z audit

Root causes found for "Units Built = 0":

1. **Two build paths, one tracker.** `/api/factory/build-unit` called
   `trackUnitBuilt`; the unit-factory page's live path `/api/player/build-unit`
   never did. **Fix:** tracker wired (non-fatal try/catch).
2. **Migration bypass.** FID-033's catalog migration rebuilt 10.7K legacy units
   directly in SQL, bypassing all counters. **Fix:** migration **0027**
   `units_built_backfill` raises every player's counter to army truth (never
   lowers) — **applied live: 54 players corrected** (fame 0→10,725,
   Warden_Rage→134,081, Silent_Citadel→27,422, …).
3. **`totalBattles`/`totalTerritories` were hardcoded 0** (TODO in `/api/stats`).
   **Fix:** real `countDocuments` from `battle_logs` (17) and occupied-base tiles.
4. Plumbing verified end-to-end: the seam's jsonb dot-path `$inc` lands
   (`stats.totalUnitsBuilt` +3/−3 live round-trip), achievements chain intact.
   Existing wired trackers confirmed: harvest→gathered+caves, deposit→banked,
   shrine→trades, combat→battlesWon, factory→units.

## FID-071 — Clan quick-create

The `CreateClanModal` (name/tag/description, cost preview, live name-availability
check) existed and worked — nothing mounted it, so players had **no create path
anywhere**. **Fix:** "Create Clan" button on the clans page header + empty-state CTA,
`CreateClanModal` dynamically imported (no SSR), `onSuccess` refreshes the
leaderboard. Design pass against `docs/COMPLETE_CLAN_SYSTEM_PLAN.md`: creation
contract (name+tag+cost) already aligned post-FID-028; join/promote/war surfaces
intact.

## Gates

tsc 0 · eslint 0 per file · all new test files green (auctionSettlement 8/8,
itemNameGenerator 6/6, autoFarmPosition 5/5) · full suite + build in the landing PR.
