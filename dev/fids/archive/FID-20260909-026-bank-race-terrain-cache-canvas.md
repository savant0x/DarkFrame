# FID-20260909-026: Bank double-spend race, immutable-terrain over-fetch, canvas draw storm

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-026-bank-race-terrain-cache-canvas.md`
**ID:** FID-20260909-026
**Severity:** HIGH (a concurrent-request resource duplication exploit on the money path)
**Status:** implemented (all three items)
**Created:** 2026-09-09

---

## 1. Summary

Third program-wide optimization sweep (after FID-023 audit, FID-024 speed pass). This pass targeted areas neither covered: **write-path atomicity**, the terrain pipeline, the canvas renderer, and client listener hygiene. Findings ranked by severity.

## 2. Findings

### HIGH — Bank double-spend race (all three bank routes)

`deposit`, `withdraw`, and `exchange` all follow **validate-then-blind-set**: they read the player row, validate the balance in JS, compute the new absolute value, and write it back with no guard:

```
const bankAmount = Number(player.bankMetal);          // stale read
if (bankAmount < amount) return 402;                   // check against stale
const newBankAmount = BigInt(bankAmount - amount);     // computed in JS
await db.update(players).set({ bankMetal: Number(newBankAmount), ... });  // absolute set
```

Two concurrent withdrawals (double-click, scripted replay — rate limits are generous and non-atomic) both read the same balance, both pass validation, both write — the loser's write **resets** the winner's deduction. Net effect: one withdrawal's worth of resources is duplicated from nothing. Deposit and exchange have the same shape (exchange can mint both resources). The same pattern exists in `harvestService` (read-add-set: two concurrent harvests → lost update, the mirror-image bug) and one-off reward paths (`tutorialService` completion package, `clanBankService`, `flagBonusService`).

The codebase already has the correct pattern in-tree (`bountyBoardService`, `caveItemService` write `sql\`col + delta\`` server-side). Money columns are plain `integer` — the BigInt/Number roundabout is noise; the honest fix is **SQL-side conditional arithmetic**:

```
set: { resourcesMetal: sql`${players.resourcesMetal} - ${amount}` , bankMetal: sql`${players.bankMetal} + ${amount}` }
where: and(eq(players.username, u), gte(players.resourcesMetal, amount))  // atomic guard
```

…then check `rowCount`/returning; zero rows = insufficient (race loser). One statement, no transaction needed for single-row money moves.

### MEDIUM — `/api/map/terrain`: 22,500 JSON objects, uncached, on an immutable dataset

The endpoint ships the full 150×150 grid as `{x, y, terrain}` objects (~1.5–2 MB) with `dynamic = 'force-dynamic'`, and the client fetches it `cache: 'no-store'` — every map visit re-serializes 22,500 rows and re-downloads ~2 MB of data that **never changes** (terrain is generated once). Fix: wrap in `getCacheOrFetch` (FID-024's L1/Redis two-tier cache; terrain key, 300s TTL) and drop the client `no-store`. Follow-up (recorded, not done): a compact one-char-per-tile payload would cut the body ~90% but changes the page contract.

### MEDIUM — CanvasMapRenderer redraw storm

The map canvas redraws **all 22,500 tiles with fillRect + strokeRect each (~45k canvas ops)** on every `playerPosition` change — i.e., every single move — plus flag-poll ticks. At the rendered scale (TILE_SIZE ≈ 4px in the full-map viewport) the per-tile stroke is invisible. Fix: batch tiles by terrain color into paths (~8 fill calls) and drop the per-tile stroke. Same visual, ~5,000× fewer draw calls.

### LOW

- `/api/admin/vip/list` selects every player row (no limit) on every mount and filter change — client-side filtering. Admin-only; acceptable, recorded.
- `lib/` still holds ~286 `console.log` sites (FID-023 §3.9 deferred) — top holders: flagBotService (14), cacheWarming (12), tutorialService (11), mapGeneration (11).
- Prerender `location` ReferenceError from FID-025 §7 still unfixed (non-fatal; referrals tree).
- Move route's `playerBefore` pre-read (FID-024 §8 deferred) — the read also feeds `logMovement`/speed-check, so it is NOT removable as originally thought; recorded as a non-issue.

### Verified clean this pass

Rate limits present on all money routes (bank deposit/withdraw/exchange, harvest) · cron routes fail-closed on CRON_SECRET · vercel.json schedules don't overlap · `addEventListener` spot-checks (HarvestButton, InventoryPanel, FactoryButton, AddFriendModal) all have matching cleanup · tutorial fresh-player insert is race-safe (`onConflictDoNothing` + adopt) · WebSocket genuinely pushes chat/WMD/combat events.

## 3. Proposed scope (Law 2: operator's call)

All three items approved and implemented (see §5). Original scope proposal:

1. **Bank + harvest money-path CAS** — rewrite deposit/withdraw/exchange + harvestService writes as SQL conditional arithmetic with returning-row verification; regression tests proving a concurrent double-withdrawal cannot duplicate (HIGH — recommended now).
2. **Terrain cache** — server cache tier + client cache header (MEDIUM, small diff).
3. **Canvas batching** — per-terrain path fills, drop invisible strokes (MEDIUM, contained to one file).

## 5. Implementation record (2026-09-09)

### Item 1 — money-path atomicity

- **`app/api/bank/withdraw/route.ts`** — the withdrawal is now one atomic statement: `set` carries pure SQL deltas (`resources_metal + amount`, `bank_metal − amount`) and `where` carries the username equality **plus** the balance guard (`gte(bankMetal, amount)`). Success is verified through `.returning()` of the post-update row (response reads the returned values — the follow-up SELECT is gone). Empty returning = race loss / balance moved → honest `BANK_BALANCE_INSUFFICIENT`, never a success that resurrects the spent balance.
- **`app/api/bank/deposit/route.ts`** — same shape: guard `gte(resources, amount + fee)`, debit `resources − (amount+fee)`, credit `bank + amount`, `bankLastDeposit` set in the same statement. Race-loss path returns `INSUFFICIENT_RESOURCES`. `trackResourcesBanked` only fires after the atomic statement succeeds.
- **`app/api/bank/exchange/route.ts`** — guard `gte(source, amount)`; debit source, credit `floor(amount × rate)` into the destination — one statement, race-loss → `INSUFFICIENT_RESOURCES`. (Note: the follow-up player SELECT was removed; the response now serves returned values. `updatedPlayer` was unused downstream.)
- **`lib/harvestService.ts`** — harvest credits are now SQL deltas (`resources + finalAmount`); two concurrent harvests compose instead of the last write erasing the first. No guard needed — crediting is commutative.
- **`lib/tutorialService.ts`** — `awardTutorialReward` METAL and EXPERIENCE grants converted to SQL deltas (same lost-update class).
- **Tests** — `__tests__/api/bank/atomicity.test.ts` (3): the set-payload must be SQL objects, not absolute numbers (the bug signature); race-loss (empty returning) must answer 4xx, never 200; response values come from the returned row.

### Item 2 — terrain cache

- **`app/api/map/terrain/route.ts`** — rewritten: the 22,500-row read + serialization runs through `getCacheOrFetch(MapKeys.terrainGrid(), …, CacheTTL.MAP_TERRAIN = 3600s)` (FID-024's two-tier L1/Redis cache with single-flight); response adds `Cache-Control: public, max-age=300, stale-while-revalidate=3600`. The cold-world (not fully generated) state remains a 503; cache miss errors no longer mask it. **Invalidation note:** world-reset flows must delete `map:terrain`.
- **§6 follow-up — compact wire format:** the payload shrank from `{x,y,terrain}` objects (~1.9 MB) to ONE CHAR PER TILE (~22 KB, ~98% reduction) via the new `lib/terrainCodec.ts` (`encodeTerrainGrid`/`decodeTerrainGrid`/`COMPACT_TERRAIN_FORMAT = 'terrain-char-v1'`). The route caches the encoded STRING; the envelope carries `format/width/height/grid`; the map page pins its acceptance check on the format id and decodes via the shared codec — unknown characters or length mismatches throw (Law 14) and fall back to mock with the rest of the loader. Codec contract pinned by `__tests__/lib/terrainCodec.test.ts` (7): bijection over all 9 terrain values, lossless roundtrip, row-major 1-based positional reconstruction, loud dimension/char failure.
- **`lib/cacheKeys.ts`** — `CachePrefix.MAP`, `MapKeys.terrainGrid()`, `CacheTTL.MAP_TERRAIN`.
- **`app/map/page.tsx`** — client fetch no longer `no-store` (browser may now hold the payload per the Cache-Control header).

### Item 3 — canvas batching

- **`components/map/CanvasMapRenderer.tsx`** — tiles are bucketed by terrain into coordinate arrays and each terrain's tiles become one path with a single `fill()`: **22,500 fillRect + 22,500 strokeRect → ~8 path fills** per redraw. The per-tile 1px stroke is invisible at the rendered scale; adjacent same-terrain tiles form one seamless region as before. Debug log reports `terrainGroups`.

### Gates

- `tsc` 0 · `eslint` 0 errors (2 pre-existing warnings) · vitest **387 passed / 1 skipped** · `next build` exit 0 (238/238 pages).

## 4. Changelog

- 2026-09-09: created from scan; findings ranked; clean areas recorded.
- 2026-09-09 (§5): all three items implemented with the perfection loop; gates green; no suppressions added.
- 2026-09-09 (§5 item 2 follow-up): compact terrain wire format (`terrain-char-v1`) — route caches the encoded string, map page decodes via shared codec; payload ~1.9 MB → ~22 KB.
