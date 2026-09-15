# FID-20260914-003: auction persistence rebuild — ground-truth correction and residual seam defects

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260914-003-auction-persistence-rebuild-residuals.md`
**ID:** FID-20260914-003
**Severity:** HIGH
**Status:** closed (implemented 2026-09-14; committed `e860b4a` per G2 (pre-merge hash; canonical: PR #41))
**Created:** 2026-09-14

---

## 1. Summary

SCOPE #25 ("Auction persistence never worked on pg — domain doc and `auctions` table share
no keys; zero listings have ever persisted") is **stale**: migration 0008 added a domain
bridge to the `auctions` table (`doc` jsonb holding the full AuctionListing plus mirrored
indexed columns), `lib/mongodb.ts` implements the doc⇄column sync in both directions
(`syncAuctionDocFields`/`shapeRowAuctions`, "completes the #25 seam"), and FID-20260912-065
shipped bid escrow + the settlement engine with 12 passing regression tests and a wired
5-minute job. The rebuild this FID was asked to plan already exists. What remains is a
narrow set of **residual seam defects** — two player-harming economy holes (a buyout that
forfeits the outbid leader's escrowed bid; tradeable-item listings that can never deliver),
a unit escrow that silently never locks, an unverified `$pull` equality semantic, and a
stale dot-path sort — specified here to convergence for a follow-up implementation session.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 0 | #25's core claim no longer holds: the auctions table carries the domain bridge (`doc` jsonb NOT NULL DEFAULT '{}', `auction_id` unique, mirrored scalar columns) | `lib/db/schema/config.ts:113-143` | read 0-EOF: "Domain bridge (migration 0008): `doc` jsonb holds the full AuctionListing document (item, bids[], fees, timestamps)" |
| 1 | The shim implements the doc⇄column mapping both directions: writes synthesize `doc` + fill mirrors + legacy NOT NULLs (seller_id/item_data/starting_price); reads overlay columns onto `doc` | `lib/mongodb.ts:471-554` | `syncAuctionDocFields` + `shapeRowAuctions` — header: "Auction domain ⇄ column sync (FID-20260904-005 §5.0 (e) — completes the #25 seam)" |
| 2 | Dot-path filters and doc-field `$set`/`$push` translate to jsonb containment / `jsonb_set` on doc-tables (bids persist inside `doc`) | `lib/mongodb.ts:399-446, 679-717` | `buildDocPathPredicate` ("the auction my-bids `where false` bug"), `$set` "no dedicated column (e.g. bids, settledAt, saleFee): store inside the synthesized document" |
| 3 | Escrow + settlement engine exists, tested, wired: bid escrow at `placeBid`, outbid release, claim-guarded settlement, refunds on cancel/expire/transfer-failure | `lib/auctionService.ts` (0-EOF read), `lib/jobs/auctionSettlementManager.ts:14,42`, `server.ts:38` | `settleExpiredAuctions` consumers: settlement test file, jobs-status route, the manager job; grep `startAuctionSettlementJob` in `server.ts` |
| 4 | **Economy hole (HIGH): `buyoutAuction` never refunds the escrowed leader.** placeBid escrows every bid (`$inc: -bidAmount`); the outbid release fires only inside placeBid. Buyout transfers item, charges the buyer `buyoutPrice`, credits the seller, sets `Sold` — and the previous `highestBidder`'s `currentBid` metal is never returned (seller does not receive it either; it evaporates). **Race note (loop-2 audit):** the shim's `updateOne` returns `modifiedCount: 1` unconditionally (`lib/mongodb.ts:1318-1349`), so claim detection via match count is unavailable — the release must be made race-safe by FILTER (status-scoped, pair-guarded), and a concurrent placeBid-vs-buyout window exists pre-FID with worse outcomes (double-pay); see §5 Known residual | `lib/auctionService.ts` `buyoutAuction` (0-EOF read: no `$inc` touching `highestBidder`), `lib/mongodb.ts:1318-1349` | re-read of the function body: money writes are buyer `−buyoutPrice` and seller `+sellerReceives` only; grep `modifiedCount: 1` — five unconditional returns |
| 5 | **Economy hole (HIGH): TradeableItem listings are accepted end-to-end but can never deliver.** Service validation is quantity-only (`lockUpdate: {}` — "TODO: Implement proper tradeable item locking"); `transferAuctionItem`'s TradeableItem branch is an empty TODO that returns success; the buyer pays and receives nothing while the seller keeps the items (and both paid fees) | `lib/auctionService.ts` (`validateAndLockItem` TradeableItem branch; `transferAuctionItem` TradeableItem branch) | the UI ships the option: `components/CreateListingModal.tsx:110-112` (`// TradeableItem (Phase 5)` yet builds the request), create route passes it through, schema accepts it (`lib/validation/schemas.ts:302,312`) |
| 6 | Unit escrow is a silent no-op: `validateAndLockItem` returns `$set: { 'units.$[unit].locked': true }` (positional operator); the shim maps dotted `$set` only on doc-tables (`columns.doc`) — `players` has no `doc` column, so the write is dropped. A seller can list the same unit twice; the second sale self-heals at settlement (unit missing → `TRANSFER_FAILED` → refunds), but inventory shows a unit that is committed | `lib/auctionService.ts` (`validateAndLockItem` Unit branch), `lib/mongodb.ts:669-676` (dotted `$set` branch requires `columns.doc`) | branch conditions read directly; no `doc` column on `players` (schema, `lib/db/schema/player.ts`) |
| 7 | `$pull` with an object operand (`{ units: { unitId } }`) relies on pg `jsonb - jsonb` element-matching semantics that this audit could not confirm from the code alone (exact-equality vs containment); if it is exact equality, a real unit (multi-field object) is never removed — unit duplication on sale | `lib/mongodb.ts:721-727` (`$pull`: `coalesce(col,'[]') - ${JSON.stringify(value)}::jsonb`), `lib/auctionService.ts` `transferAuctionItem` Unit branch | the settlement tests mock the seam, so no test exercises the SQL; flagged for a live probe at implementation |
| 8 | `GET /api/auction/my-bids` sorts on a stale dot-path: `bids.timestamp` — the domain field is `bidTime` (`AuctionBid`). The shim maps only top-level columns for sort, so the key silently no-ops and results render in DB natural order | `app/api/auction/my-bids/route.ts:97`, `types/auction.types.ts` (`bidTime`), `lib/mongodb.ts:1178-1187` (sort keys resolve via `resolveKeyToProp`; unmapped keys filtered out) | grep: `sort({ 'bids.timestamp': -1 })` |
| 9 | Bookkeeping drift (the reason #25 reads as open): the seam work landed across the 09-04/09-12 sessions but the ledger row was never updated — exactly the FID Ground-Truth failure mode (metadata is a claim, not truth) | `SCOPE.md` ledger #25 | row text still says "Table is empty — zero listings have ever persisted" while migration 0008 + the shim seam exist |

**Call-graph notes (Law 4):** the auction service is reached in production from six live
routes — `create` → `createAuctionListing`, `bid` → `placeBid`, `buyout` → `buyoutAuction`,
`cancel` → `cancelAuction`, `list` + `my-listings` → `getAuctions`, `my-bids` (direct
collection reads) — and the settlement engine from `auctionSettlementManager` (registered
in `server.ts:38`, runs every 5 minutes; verified via `settleExpiredAuctions` consumers +
`startAuctionSettlementJob` in `server.ts`). Nothing auction-side is dead-wired; the
defects above are all in live paths.

## 3. Impact Analysis

- **Who/what is affected:** every auction participant. Bidders lose escrowed metal to any
  buyout (finding 4 — silent, unrecoverable without an admin grant). Tradeable-item buyers
  pay for nothing (finding 5). Unit sellers see phantom-committed inventory and can
  double-list (finding 6). My-bids ordering is arbitrary (finding 8).
- **Failure modes if unfixed:** escalating distrust in the auction house; escrow
  accounting diverges from player wallets; support burden of "my metal vanished" reports.
- **Blast radius of the fix (Section 5):** one service file, one route, one modal, one test
  file. No schema migration (the bridge columns and `doc` already exist). No API contract
  changes (error codes are additions, not renames).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — escrow refunds cover every ordering (buyout with zero bids = no-op; with bids = leader refunded; unit listings escrow the goods like resources, covering cancel/expire/transfer-failure uniformly) |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — the fixes are per-transaction writes on indexed rows; no new scans or N+1s |
| Survives a hostile attacker, not just an honest user? | Yes — unit escrow kills the double-list vector outright; tradeable blocking removes the pay-for-nothing surface; buyout refund removes the griefing-by-buyout vector |
| Maintainable in 2 years? | Yes — units/resources converge on ONE escrow pattern (goods leave the seller at listing, return on failure), deleting two TODOs instead of adding code around them |
| Sets the standard for the industry? | Yes — every reward and every escrow is stated and reversible by construction |

## 5. Proposed Fix (GREEN)

**Approach — Option A: complete the existing seam (service-level fixes on the live
bridge).** The persistence rebuild exists and works (findings 0-3); the residuals are
business-logic holes in the service layer, not storage failures. Option B (rewrite the
service on raw drizzle, the original #25 framing) is **rejected**: it re-risks the very
contract drift the seam now prevents, for zero user-visible gain, and discards 12 passing
settlement tests.

- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/auctionService.ts` | modify | (1) `buyoutAuction`: refund the escrowed leader, race-safe by construction — FIRST claim the close via a conditional status flip (`updateOne({auctionId, status: 'active'}, {$set: {status: 'sold', …}})`), THEN release the leader read from a FRESH post-claim re-read, with the release `$inc`'s own filter carrying the leader pair (`{auctionId, highestBidder: L, currentBid: N}`) so a stale snapshot can never double-release (the shim's unconditional `modifiedCount` makes filter-guarding the only honest guard; a non-matching filter updates 0 rows — a harmless no-op). Skip when the leader IS the buyer (their escrow is the payment). Mirrors placeBid's outbid release; zero when no bids. (2) Unit escrow: `validateAndLockItem` (Unit) returns a real lock — the unit is REMOVED from the seller's `units` jsonb at listing (same pattern as the resource escrow `$inc`), replacing the no-op positional `$set`; `cancelAuction`, `settleExpiredAuction` (no-bid + transfer-failure paths) refund by returning the stored unit object to the seller. `transferAuctionItem` (Unit) becomes buyer-side `$push` only (goods already left the seller). (3) TradeableItem: `createAuctionListing` rejects the type up front (`TRADEABLE_NOT_TRADEABLE_YET` error code, "arrives in a later phase") until real inventory transfer ships |
| `app/api/auction/my-bids/route.ts` | modify | Sort mapped results in-route by the user's own highest `bidTime` desc (replaces the stale `bids.timestamp` sort key; no shim change needed) |
| `components/CreateListingModal.tsx` | modify | Hide/disable the TradeableItem option with a "coming in a later phase" hint (no dead UI offering a broken flow) |
| `__tests__/lib/auctionSettlement.test.ts` | modify | Regression tests: buyout-with-bids refunds the leader exactly once (and NOT when the leader is the buyer); buyout-vs-bid ordering — a placeBid arriving after the status flip cannot re-escrow onto a Sold row; unit listing removes the unit (escrow) and every refund path returns it; tradeable create is rejected; my-bids ordering contract |
| `lib/mongodb.ts` | verify-only | Live-probe the `$pull` object-operand semantic (finding 7). With unit escrow in place the probe is belt-and-braces (no production path depends on it); if the semantic is exact-equality, extend `$pull` to containment-matching for object operands as a shim hardening follow-up — not blocking this FID |

- **Alternatives considered:** (B) full drizzle rewrite of the service — rejected above;
  (C) leave TradeableItem accept-but-noop and document it — rejected: it is an active
  money-loss surface, not a TODO; (D) implement real tradeable inventory transfer now —
  rejected for scope: item identity/duplication semantics in `inventory.items` are
  unspecified (Phase 5 design needed); blocking the type is the honest boundary.

- **Known residual (documented, not deferred silently):** a sub-second placeBid-vs-buyout race remains even with the claim-first design: placeBid validates Active, escrows the bidder, and its leader `$set` can land on a just-claimed Sold row (the bidder's escrow then needs an admin grant). This window is PRE-EXISTING and strictly worse today (double-pay both directions); the FID shrinks it and caps the harm at stuck-escrow. Full elimination requires serialized money-writes (a `db.transaction` seam on the shim or single-statement conditional SQL) — recorded as the follow-up `lib/mongodb.ts` hardening item, out of this FID's minimal blast radius.
- **Verification plan:** `npx tsc --noEmit` → exit 0; `npm run lint` → exit 0;
  `npm run test:ci` → 76 files, all pass, 0 failures (≥ the 737-test baseline + new
  regressions); live drive on the dev server: list resource → bid from second account →
  buyout from third → leader's metal restored (DB probe), tradeable create → 400.

- **Call-graph reachability plan:** grep `buyoutAuction|placeBid|createAuctionListing` in
  `app/api/auction/**` (route wiring unchanged); grep the new error code in
  `components/CreateListingModal.tsx` + service; jobs-status panel still lists the
  settlement job.

## 6. Audit Record

### Loop 1 — audit of the RED/GREEN document

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis (typecheck/lint/tests) | FID is a document; repo gates run to prove the FID-making session changed no code and the claims' baseline holds | `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run test:ci` 75 passed / 1 skipped (76 files), 736 / 1 skipped (737 tests), 0 failures (2026-09-14, this session) | pass |
| Method 2: manual re-read against this FID | Every file:line claim re-verified by 0-EOF reads of `lib/auctionService.ts` (1018 lines), `lib/mongodb.ts` mapping/settlement-relevant sections, `lib/db/schema/config.ts` (auctions + trade_history), `app/api/auction/my-bids/route.ts`, `components/CreateListingModal.tsx` excerpts, `types/auction.types.ts`; settlement job wiring via grep (`server.ts:38`, manager imports); 9 shim/settlement cross-checks | findings table above cites the re-read output; SCOPE #25 contradiction confirmed against the migration-0008 schema comment | pass |

- Loop 1 outcome: PASS → entered deep-audit pass on operator direction.

### Loop 2 — deep audit (adversarial re-check of the loop-1 GREEN; operator-directed)

| Probe | What was checked | Evidence | Result |
| ----- | ---------------- | -------- | ------ |
| `coerceScalar(null)` semantics | whether `hasBuyout: {$exists: true, $ne: null}` mis-translates (the suspicion: `ne(col, null)` binds a parameter) | `lib/mongodb.ts:266-269` (`coerceScalar` passes null through) + `buildWhere` `$ne` branch → `ne(column, null)` renders `IS DISTINCT FROM NULL` — correct null-exclusion semantics | cleared — no defect |
| `hasBuyout` consumer reality | whether the false-case filter has any live consumer (loop-1 text did not claim one) | `components/AuctionHousePanel.tsx:89,115,410` — three-state filter (all/true/false) wired to the list route | consumer EXISTS — strengthens the §5 rationale; no text change required |
| `updateOne` claim semantics | whether the buyout release could rely on match counts | `lib/mongodb.ts:1318-1349` — five unconditional `modifiedCount: 1` returns | **defect in loop-1 GREEN** — the release design was not race-safe; SELF-CORRECT applied |
| placeBid-vs-buyout race analysis | interleaving where placeBid's leader `$set` lands after buyout's claim (bidder escrowed, leader record lost) | timeline analysis over the two functions' write sequences; pre-existing window (worse today: double-pay) | residual documented in §5 Known residual; full serialization scoped OUT as shim-hardening follow-up |

- Loop 2 outcome: **1 actionable finding** (buyout release race-safety) → SELF-CORRECT: §2 finding 4 and §5 changes row rewritten (claim-first close + pair-guarded release + Known residual paragraph); all other probes cleared with evidence. Convergence: delta between loop-1 and loop-2 documents confined to the buyout design paragraphs (< 2% of document character count; no issue reappeared); no oscillation; iterations used: 2 of 10.
- Termination: with the self-correct applied, the deep audit yields ZERO further actionable improvements → status remains `converged` (document-only loop; implementation still gated per §7).

## 7. Implementation Record

- **Status:** implemented 2026-09-14 on operator directive, per the §5 GREEN (Option A).

**Shipped per plan:**

| Item | Where | Notes |
| ---- | ----- | ----- |
| Buyout claim-first close + leader refund | `lib/auctionService.ts` `buyoutAuction` | Conditional `findOneAndUpdate({auctionId, status: 'active'}, …)` flips Active→Sold before any money moves; leader read FRESH from the post-claim row; different-player → full escrow refund; leader-is-buyer → charges only `buyoutPrice − currentBid` (no double-pay); claim lost → `AUCTION_NOT_ACTIVE`, zero wallet writes; delivery failure → claim ROLLED BACK (row returns Active, no money moved). The old unconditional status `$set` after transfer was removed (dead once claim-first). |
| placeBid claim-conditional leader transition | `placeBid` | Leader `$set` now claims via `findOneAndUpdate` carrying the pair (`currentBid`, `highestBidder`) + `status: 'active'`; claim lost → the bidder's fresh escrow refunds immediately and the outbid leader is untouched (exactly-once release guaranteed by the pair filter). |
| Unit escrow | `validateAndLockItem` (Unit) + all refund/delivery paths | Snapshot frozen into `item.unitSnapshot` (service-owned; the route's zod schema strips client-supplied fields, so injection is service-side by construction); seller's `units` array rewritten minus the listed unit; delivery = buyer-side `$push` of the snapshot (legacy no-snapshot rows fall back to seller-side lookup + `$set` rebuild); refunds (`cancel`, settle no-bid, settle transfer-failure) `$push` the snapshot back exactly once. |
| Tradeable gate | `validateAndLockItem` (TradeableItem) | Create rejects with `TRADEABLE_NOT_TRADEABLE_YET` before any lock/fee. Modal: Ground-Truth verification — the TradeableItem button is **already disabled** in HEAD ("Items · Phase 5", `cursor-not-allowed`), so no modal edit was needed; the §5 modal row is satisfied by the existing UI. |
| my-bids ordering | `app/api/auction/my-bids/route.ts` | Stale `bids.timestamp` sort removed; in-route ordering by the caller's own highest `bidTime` (fetch → sort → slice), since the key is per-member data the shim cannot sort by. |
| `$pull` probe | `scripts/probePullObjectOperand.ts` | **Verdict sharper than the FID suspected:** the shim's `$pull` SQL is INVALID on this engine — `operator does not exist: jsonb - jsonb` for object AND scalar operands (read-only SELECT probe, exit 0). The old unit transfer's seller-side `$pull` could never have executed. The verified `jsonb_agg(e) … WHERE e <> operand` rewrite is banked in the probe script for the shim-hardening follow-up. Unit escrow therefore uses `$set` array rebuilds, never `$pull`. |

**Implementation discoveries (defects found and fixed while shipping — same defect classes the FID documents):**

1. `cancelAuction`'s refund was **not claim-guarded** (§5 scope omitted it): two concurrent cancels double-paid the escrowed goods. Fixed with the same claim-first `findOneAndUpdate` close; regression tests added (claim won → refund; claim lost → zero wallet writes).
2. `createAuctionListing`'s fee-merge (the FID-065-era `$inc`-overwrite fix) carried only `$inc` — the unit escrow's `$set: { units: … }` was silently dropped (the §6 finding-6 failure mode reborn inside the fix). Caught by the new listing regression test before it could ship; merge now carries `$set` through.

**Evidence (gates, 2026-09-14, post-implementation):** `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npm run test:ci` **75 passed / 1 skipped (76 files) · 747 passed / 1 skipped (748 tests) · 0 failures** (+11 over the 736 baseline; the new suite is 19/19). Regression tests cover: buyout leader refund exactly-once (and not when leader is buyer), lost-claim buyout pays nothing, buyout-vs-bid race (bid refunds its own escrow, leader untouched), delivery-failure rollback, unit escrow snapshot + removal + fee charge, tradeable rejection with zero writes, expired-unit refund, snapshot delivery to buyer, cancel claim discipline (won/lost), unit refund on cancel.

**Evidence (live E2E, real HTTP + postgres, 2026-09-14):** `scripts/e2eAuctionLedger.ts` (exit 0) drove the full flow against the dev server on :3002 — three fresh accounts registered over `/api/auth/register`, balances seeded via `UPDATE … RETURNING`, then: a tradeable-item listing was **rejected pre-fee** (VALIDATION_FAILED, wallet untouched — finding 2 live); the seller listed 1000 metal (24h, fee 150); a second account bid 700 (escrowed); a third buyout at 2000. Ledger assertions (all ✓): seller 2000→2750 (−1000 goods escrowed at listing, −150 fee, +1900 payout), bidder 700→700 (escrow then exact leader refund — **the HIGH finding-4 fix proven live**), buyer 2000→1000 (−2000 charge, +1000 delivered metal), auction row `sold / settled=1 / final_price=2000 / winner=buyer`, trade row `sale_fee=100 / seller_received=1900`, global conservation ΣΔ = **−250 = exactly the two fees, zero mint, zero leak**. `my-bids` answered ordered-by-`bidTime` over the live API. Cleanup: guarded `scripts/e2eCleanupAuction.ts` removed all 9 e2e accounts (3 batches), 2 auctions, 2 trade rows; residual counts 0/0/0. Observations recorded: `notifyAuctionEvent` is fire-and-forget and wrote no `player_notifications` rows under the test load (pre-existing, out of FID scope); the buyout response text reports the full price while the wallet charge is `buyoutPrice − leaderAmount` when leader=buyer (copy nicety only).

**Law 4:** all four service entry points remain route-wired (`create/bid/buyout/cancel` routes import + await them); `AuctionHousePanel` consumes my-bids; settlement job wiring unchanged.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (747/1 skipped/0 fail) · [x] call-graph proven
- **Commit hash (G2 — required for `closed`):** `e860b4a` (pre-merge hash; canonical: PR #41) — `fix(auction): escrow refunds, unit escrow, tradeable gate (FID-20260914-003)`
- **Staging plan (path-scoped, G3/G4):** `git add lib/auctionService.ts app/api/auction/my-bids/route.ts types/auction.types.ts scripts/probePullObjectOperand.ts __tests__/lib/auctionSettlement.test.ts dev/fids/FID-20260914-003-*.md`
- **Commit message (G8):** `fix(auction): escrow refunds, unit escrow, tradeable gate (FID-20260914-003)`
- **Archive:** on close — move to `dev/fids/archive/`, CHANGELOG entry, session-summary log.
- **Follow-up banked:** shim `$pull` hardening (`jsonb_agg` rewrite, verified in the probe script) + full money-write serialization (§5 Known residual) remain open as `lib/mongodb.ts` hardening items.

---

**Final status:** closed (implemented + live-E2E verified; commit `e860b4a`; canonical: PR #41)

### Post-closure verification addendum (2026-09-14, session 011)

The unit-escrow and cancel/expiry refund legs — until now covered only by the in-process
suite — were driven live against the dev server by `scripts/e2eUnitEscrow.ts`, mirroring
the money-path E2E (`scripts/e2eAuctionLedger.ts`):

- **Buyout delivery:** unit leaves the seller's army at listing (escrow), the frozen
  `unitSnapshot` is delivered intact into the buyer's army, seller paid 300 − 5% sale fee,
  trade_history row written.
- **Cancel refund:** snapshot returned to the seller's army; a second cancel was REJECTED
  (claim-first close) and refunded nothing (no duplicate).
- **Expiry refund:** settled by the REAL 5-minute settlement job (expires_at backdated to
  simulate the clock only — no run-now route exists); snapshot returned, status
  expired+settled.
- **Conservation:** Σ(metal final − initial) = −465 = exactly 3×150 listing fee + 15 sale
  fee (pure burn); unit conservation 3 minted → 3 owned, no duplicates. Full pass, exit 0;
  fixtures cleaned with verified residual 0/0/0 (`scripts/e2eCleanupUnitEscrow.ts`).
- Gates after: tsc 0 · eslint 0 · vitest 769/1 skipped/0 failures (unchanged baseline).
  Driver + cleaner retained alongside the money-path E2E pair.
