# FID-20261002-009: Summoned Bot Placement and Tile Ownership

**Filename:** `FID-20261002-009-summoned-bot-placement-and-tile-ownership.md`
**ID:** FID-20261002-009
**Severity:** MEDIUM
**Status:** implemented
**Created:** 2026-10-02

---

## 1. Summary

Summoning overwrites the coordinates already claimed by createBotPlayer, so player rows/response disagree with tile ownership and positions may collide or leave the map.

**Review coverage:** R18. [Review](../audits/PROJECT-REVIEW-2026-10-02.md) · [source/probe evidence](../audits/PROJECT-REVIEW-2026-10-02-EVIDENCE.json) · [remediation index](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-PLAN.md). This FID plans remediation; no implementation or defect closure is claimed.

## 2. Evidence (RED)

| Finding | File:Line | Reproduced observation |
| --- | --- | --- |
| R18 | `lib/botSummoningService.ts:120; lib/botService.ts:660` | createBotPlayer claims a Wasteland tile, then summonBots substitutes unchecked offsets; claimed tile stays at the first location. |
| R18 | `lib/botService.ts:515; lib/botSummoningService.ts:121` | Existing zoneBounds uses x=zone%3, y=floor(zone/3); summon calculation transposes axes and ignores 1-based bounds. |

Fresh source/probe checks performed in this planning session:

```text
Get-FileHash against review sourceHashes: 18/18 match.
npx vitest run --config dev/tmp/review-20261002/vitest.config.mts
Test Files 4 passed (4); Tests 16 passed (16); exit 0.
```

The probes reproduce existing defects; they do not test future fixes. Source-confirmed risks and proposed policies are labeled separately from executed findings.

**Production call graph:** BotSummoningPanel.tsx:128 → /api/bot-summoning → summonBots → createBotPlayer → claimBotBaseTile → mapDomainPlayerToRow. getTileAt reads tile ownership, not substituted response coordinates.

**Exact source/caller probe:**

```powershell
rg -n 'summonBots|createBotPlayer|claimBotBaseTile' app/api/bot-summoning/route.ts lib/botSummoningService.ts lib/botService.ts; rg -n 'baseOwner' lib/movementService.ts
```

The source output and file hashes are retained in the shared planning audit. Existing callers are grounded; prospective helpers/options require the listed callers to consume them in implementation. Zero wired callers rejects implementation; no unimplemented symbol is represented as live.

## 3. Impact Analysis

Summoned bot creation and shared placement helper. Preserve ordinary spawn defaults, bot permanence and summoning reward/cooldown parameters.

**Dependencies and ownership:** 002 transaction/lock ordering. Extends claimBotBaseTile/createBotPlayer rather than adding a competing placement engine.

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

1. Read the summoner's current position from the authenticated locked player row; treat any client coordinates as advisory only. Validate real map bounds and tech/cooldown in-lock.

2. Extend existing claimBotBaseTile options with a bounded center/radius constraint and transaction context, consumed through createBotPlayer by summonBots. Select only unoccupied Wasteland within Euclidean radius 20 and 1..MAP_WIDTH/HEIGHT; derive zone using the existing zone convention from the actual chosen tile.

3. Generate a bot identity before claiming its tile. Use the returned claimed position as the one source for base/current position, inserted row and response; remove post-claim relocation entirely.

4. Claim five distinct legal tiles, insert five bots with existing specialization/1.5× resources and summoned metadata, and update the 168h cooldown in one transaction. If fewer than five legal positions exist, refuse and roll back all claims/inserts/cooldown rather than returning a misleading five-bot success.

5. Order candidate tile locks by coordinates; use conditional claims and bounded whole-operation retries for races. Normal global bot spawns remain compatible with original createBotPlayer defaults.

6. Add a dry-run diagnostic for existing summoned bots whose player position differs from an owned tile. Fix only evidence-backed one-to-one claims under an explicit reconciliation run; ambiguous/colliding records are reported and never steal another base's tile.

**Source-audit correction:** Sort and lock the full five-tile candidate set before conditional claims; if a race invalidates the set, retry the entire batch within the bounded transaction budget. Derive zone from the repository's actual x/y convention, not an offset formula. Ordinary spawning must use the same claim invariant, without the summon-only radius restriction.

**Alternatives rejected:** isolated patches that leave another live writer incorrect; client-only restrictions; snapshot arithmetic behind a balance predicate; new formulas duplicating existing catalogs/helpers; retroactive restoration without asset evidence. The exact family-specific tradeoff is audited in Section 6.

**Change inventory (implementation only):**

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/botSummoningService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `lib/botService.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |
| `app/api/bot-summoning/route.ts` | modify | The corresponding contract/consumer in the numbered plan above; full 0–EOF read before editing. |

Tests belong in existing suites for the named routes/services, extended with actual-production behavior and failure probes. A new helper file or migration must be explicitly added to this inventory with its production callers/consumers during implementation planning; no speculative API/config field is introduced by this document.

**Acceptance criteria:**

- Corners/edges/sector boundaries, crowded/no-free Wasteland and duplicate candidates: positions stay within 20 radius/on-map and rows=response=claimed tiles.
- Actual summon with isolated database dependencies produces exactly five distinct ownership claims and no claim at an unrelated original spawn.
- Concurrent summons for one account commit one batch; competing bots cannot claim the same tile. Inject third-insert/claim failures: no orphan claims or consumed cooldown.
- Existing ordinary/Beer bot creation continues to claim valid zones; 1.5× resources and 168h header pins remain green.

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
| Method 2: source/manual plan audit | Existing contracts, alternatives, caller wiring, dependency ownership and boundary/failure criteria | Clamping a random offset or releasing the original tile after insertion would still permit collisions and partial failures. Placement constraints belong in the existing conditional claim, before insertion. | PASS: source/coverage/boundary audit; zero actionable plan findings |

**RED/GREEN disposition:** evidence is grounded and the proposed plan is concrete. The full document audit and circuit-breaker measurements are recorded in the shared planning audit, with per-FID snapshots/hashes ([audit](../audits/PROJECT-REVIEW-2026-10-02-REMEDIATION-AUDIT.md)). Deep audit has zero actionable plan findings; two consecutive revisions below 2% are verified. Each revision is limited to 10%, with max 10 iterations, flag at 5 without convergence, and escalation on an issue recurring three times.

## 7. Implementation Record

- **Status:** implemented (batch 9 of the 2026-10-02 remediation dependency order, operator directive).
- **Files changed:** `lib/botService.ts` (claimBotBaseTile gains `center`/`radius`/`tx`; extracted `claimTileRow` single conditional claim; NEW `claimBotTilesInRadius` — full candidate set coordinate-ordered + `FOR UPDATE`-locked before conditional claims, `InsufficientLegalTilesError` on scarcity; NEW `zoneForTile` repository-convention zone derivation; `createBotPlayer` gains `{ claimedTile, username, tx }` — identity before claim, claimed tile the ONE position source, pre-generated username so `base_owner` = bot row), `lib/botSummoningService.ts` (summonBots rewritten: `playerPosition` param REMOVED — position read from the locked player row; ONE `withTransactionRetry('bots:summon')` transaction: FOR UPDATE player row, in-lock tech+cooldown via `SummonRefusal`, five identities before claims, batch radius claim, 1.5× resources + summoned metadata, canonical `mapDomainPlayerToRow`, in-tx cooldown; truthful `InsufficientLegalTilesError` refusal surfaced), `app/api/bot-summoning/route.ts` (position arg + redundant pre-check dropped). New test file: `__tests__/lib/botSummonPlacement.integration.test.ts` (disposable-PG acceptance, §5 matrix). `SUMMONING_CONFIG` unchanged (5 bots, radius 20, 1.5×, 168h). No migrations required (no schema change).
- **Verification evidence:** configured gates exit 0 — `npx tsc --noEmit` (0 diagnostics), `npm run lint` (0 errors/warnings), `npm run test:ci` (**149 passed + 10 skipped (159 files) / 1448 tests + 63 skipped**); ledger census clean. **Disposable-PG acceptance 8/8 PASS** (embedded-postgres port 55441, UTF8 initdb): real summon → 5 distinct claims within Euclidean radius 20 on-map with rows=response=tiles and `base_owner` = bot username, summoner's own base + foreign base untouched, cooldown consumed; in-lock tech/cooldown refusals claim nothing; concurrent summons on one account → exactly one batch commits (loser refuses on cooldown), no double claims; scarce overlap (exactly 5 shared legal tiles, two adjacent summoners) → one batch wins whole, loser claims nothing; <5 legal tiles → refusal rolls back claims+inserts+cooldown; injected post-claim failure (BEFORE INSERT trigger) → zero orphan claims, cooldown untouched; ordinary createBotPlayer spawn keeps zone-sector defaults; zoneForTile boundary convention pinned.
- **Call-graph reachability evidence:** production path re-probed — BotSummoningPanel.tsx → /api/bot-summoning (POST now calls `summonBots(player.username, specialization)`) → summonBots → claimBotTilesInRadius + createBotPlayer({claimedTile, username}) → claimTileRow; ordinary spawns (beerBaseService, repopulate/spawnBots scripts, admin bot-spawn route) reach the unchanged claimBotBaseTile default path; headerTruthPins re-pinned to the new summonBots signature + tx contract (17/17).
- **Defect discovered during implementation:** the pre-implementation draft let createBotPlayer generate its OWN internal identity after the batch had claimed tiles under pre-generated `ownerUsernames` — `base_owner` would not have matched the inserted bot row. Fixed by threading the pre-generated username through `createBotPlayer` options (identity and claim owner are the same from the first write); covered by the acceptance suite's identity-matches-base_owner assertion.
- **Authorization:** operator directive to implement remaining remediation FIDs in dependency order with gates and disposable-PG acceptance tests per batch. G2 commit outstanding (operator executes).

## 8. Closure

Not eligible. No production fix, committed hash, terminal status or archival is claimed. Keep this FID active after document loop completion. Implementation must satisfy Section 5's acceptance criteria and fresh configured gates, then reach implemented; closed requires the operator's G2 commit hash.

Prepare a logical-atomic, path-scoped staging plan after implementation using this inventory plus the verified tests/migrations. Commit message: `fix(summoned-bot): summoned bot placement and tile ownership (FID-20261002-009)`. Do not execute git, update releases or archive in this planning session.

---

**Final status:** implemented (2026-10-02; G2 commit outstanding — operator executes)
