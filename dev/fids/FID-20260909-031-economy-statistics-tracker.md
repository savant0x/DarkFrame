# FID-20260909-031: Economy Statistics tab — complete economy tracker (replaces COMING SOON placeholder)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-031-economy-statistics-tracker.md`
**ID:** FID-20260909-031
**Severity:** MEDIUM (feature gap: the Economy tab in the in-game Statistics view is a stub)
**Status:** converged
**Created:** 2026-09-09
**Related:** FID-20260909-029 (activity logger wiring — the feed this tracker reads), docs/CHANGELOG_RP_OVERHAUL.md (RP economy), lib/db/schema/config.ts (auctions/trade_history)

---

## 1. Summary

The **Economy Statistics** tab in `StatsViewWrapper` (in-game Statistics view, third tab)
renders a "COMING SOON" placeholder. The data to populate it **already exists and is
live** — verified against the production DB:

- `trade_history`: 8 completed trades (seller, buyer, item, finalPrice, saleFee, sellerReceived, completedAt)
- `auctions`: 4 active / 8 sold (startingPrice, currentBid, buyoutPrice, listingFee, finalPrice, closedAt)
- `player_activity`: 3,611 harvests with `metadata.resourcesGained`, 754 cave_explores,
  bank_deposit/bank_withdraw flows (wired in FID-029; no rows yet but the logger emits them)
- `players`: metal/energy wallet + banked columns for system-wide supply

The tab becomes a **complete economy tracker**: market volume, price bands, fee drag,
resource flow (harvested vs banked vs traded), and top traders — all served by one
aggregation endpoint built on Drizzle SQL (no Mongo seam).

## 2. Verified data sources (production DB, probed 2026-09-09)

| Source | Shape | Verified |
|---|---|---|
| `trade_history` | sellerUsername, buyerUsername, item(jsonb), finalPrice, saleFee, sellerReceived, tradeType, completedAt | 8 rows |
| `auctions` | status, startingBid/startingPrice, currentBid, buyoutPrice, listingFee, finalPrice, winnerUsername, closedAt | 4 active/8 sold |
| `player_activity` action='harvest' | metadata.resourcesGained {metal,energy} | 3,611 rows |
| `player_activity` action='cave_explore' | metadata (item finds) | 754 rows |
| `player_activity` action='bank_deposit'/'bank_withdraw' | metadata.resourcesSpent/Gained | wired FID-029, rows pending |
| `players` | resourcesMetal, resourcesEnergy, bankMetal, bankEnergy | live |

**Perfection-loop corrections (verified against live schema):**
- `trade_history` has NO `created_at` — avgTimeToSell is computed from `auctions`
  (`closedAt - createdAt` on `status='sold'` rows), never from trade_history.
- Banked columns are `players.bank_metal` / `players.bank_energy`.

Identity: `getAuthenticatedUser()` from `@/lib/authMiddleware` (session-derived —
per FID-20260909-023; query-string identity is banned). Wrapper: the tracker is
read-only aggregate data — no user-specific rows in v1 — but the route still
requires an authenticated session (middleware family standard).

## 3. Remediation contract (what gets built)

### 3.1 Backend — `GET /api/economy/stats` (new route, Drizzle-native)

Single aggregate response, cached 60s via `getCacheOrFetch` (`CacheTTL` short family),
`ENDPOINT_RATE_LIMITS.STANDARD`, `withRequestLogging(rateLimiter(...))` wrapper:

```
{
  market: {
    totalTrades, tradesToday, trades7d,
    totalVolume,            // sum finalPrice
    volumeToday, volume7d,
    avgSalePrice, medianSalePrice,
    priceFloor, priceCeiling,
    totalFeesCollected,     // sum saleFee (sinks)
    avgFeePct,              // saleFee/finalPrice
  },
  auctions: {
    activeCount, avgCurrentBidOnActive,
    avgBuyoutPrice,         // ask side
    soldCount, avgSoldPrice, avgTimeToSellHours,   // closedAt - createdAt on sold
  },
  flow7d: {                 // player_activity aggregates, last 7 days, per day
    days: [{ date, harvestedMetal, harvestedEnergy, caveExplorations }],
    totals: { harvestedMetal, harvestedEnergy, caveExplorations },
  },
  supply: {
    walletMetal, walletEnergy,      // sum over players
    bankedMetal, bankedEnergy,      // sum banked columns
  },
  topTraders: [                     // top 5 by combined trade count, 7d→all-time
    { username, trades, volume, received }
  ],
  generatedAt: ISO
}
```

SQL: Drizzle `sum/count/avg` over `tradeHistory`, `auctions`, `playerActivity`
(`sql` extraction of `metadata->'resourcesGained'->>'metal'` jsonb path),
`players`. **No Mongo seam.** Median computed in JS over finalPrice rows
(trade count is small; ORDER BY finalPrice + percentile_cont is overkill for 8 rows
but use `percentile_cont(0.5) WITHIN GROUP` if trivially expressible in Drizzle raw).

Cache key: `economy:stats:v1`, TTL 60s. Single-flight via getCacheOrFetch.

### 3.2 Frontend — `EconomyTab` rewrite (neon noir, token primitives only)

Structure (all `.nn-*` tokens, lucide icons, zero gradients/emoji — per FID-028 rubric):

- **Header row**: `nn-sec` strip — "Economy Statistics" + generatedAt meta + refresh control.
- **Market pulse**: `nn-stat` row — Total Trades / 7d Volume / Avg Sale / Fees Collected.
- **Price band**: `nn-well` ledgers — floor → median → ceiling with `nn-chip` accents;
  active listings avg bid vs avg buyout (spread view).
- **Resource flow 7d**: per-day ledger `nn-row`s (harvested metal/energy, cave finds)
  + totals row. Bars via `nn-meter` scaled to the day max (pure CSS width, no chart lib).
- **System supply**: wallet vs banked totals, `nn-well` pairs.
- **Top traders**: `nn-row` ledger (rank accent per FID-028 LeaderboardRow convention).
- Loading = `nn-panel__body` skeleton rows (`nn-footnote` "Syncing…"); error = `nn-note`
  magenta with retry button (`nn-btn`).

Data: fetch `/api/economy/stats` on mount + manual refresh. No polling (60s server
cache + explicit refresh is enough for stats).

### 3.3 Non-goals

- No per-player personal trade history (Profile page territory).
- No live auction listings list (Auction page exists; this is aggregates only).
- No new tables/indexes — read-only over existing ones. If jsonb extraction proves
  slow at game scale, an index decision is recorded as a follow-up, not built blind.

## 4. Verification contract (perfection loop)

1. Contract tests for the route: mocked db module asserting the Drizzle shapes (auth
   required — 401 unauthenticated; aggregate shape; cache key reuse).
2. `EconomyTab` renders against a fixture payload; placeholder text gone.
3. Rubric: no banned classes, no gradients/emoji, `nn-*` only, lucide only.
4. Gates: `tsc` 0 · `eslint` 0 · full `vitest` green · `next build` exit 0.
5. Live smoke: hit the endpoint, verify real numbers (8 trades → totalTrades ≥ 8).

## 5. Implementation log

- **§3.1 Backend** — `app/api/economy/stats/route.ts`: single Drizzle-native
  aggregate over trade_history (ledger + window sums), auctions (active book,
  sold book incl. `EXTRACT(EPOCH FROM closed_at - created_at)` sell-time),
  player_activity (per-day jsonb `resourcesGained` extraction + cave counts,
  zero-filled to a continuous 7-day calendar), players (wallet/bank supply),
  top-trader ledger (seller SQL group + buyer-side merge in JS). Session auth
  (FID-023), STANDARD rate limit, 60s cache via `getCacheOrFetch`.
- **§3.2 Frontend** — `EconomyTab` in StatsViewWrapper fully rewritten:
  Market Pulse nn-stat row (trades/volume/avg sale/fees), Price Band + Active
  Book wells, 7-day resource flow with nn-meter bars + totals row, System
  Supply stats, Top Traders nn-row ledger with rank accents. Loading
  skeleton, error nn-note with retry, refresh control with updatedAt.
  Zero emoji/gradients — one pickaxe emoji slip caught by the rubric pass
  and replaced with text.
- **§4.1 Contract tests** — `__tests__/api/economy/stats.test.ts` (3):
  401 unauthenticated; full shape + derived-metric honesty (median,
  avgFeePct, zero-filled days, buyer-merge trades); cache reuse on second hit.
- **§4.5 Live smoke** — `scripts/verify-economy-agg.ts` ran the route's exact
  SQL against production: 8 trades / 1,600 volume, 4 active (avg bid 100 /
  buyout 200), 8 sold (avg 200, ~25s avg sell), 7 flow days with real
  harvest/cave data, supply 64,873 M + 58,491 E. All expressions valid —
  jsonb paths, day bucketing, epoch extract all execute against live data.

## 6. Gates

- `tsc --noEmit`: 0 errors.
- `eslint` (route + tab + test + probe): 0 problems.
- `vitest`: **416 passed / 1 skipped** (3 new contract tests).
- `next build`: exit 0, economy route present in the manifest.
- Live smoke: `ECONOMY-AGG-VERIFY-OK` (expressions + real numbers above).

## 7. Residuals & follow-ups

- Bank deposit/withdraw activity has zero rows yet (FID-029 wiring is new);
  the flow section will gain bank series once data accrues — no code change
  needed, columns already reserved in the aggregate.
- `avg_hours` on the sold book reflects the current seed data (~25s);
  it becomes meaningful as organic auctions complete.
- If trade volume grows large, revisit the JS-side median (fine at current
  scale; `percentile_cont` is the upgrade path).
