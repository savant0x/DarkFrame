# FID-20261002-005: Auction Instance Escrow and Clan Authorization

**Filename:** `FID-20261002-005-auction-instance-escrow-and-clan-authorization.md`
**ID:** FID-20261002-005
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Unit listing selects one blueprint match and removes all matching entries, leaving stale army totals. Clan-only listings omit seller clan and allow outsiders at the discounted fee.

**Review coverage:** R16, R17. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R16 | `lib/auctionService.ts:338; :355; :824` | Actual listing removes three singleton Titans and escrows one; escrow/delivery/refund update units without matching aggregate totals. |
| R17 | `lib/auctionService.ts:229; :461; :620` | sellerClan omitted; bid/buyout authorization commented out; clan sale fee 0% versus public 5%. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** Auction create/bid/buyout/cancel/list routes → auctionService; settlement job → settleExpiredAuctions. CreateListingModal.tsx currently submits blueprint unitId, requiring an instance-selection contract change.

**Exact source/caller probe:**

```powershell
rg -n 'createAuction|placeBid|buyoutAuction|cancelAuction|settleExpiredAuctions' app/api lib/jobs lib/auctionService.ts; rg -n 'unitId|clanOnly|unitInstanceId' components/CreateListingModal.tsx types/auction.types.ts lib/validation/schemas.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Marketplace contract, live picker, private search and existing escrow. Public fees and resource/tradeable ownership contracts remain supported; ambiguous historical losses are reported.

**Dependencies and ownership:** 002 transaction contract and 004 canonical identity/common reducer. This FID owns listing/escrow/bid/close atomic boundaries and clan membership enforcement.

Historical data repairs require evidence-backed dry-run output before mutation. Do not infer past player losses from a current snapshot.

## 4. Five Questions

| Question | Design answer and evidence obligation |
| --- | --- |
| Works for ALL cases, not just the common case? | Yes by the explicit refusal, boundary, legacy and concurrency contracts below; the acceptance matrix must verify them before implementation completion. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes in design: bounded operations and participant-scoped locking/batched reads; no global serialization or unbounded retry. Database contention must be measured where applicable. |
| Survives a hostile attacker, not just an honest user? | Yes in design: authoritative identity/state, conditional claims and validation; input and race tests below are required evidence. |
| Maintainable in 2 years? | Yes: reuse existing catalog/effect/state/transaction seams with explicit consumers and ownership; no parallel formula or accounting system. |
| Sets the standard for the industry? | Yes as an engineering contract: asset conservation, truthful results and reproducible failure tests. This is a design judgment, not a production certification or proven balance claim. |

These answers assess the plan. Neither current defective behavior nor unexecuted future tests are claimed passing.

## 5. Proposed Fix (GREEN)

**Approach:** repair the authoritative seams already reached by production. Prefer shared domain invariants and transactional state changes over client guards, mirrored tests or compensating writes.

1. Add a distinct unitInstanceId to the auction item request/type/schema and live picker. Keep blueprint unitId as catalog identity. Select exactly one owned instance by id, snapshot server-derived stats and full quantity, and remove by array index/id once. Whole-stack escrow is the chosen contract; partial-stack sales are not silently inferred.

2. Commit listing fee, exact unit escrow, recalculated seller STR/DEF and listing insertion together. Delivery and cancel/expiry refund consume the stored snapshot once and update recipient ownership/weighted totals in the same settlement transaction.

3. Make bid, buyout, cancellation and expiry claim transitions, refunds, payouts, asset delivery and auction bridge/mirrored state one transaction with locked auction and involved players. Race/duplicate close returns a refusal or stored outcome; a delivery error rolls back the status and money, not a best-effort compensation.

4. Populate sellerClan from authoritative membership at creation; refuse clanOnly for unclanned sellers. Freeze the listing clan id. Bid/buyout must compare current buyer membership to that frozen id in-lock; subsequent seller clan changes cannot widen eligibility. Existing valid bids settle under their admission record even if the bidder later leaves.

5. Apply authorization to listing search/read as well as bid/buyout; unauthorized requests for known clan-only IDs fail without revealing private detail or changing money. Public auctions keep existing fees/access.

6. Audit existing active clan-only records lacking sellerClan and legacy unescrowed unit listings. Refuse new bids/buyouts on ambiguous records and use the normal transactional cancel/refund path where asset evidence is unambiguous; missing-asset cases remain flagged for explicit reconciliation. Never guess a unit from a nonunique blueprint.

7. Recount current owner aggregates from verified armies after dry-run reporting; ensure escrow is not counted as deployed power. Do not recreate historically destroyed units without an authoritative snapshot or operator-approved restoration.

**Source-audit correction:** The live picker is CreateListingModal.tsx:53/132/330; replace blueprint option keys/values with instance IDs there. Explicitly propagate private-list authorization through auction list/my-listings/my-bids and bid/buyout routes. Verify fee computation uses persisted clan scope only after admission; outsider requests cannot receive the clan zero-fee path.

**Boundary audit:** Existing auction list/read routes must pass authenticated identity into the service; direct service callers also fail closed. Zero-fee clan rules run after clan admission. Include whole-stack quantity in auction display/DTO and guard legacy entries without an instance ID from selection.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/auctionService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `types/auction.types.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/validation/schemas.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/db/auctionDocBridge.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `components/AuctionListingCard.tsx` | modify | Render whole-stack escrow quantity and authorized listing details. |
| `components/CreateListingModal.tsx` | modify | Instance picker keys/request and truthful whole-stack preview. |
| `app/api/auction/list/route.ts` | modify | Authenticated private-list filtering. |
| `app/api/auction/my-bids/route.ts` | modify | Authorized private listing detail. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- List one of three Titans sharing unitId: exactly that id leaves; two remain; whole stack quantity is conserved through sale/cancel/expiry; totals follow ownership at every stage.
- Direct outsider bid/buyout/read against a known clan listing fails with zero financial writes; same-clan succeeds; missing/stale clan metadata fails closed; public 5% fee unaffected.
- Race listing of one instance, two buyouts, cancel versus expiry and bid versus close. Atomic failure injection proves no unit loss, duplicate delivery, stranded escrow or partial refunds.
- Legacy missing-clan/missing-instance cases report explicit integrity errors; client display uses server snapshot and selected instance id.

**Verification plan (exact configured commands):**

```text
npx tsc --noEmit
npm run lint
npm run test:ci
```

Require exit 0, zero TypeScript diagnostics, zero lint errors/warnings and every test passing. Run `npm run build` if implementation changes build-affecting configuration. Use isolated PostgreSQL for database semantics and injected-dependency production route/service tests for admission/results; never substitute copied expressions for production execution. Tests reproducing old defects must be rewritten to assert corrected behavior and shown failing against the old implementation.

**Call-graph reachability plan:** repeat Section 2's exact probes after implementation, checking imports plus the actual invocation inside each reachable success/validation path. Every shared helper and new field must have the named production caller and a behavior-level integrated test.

## 6. Audit Record

| Method | What is checked | Evidence | Result |
| --- | --- | --- | --- |
| Method 1: configured static/test gates | Current source baseline; planning documents cannot establish repair correctness | Shared planning audit records exact exits/output | PASS: tsc/lint exit 0; 147 files / 1419 tests pass |
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | find-by-instance alone is insufficient: seller aggregates, recipient totals and all refund paths must use the same snapshot quantity and transaction. Frozen clan scope needs a stated settlement policy for membership changes. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-10-02 (session SESSION-2026-10-02-003; batch 5 of the dependency-order implementation directive).
- **Files changed:** `lib/auctionService.ts` (fully rewritten around ONE-transaction integrity: typed `AuctionRefusal` refusals thrown inside `withTransactionRetry` transactions roll back ALL writes and convert to the result envelope; `lockAuctionByAuctionId` — every admission check, claim transition and money move serializes on `SELECT … FOR UPDATE` by domain auctionId; `lockPlayersSorted` — the 002 sorted-username lock order for all participants; `validateAndPlanItem` — the unit branch selects the EXACT owned instance by `unitInstanceId`, refuses `UNIT_INSTANCE_REQUIRED`/`UNIT_NOT_FOUND`/`UNIT_MISMATCH`, and freezes the whole-stack escrow snapshot server-side; `createAuctionListing` — pure validations first, then ONE tx: seller lock → active-listing ceiling → fee funds → frozen `sellerClan` (`CLAN_REQUIRED` for unclanned clan-only sellers) → escrow plan → ONE wallet write (fee + relative escrow + recounted army totals) → doc-bridge insert; `placeBid` — ONE tx: auction lock → status/expiry/self-bid/`assertListingDeliverable`/frozen-`sellerClan`-vs-live-membership (`CLAN_ONLY`) admission → bidder+leader sorted locks → bid debit → leader release → guarded leader-claim update (0 rows = refusal, whole tx rolls back), outbid notification post-commit; `buyoutAuction` — ONE tx: admission → claim-first Active→Sold close → `transferAuctionItem` INSIDE the tx (delivery failure throws → the close, delivery and every monetary write roll back together) → leader refund / buyer-charge-only-remainder when the leader IS the buyer → seller credited price − persisted sale fee → trade_history in tx; `cancelAuction` — ONE tx under lock: `refundEscrowedGoods`, fee non-refundable; `assertListingDeliverable` — unit listings with NO snapshot AND NO instance id refuse new activity `AMBIGUOUS_LEGACY_LISTING`; `transferAuctionItem`/`refundEscrowedGoods` — tx-aware, unit deliveries/refunds recount the recipient's army totals via the shared `calculatePlayerUnitStats`; `settleExpiredAuction` — tx-based re-lock by id (`CLAIM_LOST` on lost race), no-bid → refund + Expired in one commit, sold → delivery (failure maps `TRANSFER_FAILED`, row stays Active) + seller credit + trade in one commit; `getAuctions` — clan-only visibility SQL `clanOnly=0 OR doc->>'sellerClan' = viewerClan OR seller = viewer`, anonymous viewers see public only — fail closed). `types/auction.types.ts` (`AuctionItem.unitInstanceId`, `AuctionSearchFilters.viewerUsername`); `lib/validation/schemas.ts` (`unitInstanceId` optional min-1); `components/CreateListingModal.tsx` (unit picker selects the exact instance, whole-stack labeling); `components/AuctionListingCard.tsx` (whole-stack quantity display); `app/api/auction/list/route.ts` + `my-listings` + `my-bids` (viewer authorization wiring; my-bids filters authorizedMatching by frozen clan before pagination).
- **Verification evidence:** fresh gates on the implemented tree — `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run test:ci` **148 passed + 6 skipped (154 files) / 1442 tests passed + 39 skipped**, exit 0. **Disposable-PG acceptance 8/8 PASS** (`__tests__/lib/auctionEscrow.integration.test.ts`, embedded-postgres harness on port 55437, production URLs refused, self-skips in test:ci): whole-instance escrow of one-of-three Titans (exact instance removed, totals 900→600 recounted, frozen snapshot delivers the whole stack qty-3 at buyout, 5% public fee conserved exactly — listing + sale fee are the only burned metal); refused create leaves zero writes (no wallet/army/auction-row changes); clan-only outsider bid/buyout fail closed `CLAN_ONLY` with zero writes, anonymous/non-member reads exclude the listing while seller and clan kin see it, same-clan buyout pays the 0% clan fee; concurrent bids from one wallet serialize under the row lock (exactly one escrow commits, wallet hits zero not negative, one bid row); bid-vs-buyout race ends in exactly one committed outcome with wallet invariants either way; cancel refunds the escrowed unit with recounted totals and the fee stays burned; settlement refunds expired-no-bids goods and pays expired-with-bids sellers 95% with delivery to the winner; ambiguous legacy listings (no snapshot, no instance id) refuse new bids/buyouts without any writes. Existing suites re-pinned to the tx contract: `__tests__/lib/auctionSettlement.test.ts` (20/20 — bid-race rollback leaves zero committed writes, ambiguous-legacy and tradeable-snapshot-missing refusals, cancel/settlement refunds via unitsSets with recounted armies) and `__tests__/api/auctionUnitListingHonesty.test.ts` (7/7 — `UNIT_MISMATCH`/`UNIT_INSTANCE_REQUIRED`, totals recount, instance id stored).
- **Call-graph reachability evidence:** every rewritten export retains its §2 production callers — createAuctionListing (auction/create route), placeBid (auction/bid), buyoutAuction (auction/buyout), cancelAuction (auction/cancel), getAuctions (auction/list + my-listings), settleExpiredAuctions (auctionSettlementManager job + admin jobs-status); the new helpers are internal seams of those paths. UI consumes the ratified item shape via CreateListingModal; the routes pass the viewer identity the visibility gate requires.
- **Authorization:** operator directive 2026-10-02 — implement the remaining remediation FIDs in dependency order, gates + disposable-PG acceptance tests after each; policies 005 (whole-instance/whole-stack escrow, frozen seller clan, existing-valid-bid eligibility at settlement, outsider fail-closed, ambiguous-legacy refusal) ratified by the operator before implementation.

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(auction-instance): auction instance escrow and clan authorization (FID-20261002-005)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — disposable-PG acceptance probes 8/8 green on real database contention, see §7)
