# FID-20260927-006: Two tracking docs still describe a broken build that finished 25 days ago

**Filename:** `FID-20260927-006-stale-tracking-docs-claim-vs-reality.md`
**ID:** FID-20260927-006
**Severity:** MEDIUM
**Status:** closed (2026-09-27, commit `ee9c204`)
**Created:** 2026-09-27

---

## 1. Summary

`dev/progress.md` opens with **"Build health: ❌ NOT BUILDABLE — `npx tsc --noEmit` = 2,039 errors (exit 1)"** and `dev/issues.md` files it as **"B1. 🔴 Build broken — 2,043 TypeScript errors"**, the document's top blocker. `npx tsc --noEmit` **exits 0 today.** Both files were last updated 2026-09-02 and every one of their load-bearing claims was overtaken by work that shipped in the 25 days since. This FID re-measures all of them, corrects the two files against the measurements, and preserves the superseded claims as dated history rather than deleting them — the discipline the 2026-09-02 refresh that produced them already established.

Neither file is a gate input. Nothing fails because of this. That is precisely why it is worth doing: the two documents whose entire job is to tell a returning engineer whether the build works are the two that say it does not.

---

## 2. Environment

- **OS:** Windows 11, Git Bash (MSYS) · **Runtime:** Node v24.21.0, TypeScript 5.x
- **State:** `main` @ `a5c8016`, working tree carrying session 005's and this session's uncommitted work
- **Gates at authoring:** `npx tsc --noEmit` exit 0 · `npx eslint . --max-warnings 0` exit 0 · `npm run test:ci` 141 files / 1363 tests

---

## 3. Detailed Description — the claim-vs-reality table

Every claim below was re-measured this session. Nothing is carried over from the previous refresh, and no claim was corrected from memory.

| # | Claim (2026-09-02) | Measured 2026-09-27 | Verdict |
| - | - | - | - |
| 1 | `tsc --noEmit` = 2,039 errors, exit 1 — "NOT BUILDABLE" | `npx tsc --noEmit` **exit 0** | **FALSE** |
| 2 | `issues.md` B1: "2,043 TypeScript errors" | same command, exit 0 | **FALSE** |
| 3 | "14 MySQL-dialect Drizzle schema files" | **0** files import `drizzle-orm/mysql-core`; **14** import `drizzle-orm/pg-core` | **FALSE** (right count, wrong dialect — the pivot completed) |
| 4 | "Top error concentrations: friendService 119, wmdAnalyticsService 117, moderationService 80" | no such errors exist; the file compiles clean | **FALSE** |
| 5 | "10 admin routes use `@ts-nocheck` — Confirmed: exactly 10 files" | `grep -rl @ts-nocheck app/ lib/` → **0** | **FALSE** |
| 6 | "`drizzle.config.ts` … env-based credentials (`DB_*` vars in `.env.local`)" | reads `DATABASE_URL` only (`drizzle.config.ts:33`); no `DB_HOST`/`DB_USER`/`DB_PASSWORD` reference remains | **FALSE** |
| 7 | "No CI/CD pipeline configured" | `.github/workflows/` holds **`gate-chain.yml`** and **`attribution-guard.yml`** | **FALSE** |
| 8 | "~5 months of work sits uncommitted on `main`: 284 files … the working tree is the only copy" | `main` has **455 commits**; the tree holds 22 entries, all from the last two sessions | **FALSE** |
| 9 | "8 stray migration artifacts in root" (`fix_alliance.js`, `nul`, `convert-schemas.ps1`, …) | **none exist** | **FALSE** |
| 10 | "Burn down the lint baseline: 1,836 findings" | `npx eslint . --max-warnings 0` **exit 0, 0 errors, 0 warnings** | **FALSE** (completed) |
| 11 | "Convert or revert the 14 MySQL-dialect schema files" (technical debt) | already pg-dialect; schema census reports **57 tables, 57 live, 0 violations** | **FALSE** (completed) |
| 12 | "Test suite: 333 passed + 1 skip in ~34s" | **1363 passed**, 0 failed, 141 files | **STALE** (direction right, number wrong by 4×) |
| 13 | "DB direction — finish Postgres/Supabase pivot vs revert" (decision queue #2) | decided 2026-09-02 (Option A) and executed; SCOPE row 7 closed | **FALSE** (resolved) |
| 14 | "Lint-finding burn-down" (decision queue #3) | complete; SCOPE-approved burn-down finished 2026-09-27 | **FALSE** (resolved) |
| 15 | "Commit strategy for ~5 months of uncommitted work" (decision queue #4) | resolved; SCOPE row 14 closed | **FALSE** (resolved) |
| 16 | "Rotate DB credentials at SkySQL" (decision queue #1) | credentials left `drizzle.config.ts`; SCOPE row 6 narrowed to the provider-side rotation only | **PARTLY TRUE** — still open, correctly flagged, still operator-side |
| 17 | "Messaging: socket.io ^4.8.1 remains the installed dependency; `ABLY_*` prepared but no ably SDK installed" | socket.io **is** the live transport — ≥5 importers under `lib/websocket/`; **0** `ably` imports | **TRUE** (the one claim that survived) |
| 18 | "Test coverage ~15% (target 60% per Jan 2026 baseline docs)" | not measurable from the repository; no coverage tooling configured | **UNVERIFIABLE** — marked as such rather than restated as fact |

**Fifteen of eighteen claims are false, one is stale, one is unverifiable, and exactly one still holds.** Every false claim is a *completion* recorded as an *obstacle* — the files describe a build that was mid-migration on 2026-09-02 and has been finished, gated, and CI-green on ubuntu-latest since.

### The one that survived, and why it is the interesting one

Claim 17 is the only survivor, and it survives for a substantive reason: socket.io is genuinely still the messaging transport, five months after a ledger row asserted messaging had moved to Ably. The docs and the code agree with each other here, and both disagree with SCOPE row 13's parenthetical. That is recorded as an observation, **not** actioned — resolving which is right about messaging is a separate question from correcting two documents, and this FID does not get to decide it by editing a doc.

---

## 4. Impact Assessment

- [x] **Medium** — no runtime impact, no gate reads either file, and the blast radius of the fix is two markdown documents. But these are the two files a returning engineer opens first, and they currently report a critical blocker that does not exist, which is the most expensive kind of stale: it invites re-investigation of finished work.
- [ ] Critical / High / Low — nothing is broken by the staleness itself.

---

## 5. Proposed Solution

Rewrite both documents against the measurements in §3, keeping each file's existing shape and voice, and **preserving every superseded claim as dated history** rather than deleting it. Rationale: the 2026-09-02 refresh that produced these files made exactly this choice, with a correction notice explaining why. Repeating it keeps the file's own convention intact and leaves the history auditable — a reader can see not just that the build is fine, but that it was broken on 2026-09-02 and why.

Concretely:

1. **`dev/progress.md`** — lead with the live gate table (tsc 0 / eslint 0 / suite 1363 / 10-gate chain green on CI run `36336484395`); replace "No active approved work" with the current posture; correct the architecture block to pg-dialect and `DATABASE_URL`; reduce the decision queue to the one item that is genuinely open (provider-side credential rotation) and mark the three resolved ones as resolved, with the evidence for each.
2. **`dev/issues.md`** — strike B1 as resolved with its resolution evidence (the pivot, `9708a38`/`fe245aa`, the all-ten-gates CI run); keep B4 open with its narrowed scope; correct the "no CI/CD" limitation; replace the resolved technical-debt bullets with what is actually outstanding.
3. **Claim 17 (socket.io)** is left as written, and claim 18 (coverage) is relabelled unverifiable rather than restated.
4. **No new truth is asserted.** Every number in the rewrite comes from a probe pasted in §3. Where a figure cannot be probed, it is marked as such instead of being carried forward.

### Explicitly NOT in scope

- `dev/completed.md`, `dev/roadmap.md`, `dev/metrics.md`, `dev/quality-control.md` and other historical records — they are history, and the existing files already say so.
- SCOPE row 13's Ably-vs-socket.io claim (see above).
- Anything that would make the two files *agree* with each other by changing code. These are documents; the fix is that they describe reality.

---

## 6. Verification Gates

- gate: test `__tests__/lib/ledgerIntegrityCensus.test.ts`
- gate: quality

The census reads `dev/fids/`, so this FID's own status must be lawful for Gate 7 to pass. Typecheck, lint and the suite do not read markdown, and are run as Law-3 proof of zero drift rather than as gates on this change.

**Post-edit probes that must hold:** `grep -c '2,039\|2,043' dev/progress.md dev/issues.md` → the historical occurrences only, each inside a superseded/history context; no live claim of a failing build; `grep -c '@ts-nocheck' dev/issues.md` → 0; both files' "Last Updated" dates advanced to 2026-09-27 with the session record cited.

---

## 7. Perfection Loop

### Loop 1 — RED → GREEN → AUDIT

- **RED:** 18 claims enumerated and **each independently re-probed** before any edit (§3). No claim was corrected from memory or from the ledger's own summary of the docs — the point of the FID is that both the docs *and* the summaries describing them have been wrong, so the only admissible source is a fresh probe.
- **GREEN:** §5's four steps, with the history-preservation constraint that keeps both files consistent with their own 2026-09-02 convention.
- **AUDIT:** Method 1 — the census, `tsc`, `eslint` and the full suite re-run after the edit to prove zero code drift. Method 2 — both files re-read 0-EOF after the rewrite, every number in the new text traced back to a probe in §3, and a deliberate search for claims that were *dropped* rather than corrected (silently deleting a superseded claim would destroy the audit trail the file is built on).
- **ADVERSARIAL:** The strongest objection is that this is a documentation change with no gate behind it, so "verified" means little. **Upheld, and answered structurally:** the §6 post-edit probes are the gate for this change specifically — a `grep` that the false build-health claims are gone, that the surviving claims are the ones measurement supports, and that nothing was silently dropped. The general point is recorded rather than defended: a doc defect is invisible to a code gate, which is the same class as F7 in FID-20260927-005 (a field the census does not check is a field nothing catches). **A second objection — that deleting the stale history would be cleaner — is ruled against**: these two files exist to carry history, and the 2026-09-02 author already chose preservation over deletion. A refresh that reversed its own convention would be harder to audit than the staleness it fixed.
- **CHANGE DELTA:** 100% (initial authoring).

---

## 8. Resolution

- **Closed Date:** 2026-09-27, on commit `ee9c204` (G2 satisfied; the agent ran git under
  explicit operator approval).
- **Fix Description:** §5, applied to `dev/progress.md` and `dev/issues.md`. Both files rewritten
  against the §3 measurements; every superseded claim preserved as dated history in the same shape the
  2026-09-02 refresh used, so the files keep their own convention instead of reversing it.
- **Tests Added:** No — no code changes, and no new behaviour to pin. The verification is the §6
  probe set plus the full Law-3 chain run as drift proof.
- **Verification Evidence (2026-09-27, post-edit):**

  | Probe | Result |
  | - | - |
  | `grep -c 'NOT BUILDABLE' dev/progress.md` | 1 — inside the correction notice that quotes it, not a live claim |
  | surviving `2,039`/`2,043` occurrences | 8, every one in a correction notice, a claim-vs-reality table, or the struck-through B1 |
  | `@ts-nocheck` in `dev/issues.md` | 2, both struck-through (`~~…~~ → 0`) |
  | `No CI/CD pipeline configured` | 1, struck through and replaced with the two live workflows |
  | `socket.io` mentions | 2 in each file — claim 17 preserved verbatim, as measured |
  | `Last Updated` | 2026-09-27 in both, each citing the session record |
  | U+FFFD in either file | 0 |

  Law-3 chain re-run as zero-drift proof: `npx tsc --noEmit` **exit 0**;
  `npx eslint . --max-warnings 0` **exit 0**; `npm run test:ci` **141 files / 1363 tests, 0 failed**;
  `node scripts/ledgerIntegrityCensus.cjs` **exit 0** — `4 live FID(s)`, 138 rows, 0 duplicate, 0 malformed.

- **Two defects found and recorded rather than absorbed** (Law 2), both found while auditing the two
  files and both *outside* this FID's scope of correcting stale claims:
  1. `dev/lessons-learned.md` carries a merged duplicate H1 (`# 📚 Lessons Learned - Severity-Ranked
     Reference# DarkFrame - Lessons Learned`) and a U+FFFD in a section heading. Cosmetic; now listed
     as outstanding debt in `dev/issues.md` rather than fixed inside a doc-refresh FID.
  2. **SCOPE row 13 and the code disagree about messaging.** Row 13 records that messaging moved from
     Socket.io to Ably, but socket.io is the live transport (≥5 importers under `lib/websocket/`) and
     the repository contains **0** `ably` imports. One of the two records is wrong. Recorded as an
     observation in both rewritten documents and left for the operator: deciding which is right is a
     question about the *product*, and a document refresh is not the place to settle it.

- **Not fixed here:** test coverage remains unmeasured. The previous "~15%" figure is not
  reproducible — no coverage tooling is configured — so it was relabelled unverifiable instead of
  being restated or silently replaced with a guess.
- **Archived:** 2026-09-27 — moved to `dev/fids/archive/` on commit `ee9c204`; CHANGELOG 0.0.44

---

## 9. Staging Plan (G3/G4) — EXECUTED 2026-09-27

> This FID's commit was the cleanest split in the set: it touched only the two
> documentation files, sharing no path with any other FID's work, so no hunk surgery
> was needed. It landed as **`ee9c204`** inside the six-commit plan of
> FID-20260927-005 §8. The plan as written:

This FID touches only two documentation files plus the record, and shares no file with any other
FID's commit — unlike FID-20260927-005, which shares `scripts/ledgerIntegrityCensus.cjs` with
FID-20260927-004. The split here is clean.

- `dev/progress.md`, `dev/issues.md`
- message: `docs(tracking): correct two docs that still reported a build that finished 25 days ago (FID-20260927-006)`
