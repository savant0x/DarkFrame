# FID-20260917-001: Clan-treasury snapshot-writer hardening (C1 sibling-writer class)

**Filename:** `FID-20260917-001-clan-treasury-snapshot-writer-hardening.md`
**ID:** FID-20260917-001
**Severity:** HIGH
**Status:** loop-complete
**Created:** 2026-09-17

---

## 1. Summary

FID-20260916-013 hardened the capture path's transaction shape and explicitly scoped out
the *sibling writers* — the rest of the codebase's clan-treasury writes, most of which
follow the hazardous pattern the capture path just escaped: read a treasury snapshot
(fresh select or stale ORM cache), compute `snapshot ∓ delta` in JavaScript, write the
computed number back. Two concurrent writers on the same clan last-writer-win, silently
deleting one operation's effect. Fresh probes catalog **12 writer sites across 7
services** in this class — claim/income (territoryService), deposit/withdraw/upgrade
(clanBankService), perk activation (clanPerkService), WMD purchase/refund
(clanTreasuryWMDService, wmdAdminService), the remaining capture-path debits
(clanWarfareService) — while two services (clanAllianceService, clanDistributionService)
already use the safe relative-`sql` idiom and become the pattern reference. The fix
unifies every site onto one idiom: **relative SQL arithmetic + `SELECT … FOR UPDATE`
row locks inside `db.transaction`**, with honest acceptance that the bank jsonb
transaction-log append remains a bounded risk (documented, not hidden).

## 2. Evidence (RED)

All findings cataloged before any fix is designed. Every claim is from fresh probes
(this session, 2026-09-17). Treasury-writer census command:
`grep -rn "bankTreasuryMetal:" lib --include="*.ts" | grep -v test | grep -v "\.bak"`.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | **claimTerritory: snapshot debit + jsonb snapshot write, no transaction** — reads `clanRow` (line ~150 select), computes `newBankMetal = BigInt(bankMetal) − BigInt(finalCostMetal)`, writes `territories: updatedTerritories` + computed bank columns in one bare `db.update` | lib/territoryService.ts:236-244 | read_files 185-289: `const updatedTerritories = [...currentTerritories, newTerritory];` … `bankTreasuryMetal: Number(newBankMetal)` in a single `db.update(clans)` with no `db.transaction` |
| 2 | **collectDailyTerritoryIncome: snapshot credit + jsonb append** — computes `newBankMetal = Number(clanRow.bankTreasuryMetal) + income.metalPerDay`, writes it plus `bankTransactions: updatedTransactions` (append) + `lastTerritoryIncomeCollection: now` un-transacted; the guard (`lastCollection >= todayStart → return`) is check-then-act, so two concurrent calls both pass and **double-pay** | lib/territoryService.ts:694-731 | read_files 690-764: guard at 700-707, computed write at 709-731 |
| 3 | **depositToBank: snapshot debit + jsonb append + non-atomic player debit** — `Number(BigInt(clan.bank.treasury.metal + depositMetal))` computed write; clan update and player resource debit are two separate `db.update` calls — a crash between them creates resources out of thin air | lib/clanBankService.ts:237-255 | read_files 205-274: `.set({ bankTreasuryMetal: Number(BigInt(clan.bank.treasury.metal + depositMetal)) … })` then separate `db.update(players)` |
| 4 | **withdrawFromBank: same pattern mirrored** — computed `treasury.metal − withdrawMetal`, separate clan/player updates, jsonb append | lib/clanBankService.ts:331-354 | read_files 315-374 |
| 5 | **upgradeBankCapacity: computed debit + jsonb append** | lib/clanBankService.ts:571-580 | read_files 555-599: `bankTreasuryMetal: Number(BigInt(bankMetal - upgradeCost.metal))` |
| 6 | **activatePerk: computed debit + activePerks jsonb snapshot write** | lib/clanPerkService.ts:86-94 | read_files 75-124: `bankTreasuryMetal: Number(BigInt(Number(clan.bank.treasury.metal) - metal))` with `activePerks: updatedPerks` |
| 7 | **deductWMDCost: snapshot debit + jsonb append** (live via missileService/spyService/defenseService imports — not dead code) | lib/wmd/clanTreasuryWMDService.ts:154-158 | read_files 145-169: `bankTreasuryMetal: Number(clan.bankTreasuryMetal) - cost.metal` |
| 8 | **emergencyDisarmMissile refund: snapshot credit + jsonb append** (admin route app/api/admin/wmd/route.ts:270) | lib/wmd/admin/wmdAdminService.ts:258-262 | read_files 248-267: `bankTreasuryMetal: Number(clan.bankTreasuryMetal) + Math.floor(refundAmount * 0.4)` |
| 9 | **Capture-path residual (the ironic one): FID-013 fixed the A1 corruption but the debits still use snapshot arithmetic** — declareWar (259), capture repel (495), capture success (541), settleWar spoils (721/730) all compute `treasury.metal ∓ delta` from a pre-transaction select | lib/clanWarfareService.ts:259,495,541,721,730 | grep census + sed 245-262: `bankTreasuryMetal: treasury.metal - cost.metal` inside `db.transaction` (atomic, but not race-safe vs concurrent writers) |
| 10 | **The safe idiom already exists in-repo** — clanAllianceService (225, 332) and clanDistributionService (667-670) use `sql\`${clans.bankTreasuryMetal} - ${cost.metal}\`` relative updates that compose correctly under concurrency | lib/clanAllianceService.ts:225,332; lib/clanDistributionService.ts:667-670 | sed 215-335: `.set({ bankTreasuryMetal: sql\`${clans.bankTreasuryMetal} - ${cost.metal}\` … })` |
| 11 | **Row-lock idiom is available but unused** — drizzle-orm ^0.45.2 exports `.for(strength, config?)` on PgSelect; zero `.for('update')` usages exist in lib/app; `db.transaction` is used only in clanWarfareService; `.returning()` has 4+ precedent usages | node_modules/drizzle-orm/pg-core/query-builders/select.d.ts:586; grep `for('update')` → 0 hits; `db.transaction` census → 1 file | `grep -n "for(" node_modules/drizzle-orm/pg-core/query-builders/select.d.ts` → `586: for(strength: LockStrength, config?: LockConfig)` |
| 12 | **Test coverage for this class is zero** — no territory/bank/perk/distribution service test files exist (only clanWarfareV2.test.ts touches a treasury writer) | `ls __tests__/lib/` grep census | `grep -iE "territory|bank|perk|distribut"` → only clanWarfareV2.test.ts |

Call-graph notes (Law 4 — all sites are production-reachable):

- `claimTerritory` → app/api/clan/territory/claim/route.ts:82; `collectDailyTerritoryIncome`
  → app/api/clan/territory/income/route.ts:31 (manual POST; no cron — but the double-pay
  race needs only two leaders clicking)
- `depositToBank`/`withdrawFromBank`/`upgradeBankCapacity` → app/api/clan/bank/route.ts:160,171,27
  (+ deposit/route.ts:64)
- `activatePerk`/`deactivatePerk` → app/api/clan/perks/activate/route.ts:87,130
- `directGrant` → app/api/clan/bank/distribute/route.ts:125 (already-safe site, listed for
  transaction-envelope scope)
- `deductWMDCost` → lib/wmd/missileService.ts:28, lib/wmd/spyService.ts:97,
  lib/wmd/defenseService.ts:42 (re-exported via lib/wmd/index.ts:80)
- `emergencyDisarmMissile` → app/api/admin/wmd/route.ts:270

## 3. Impact Analysis

- **Who/what is affected:** every clan-treasury write path (7 services, 12 sites); clan
  bank jsonb (`bankTransactions`, `territories`, `activePerks`) writers; players-resource
  updates paired with bank deposits/withdrawals; admin WMD refund path.
- **Failure modes if unfixed:** concurrent deposits/claims/withdrawals on the same clan
  silently drop one side's effect (last-writer-wins over the whole row); double income
  collection under double-click; deposit debits the player but not the clan (or reverse)
  on mid-flight failure; WMD purchase and admin refund racing member actions.
- **Blast radius of the fix:** direct — the 12 sites' read/write shaping plus new shared
  lock helper in lib/db; transitive — callers are untouched (function signatures
  unchanged); jsonb *appends* keep read-modify-write shape inside the locked transaction
  (safe within the lock; cross-lock interleaving of two appends on the same clan is
  serialized by the row lock, so no lost append within a single transaction window).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | **Yes** — the idiom applies to every treasury column and both debit/credit directions; the jsonb-append caveat is bounded (see Q3) and identical across sites. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | **Yes** — row locks are per-clan-row, held for microseconds; different clans never contend. HOT rows (one clan, many members) serialize on the lock, which is the correct semantic for a shared wallet. |
| Survives a hostile attacker, not just an honest user? | **Partially — one honest caveat.** Money arithmetic becomes race-safe (no crafted concurrency can duplicate or vanish funds). BUT the bank `bankTransactions` jsonb append remains read-modify-write *inside* the row lock: within one clan, concurrent writers serialize (lock), so appends cannot be lost across transactions; a hostile user cannot exploit this without racing two same-clan requests, which the lock orders. Residual risk is cross-column jsonb size growth, not fund safety. Documented as accepted, not hidden. |
| Maintainable in 2 years? | **Yes** — one shared helper (`withClanTreasuryLock`) + one idiom; new writers copy the pattern; census grep stays as the audit tool. |
| Sets the standard for the industry? | **Yes** — relative SQL arithmetic + row locks is the textbook-correct pattern for ledger writes in Postgres; adopting it repo-wide raises the floor. |

All five answer yes/partially-with-disclosed-bound → GREEN proceeds.

## 5. Proposed Fix (GREEN)

- **Approach:** two mechanical rules applied uniformly, plus one shared helper.
  1. **Relative SQL arithmetic everywhere:** replace every `bankTreasuryMetal: snapshot ∓
     delta` computed number with `sql\`${clans.bankTreasuryMetal} - ${delta}\`` (the
     clanAllianceService:225 / clanDistributionService:667 in-repo idiom). Same for
     energy/RP columns and paired player-resource columns.
  2. **Lock before decide:** wrap each writer in `db.transaction`; the first statement
     re-selects the clan row with `.for('update')` (drizzle 0.45.2, select.d.ts:586 —
     proven available; new idiom, flagged as such in FID-013 §7). Balance/ownership
     re-validation happens *after* the lock using the locked row's values.
  3. **Shared helper** `withClanTreasuryLock(clanId, fn)` in a new `lib/db/treasuryLock.ts`
     so the pattern is one import, not 12 hand-rolled transactions.
  4. **jsonb appends** (`bankTransactions`, `territories`, `activePerks`) keep
     read-modify-write shape but read from the *locked* row inside the transaction —
     same-clan writers serialize, eliminating the lost-update window between select and
     write for funds-bearing columns.
- **Alternatives considered:**
  - *Migrate jsonb territory/transactions to real tables* — the durable fix, but a schema
    migration + rewrite of every reader; out of scope for a correctness patch (recorded as
    the future FID it deserves to be).
  - *Advisory locks* (`pg_advisory_xact_lock`) — viable but non-obvious; row locks are
    more discoverable and match the ORM idiom.
  - *Optimistic version column* — requires schema change; row locks need none.
- **Changes:**

| File | Action (create/modify/delete) | Description |
| ---- | ----------------------------- | ----------- |
| lib/db/treasuryLock.ts | create | `withClanTreasuryLock<T>(clanId, fn: (tx, lockedClan) => Promise<T>)`: opens `db.transaction`, `SELECT * FROM clans WHERE id = clanId FOR UPDATE` (`.for('update')`), passes tx + locked row to fn; single definition of the idiom |
| lib/territoryService.ts | modify | claimTerritory: wrap write in the lock; bank columns → relative `sql`; territories jsonb written from the locked row's value (F1). collectDailyTerritoryIncome: same; double-collection guard moves *inside* the lock re-checking `lastTerritoryIncomeCollection` from the locked row (F2) |
| lib/clanBankService.ts | modify | deposit/withdraw/upgrade: lock + relative `sql` for treasury columns and paired player-resource columns; jsonb transaction append from locked row (F3/F4/F5) |
| lib/clanPerkService.ts | modify | activatePerk: lock + relative `sql`; activePerks append from locked row (F6). deactivatePerk (139-141) writes ONLY `activePerks` jsonb — verified sed 125-165, no treasury columns — included in the lock envelope for activePerks serialization, not as a funds writer |
| lib/wmd/clanTreasuryWMDService.ts | modify | deductWMDCost + refundWMDCost: lock + relative `sql` (F7) |
| lib/wmd/admin/wmdAdminService.ts | modify | emergencyDisarmMissile refund block: lock + relative `sql` (F8) |
| lib/clanWarfareService.ts | modify | declareWar debit, capture repel/success debits, settleWar spoils transfer: relative `sql` (existing transactions kept; declareWar gains the lock) (F9) |
| lib/clanAllianceService.ts, lib/clanDistributionService.ts | modify | already-safe relative updates: wrap in the shared lock for uniform serialization with jsonb-appending writers (F10) — smallest possible change, no idiom rewrite |
| __tests__/lib/treasuryConcurrency.test.ts | create | First coverage for this class: relative-SQL composition under interleaved updates (mock-verified SQL fragments), lock-helper contract (tx opened, `.for('update')` invoked, fn receives locked row), income double-collection refusal inside lock, deposit pair atomicity (clan+player in one tx call graph) |
| __tests__/lib/clanWarfareV2.test.ts | modify | Adjust any select-order mocks if declareWar/capture paths gain the lock's re-select (mock queue shifts by one batch) |

- **Verification plan:** `npx tsc --noEmit` → 0; `npm run lint` → 0/0; `npm run test:ci`
  → all green (current baseline 966+1skip). Plus census grep
  `grep -rn "bankTreasuryMetal: Number(" lib --include="*.ts" | grep -v test` → 0 hits
  (every computed-number treasury write eliminated).
- **Call-graph reachability plan:** same greps as §2 Law-4 notes re-run post-change —
  each hardened function still shows its route/service caller ≥1 hit; plus
  `grep -rn "withClanTreasuryLock" lib --include="*.ts"` → ≥8 importing files.

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis (baseline) | Gates on current tree | `npx tsc --noEmit` → `TSC_EXIT=0` · `npm run lint` → `LINT_EXIT=0` · `npm run test:ci` → `966 passed / 1 skipped (967)` (fresh, 2026-09-17, pre-implementation) | pass |
| Method 2: manual re-read against this FID | All 12 findings re-read at file:line this session; every §5 Changes row traced to a finding; Five Questions answered with mechanism (Q3 caveat disclosed, not silent) | §2 evidence column outputs (census greps, read_files windows, node_modules d.ts probe) | pass |

- Audit outcome: **PASS → status `loop-complete`** (loop passes: 1 — RED probe batch
  produced zero corrections to the catalog after re-read; change % across passes < 2%).
- Circuit breakers: iteration 1 of 10; no oscillation; convergence at pass 1
  (probe evidence → GREEN mapping complete, no new findings on re-read).

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** not-started
- **Files changed:** none yet
- **Verification evidence:** to paste at implementation
- **Call-graph reachability evidence:** to paste at implementation

## 8. Closure

- **Gates:** [ ] typecheck 0 errors · [ ] lint 0 errors/0 warnings · [ ] tests pass · [ ] call-graph proven
- **Commit hash (G2 — required for `closed`):** *(pending)*
- **Staging plan (path-scoped, G3/G4):** `git add lib/db/treasuryLock.ts lib/territoryService.ts lib/clanBankService.ts lib/clanPerkService.ts lib/wmd/clanTreasuryWMDService.ts lib/wmd/admin/wmdAdminService.ts lib/clanWarfareService.ts lib/clanAllianceService.ts lib/clanDistributionService.ts __tests__/lib/treasuryConcurrency.test.ts __tests__/lib/clanWarfareV2.test.ts`
- **Commit message (G8):** `fix(economy): harden clan-treasury writers — row locks + relative SQL (FID-20260917-001)`
- **Archive:** on close → `dev/fids/archive/` + CHANGELOG entry + session-summary log.

---

**Final status:** loop-complete
