# FID-20260917-017 — Cluster B batch 3 scope: complete shim decomposition (enumeration + sizing)

**Status:** `scoped — awaiting operator batch selection`
**Session:** 2026-09-17 (059)
**Origin:** Operator directive: "Scope Cluster B batch 3: enumerate the remaining getCollection/getDatabase/connectToDatabase routes, size each rewrite, and file the FID."

## 1. Method (ground-truth sweep, no census reuse)

Three import surfaces swept fresh this session (the session-056 audit tracked only one):

1. **`@/lib/mongodb` direct imports** (app + lib): 33 files (29 routes + 4 lib modules).
2. **Relative `./mongodb` imports inside lib/**: **17 additional services** the audit never
   counted — `achievementService, auctionService, beerBaseAnalytics, beerBaseService,
   botCombatService, botFactoryEconomy, botFactoryRaid, botGrowthEngine, botScannerService,
   cacheWarming, combatPowerService, dailyLoginService, discoveryService, index (re-export),
   mapGeneration, movementService, statTrackingService, tierUnlockService`.
3. **Barrel re-exports** (`lib/index.ts:18 export * from './mongodb'`): surfaces shim
   symbols on `@/lib`; one consumer found (`clan/invite`).

## 2. Classification with sizes

### A. Dead routes — delete, no rewrite (2)
| File | Evidence |
|---|---|
| `app/api/inventory/route.ts` | Zero client callers (the real inventory UI rides `/api/player/inventory`, repaired in FID-008). Legacy `?username=` GET. |
| `app/api/debug/tile/route.ts` | Zero client callers anywhere; debug-era remnant. |

### B. Connection theater — import + unused client removed (2)
| File | Evidence |
|---|---|
| `app/api/harvest/route.ts` | `getCollection('players')` position-read only; FID-20260911-046 comment documents the projection; `getPlayerSlim` exists and is used for exactly this shape by movement. |
| `app/api/move/route.ts` | Same pre-move `findOne({username})` position-read; rest of route rides pg services. |

### C. Chat presence family — conversion to direct drizzle (3)
| File | Notes |
|---|---|
| `chat/heartbeat` | Writes `user_presence` (real pg table, config.ts:236). Upsert keyed (channelId, userId). |
| `chat/online` | Reads `user_presence` by `lastSeen >= threshold`. |
| `chat/typing` | Upserts `typing_indicators` (config.ts:226). Same upsert shape ×2. |

### D. Trivial player reads/writes — direct drizzle (5)
| File | Notes |
|---|---|
| `player/stats` | One projection read; map `stats` jsonb → wire shape. |
| `player/greeting` | One update; `baseGreeting` column exists (players.ts:55). |
| `player/profile` | Full `getPlayer(includePrivate)` + existing domain shape (FID-014 verified the shape the client consumes). |
| `clan/invite` | One `findOne` (target player) then pg service; theater-squared — remove the client, use `getPlayerSlim`. |
| `cron/player-snapshot` | `find` active players by `lastLoginDate >= 30d` → `capturePlayerSnapshot`. One drizzle select. |

### E. Read-mostly conversions — direct drizzle, shape-preserving (7)
| File | Ops | Notes |
|---|---|---|
| `admin/achievement-stats` | 3 | `playerAchievements`→`achievements` (alias real, config.ts:101) + players. |
| `admin/active-sessions` | 2 | `player_sessions` (config.ts). |
| `admin/bot-factory-economy` | 2 | factories + players. |
| `auction/my-bids` | 2 | auctions (real table; the shim has dedicated auction doc-sync). |
| `clan/leaderboard` | 2 | clans + players, `AggregateStage` type import. |
| `shrine/activate` | 2 | players read/write; then shrineServer. |
| `shrine/boost-all` | 2 | players read/write; then shrineServer. |

### F. Real rewrites — schema-mapping decisions required (3)
| File | Ops | Decisions needed |
|---|---|---|
| `factory/upgrade` | 7 | slots/costs, investedMetal/Energy deltas (FID-016 pattern), level math. |
| `factory/abandon` | 3 | ownership clear, tile/factory interplay. |
| `factory/list` | 3 | projection shape for the factory UI. |
| (`factory/release`, `factory/status`, `factory/build-unit` are 1–4 ops; batch with the above for coherence → 6 factory routes total.) | | |

### G. The 813-line anti-cheat detector — **the load-bearing find** (1 file, `lib/antiCheatDetector.ts`)
Every detection family queries `playerActivity` by `username` + `actionType` — **neither
is a pg column** (`player_activity` has `player_id`, `action`). The shim's `buildWhere`
**skips unmapped keys** (lib/mongodb.ts:362-368), so every detector query silently filters
on timestamp only. **The detector has been analyzing every player's aggregated activity
instead of the suspect's** since the pivot — speed-hack, resource-magnitude, and
pattern detection are all noise. This is a correctness rewrite (map keys at every query
site), not a mechanical conversion: ~10 query sites + flag upsert + achievement/flag
joins. Highest priority in the batch.

### H. rankingService (lib, 12 ops across 5 functions)
Powers `/api/leaderboard`, `/api/stats`, `app/leaderboard/page`, `LeaderboardPanel`.
`getTopBeerBases`, `getTopPlayers` (players+factories), `getPlayerRank`, `getPlayerRankData`,
`getTotalPlayerCount`. Rewrite = SQL window/order-by equivalents of the current fetch-then-sort.

### I. Active scope items awaiting operator batch selection

*(Amendment 2026-09-18, operator-approved — supersedes the prior "Deliberate deferrals"
heading, which was an agent-granted exclusion in violation of Law 2 / the Scope Boundary
section: the `deferred` status is Operator-only, and the items were never presented as a
blocking step nor entered in SCOPE.md. They are now recorded as SCOPE.md out-of-scope row
#96 and stand as active work items pending the operator's batch decision.)*

- **17 relative-import lib services** (statTrackingService, movementService, auctionService,
  achievementService, beerBase*, bot*, dailyLoginService, discoveryService, mapGeneration,
  tierUnlockService, cacheWarming, combatPowerService): same conversion pattern but each
  touches game-economy write paths; sized as their own batch(es) — selection is the
  operator's, not a pre-decided deferral.
- **`lib/shrineServer`** (1 op), **`lib/websocket/chatHandlers`** (1 op): trivial;
  bundle with their consumers' batch or batch with the 17 — operator's call.

## 3. Premise corrections to the FID-016 record (evidence-forced)

- `adminLogs`/`ActionLog` are **aliased to `modLog`** in `TABLE_ALIASES` (lib/mongodb.ts:147)
  — the FID-016 statement that the admin audit inserts "matched nothing real" was wrong;
  those rows landed via the alias. The batch-2 mod_log rewrites are still correct (typed,
  same destination), but the historical claim overstates the defect.
- `logs/cleanup`'s real bug was **wrong-target counting** (ActionLog→mod_log counts, not
  player_activity), not a silent no-op. The D2 fix remains correct.
- `playerAchievements → achievements` alias is real (config.ts:101), so admin/
  achievement-stats currently works through the shim.

## 4. Batch plan (proposed slices, awaiting selection)

1. **Slice 1 (safety-critical):** antiCheatDetector rewrite (G) — restores actual
   per-player analysis. ~10 sites + pins incl. cross-player isolation probe.
2. **Slice 2 (deletions + theater):** inventory-root delete, debug/tile delete,
   harvest/move theater conversion (4 files, trivial).
3. **Slice 3 (trivial conversions):** chat presence ×3, player reads ×3, clan/invite,
   cron/player-snapshot (8 files).
4. **Slice 4 (conversions with shape mapping):** admin ×3, auction/my-bids,
   clan/leaderboard, shrine ×2 (7 files).
5. **Slice 5 (real rewrites):** factory ×6 routes + rankingService.
6. **Slice 6 (own batch(es), selection pending):** the 17 relative-import services —
   **active in-scope items** (SCOPE.md out-of-scope row #96), not pre-deferred; the
   operator picks their batch and order.

Each slice: pins + live probe per the house pattern; the census gate extends to relative
imports.

## 5. Gates (per slice)

tsc 0 · eslint 0 · shim-census reduction asserted in the test file · suite green ·
live probe (direct-handler where `requireAuth`-family auth allows; HTTP via register-route
session where `getAuthenticatedUser` is used) · probe-owned cleanup with residue-zero
assertions.
