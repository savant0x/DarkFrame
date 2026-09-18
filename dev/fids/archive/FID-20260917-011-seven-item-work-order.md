# FID-20260917-011 — Work order: seven queued items approved for execution

**Status:** `loop-complete (evidence probed in-loop; awaiting operator final approval)`
**Session:** 2026-09-17 (054)
**Origin:** Operator directive: "make a FID to approve all 7, run perfection loop
on the fid then present for final approval." The seven items are the pending-work
ledger presented after the product survey (sessions 052-053).

## 1. Goal

Execute the full pending ledger in one approved pass, in dependency order, each
item with its own gate. Commit order below is normative.

## 2. Loop / evidence (every premise probed this session)

- **Census still clean** (census-exit 0); mojibake repair of SCOPE rows 86-88
  verified (21 sequences fixed, zero residual, line count stable).
- **Referrals cron (item 6 premise):** `scripts/validate-referrals-cron.ts`
  builds a REAL `new MongoClient(MONGODB_URI)` against `mongodb://localhost`,
  is wired as `npm run validate-referrals` (package.json:19) and documented
  with crontab instructions (docs/REFERRAL_SYSTEM_GUIDE.md:451-474) - but the
  pg-side logic it shadows (`checkReferralValidation`, referralService:467,
  same 7-day + 4-login criteria) has ZERO callers. Verdict: the cron is a
  decoy validating a database that is no longer the source of truth, while
  NOTHING validates pg referrals. Loop decisions:
  - **D1 (repair vs replace, item 5): REPAIR.** Row 11's defect is a wrong
    property access (`.length` vs `.rows.length` on a pg QueryResult). Fix is
    surgical; any refactor beyond territoryService is out of scope.
  - **D2 (cron, item 6): DELETE the decoy** (script + npm script + guide
    section corrected). Real validation wiring becomes a named follow-up FID
    candidate (on-login trigger recommended) - recorded, not silently dropped.
- **#23 (item 6 premise):** the fix is already in the tree and committed
  (server.ts:47-49, `parseInt(PORT) || 3000` normalization, SCOPE #23 comment).
  Remaining work is the boot probe + row flip only.
- **#22 (item 6 premise):** `app/api/admin/player-tracking/` exists with
  activity/ + sessions/ + route.ts (the rebuilt endpoints). Remaining work is
  the live modal-fetch probe + row flip.
- **Block scope (item 3):** operator decision recorded - GLOBAL block
  (chat + DMs + social), in the survey audit.

## 3. Work order (execution sequence, each item gated)

| # | Item | Action | Gate |
|---|------|--------|------|
| 0 | This FID + SCOPE row 89 | Commit micro-batch | footer-free commit lands |
| 1 | FID-010 alliance batch | Commit the staged-ready batch (ClanPanel + pins + FID + row 88 + session 053 + the SCOPE mojibake repair) | owner-checked staging; gates already green (3 pins, tsc 0, eslint 0, census 0, suite 1020+1skip) |
| 2 | Closures x3 (FID-008, FID-009, FID-010) | Fill section 8 hashes; archive FIDs; SCOPE rows 83/86/88 dispositions updated in place; CHANGELOG [0.0.9]; VERSION bump | row-once assertions; CHANGELOG newest-first; archive renames staged |
| 3 | Chat-honesty FID (survey P0) | File + implement: wire ChatMessage onDelete through to the existing /api/chat/delete; build report persistence (chat_reports table + POST /api/chat/report + admin read); GLOBAL block (blocked_users table + enforcement in chat + DMs + friends surfaces); fix stale item-link comment | pins per surface; live probe (report row lands; blocked sender invisible to target but visible to others; delete removes); full gates |
| 4 | Tutorial /complete deletion micro-FID | Delete app/api/tutorial/complete/ + file FID + row | census exit 0; suite green; zero client callers re-verified at execution |
| 5 | Row 11 territory dedupe repair | Fix the QueryResult guard in territoryService income path (read .rows.length); pin the guard's truth with a mocked QueryResult | new pin fails pre-fix, passes post-fix; suite green |
| 6 | Referral decoy + stale rows | Delete scripts/validate-referrals-cron.ts + package.json:19 script; correct REFERRAL_SYSTEM_GUIDE.md cron section; flip rows 22 + 23 to Closed (probe evidence: modal fetches resolve; PORT=0 boot binds 3000); file follow-up FID candidate "wire pg referral validation (on-login)" | npm run validate-referrals no longer exists; guide carries no live crontab instructions; boot probe log in session record |
| 7 | Session 054 record + row 89 closure | Record everything; flip this FID's row on its closure hash | ledger coherent: every row once, CHANGELOG ordered, census 0 |

## 4. Gates (per-item, enforced at execution)

Each item lands as its own footer-free commit with owner-checked staging
(hunk-level SCOPE staging when rows are shared). House gates on every code
item: tsc 0, eslint 0 (touched files), vitest full suite, census exit 0.
No heredoc bookkeeping (the mojibake rule): all SCOPE/FID/CHANGELOG edits go
through str_replace/write_file or Python with explicit unicode escapes.

## 5. Non-goals

- Mongo Clusters B/C/D (separate FIDs per cluster, queued after this order).
- Chat polish cluster (P2) and MessageThread real-time.
- ClanManagementView unification (recorded candidate).
- Referral validation wiring itself (follow-up FID candidate filed in item 6).

## 7. Notes

- Item 2's CHANGELOG entry covers 0.0.9: FID-008/009/010 + the census gate
  (already committed in the 82-86 range but never versioned).
- The survey audit's block decision (GLOBAL) is item 3's scope source of truth.
- Rows 83/86/88 disposition text says "hash fills on commit" - item 2 performs
  exactly that, by in-place substitution from HEAD's blob.

## 8. Closure

- **Gates:** per-item, all green - final state: tsc 0; full suite 1032 passed + 1 skip; inverted route census exit 0 (session 054 records the per-item detail and the three gate defects fixed in-flight).
- **Commit hash (G2):** 1214c3b (closure commit; per-item hashes 233bbca / 296b48c / 85a03b4 / d89ac93 / d51992f / af7afae / 7de2230 recorded in SCOPE row 89's disposition)
- **Post-commit:** Archived to dev/fids/archive/ in the closure micro-batch; SCOPE row 89 Closed (at 1214c3b); CHANGELOG 0.0.10.
