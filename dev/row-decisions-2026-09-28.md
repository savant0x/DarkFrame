# Operator decision list — the remaining open SCOPE rows (2026-09-28)

**Scope:** rows 5, 6, 29, 69, 124, 125 — the six rows whose remaining work is a decision, not a defect.
**Method:** every row's factual basis re-probed 2026-09-28 (commands + outputs below). Nothing here edits a row; each item ends with concrete options and this assessment's recommendation, so a one-word reply per row closes them.

---

## Row 5 — Protocol's `Author` conflict (one-line fix, already drafted)

**Row's claim:** the protocol text lists `Author` as a required FID metadata field while the attribution rule forbids `Author:` fields.

**Re-probed 2026-09-28:**
- `dev/echo-v0.1.2-single-agent.md:337` → `Required metadata fields: **Filename**, **ID**, **Severity**, **Status**, **Created**, **Author**.` — still present.
- `dev/echo-v0.1.2-single-agent.md:35` → `**NEVER** add Author:, Fixed By:, Signed by:, or any similar attribution to documents.` — unchanged.
- `templates/FID-TEMPLATE.md:42-44` → omits the field and carries the reconciling note ("the attribution rule is non-negotiable and wins").

**Assessment:** the template already resolves the conflict in practice — every FID filed since adoption has followed it. What remains is a one-line edit to the protocol text (drop `Author` from the required-fields list, or annotate it there as the template does). This is the same class as FID-20260927-005's F8 (contract pointing at a file/field that the repo's own rules reject).

**Options:**
1. Amend the protocol's FID-Format clause to remove `Author` from the required list, citing the template's note — then close row 5. *(Recommended: zero risk, the practice is already universal.)*
2. Leave as-is; the template note is sufficient.

---

## Row 6 — SECURITY: provider-side credential rotation (operator-only action)

**Row's claim (narrowed 2026-09-27):** the hardcoded credential is gone from `drizzle.config.ts` (env-based, fail-fast); what remains open is solely whether credentials that sat in the file while it was exposed need rotating at the provider.

**Re-probed 2026-09-28:**
- `drizzle.config.ts` reads `DATABASE_URL` via `@next/env`, throws if missing; docstring example is a placeholder (`postgresql://user:pass@host:5432/db`).
- `git grep -inE "skysql"` over tracked files → only ledger prose (this row, row 7's history); zero config/code hits.
- `.env.local` is untracked and carries the live connection (key names verified only; values never read).

**Assessment:** there is no repository work left. The exposure window, and therefore the rotation obligation, dates to whenever the file was public — that predates the current history's visibility guarantees and cannot be re-derived from the repo. The DB itself has since been migrated (Supabase Postgres, `DATABASE_URL`), so the original SkySQL/MariaDB credential may now reach a decommissioned system — which lowers the urgency but does not answer it. This row also has a sibling created this week: the orphaned `ABLY_*` keys (row 13 residue, `dev/issues.md:119`).

**Options:**
1. Rotate/supersede at the provider now if the SkySQL system is still reachable; then close row 6 citing the rotation.
2. Declare the credential dead with its system (provider account closed) and close row 6 on that record.
3. Fold it into a single "credential hygiene" pass with the `ABLY_*` keys. *(Recommended: one decision session, both items.)*

---

## Row 29 — U+FFFD mojibake in docs (small, mechanical, low value)

**Row's claim:** ~14 docs/archive files carry mangled decorative emoji (U+FFFD).

**Re-probed 2026-09-28:** `git grep -c` for U+FFFD over tracked `*.md`, excluding `dev/archives` → **6 non-archive files**, 15 occurrences total: `SCOPE.md` (1 — row 29's own citation text), `dev/architecture.md` (2 — section headings (since repaired: `## 🎮 Input Handling…`, `## 🧭🎯 Design Patterns`)), `dev/lessons-learned.md` (1 — since repaired: `### 🔴 1. USE THE DATABASE'S OWN TOOLS…`), plus 3 `dev/archive/` files (12 occurrences). The same file pair also carries the duplicate H1 and U+FFFD debt already recorded in `dev/issues.md`.

**Assessment:** purely cosmetic, but the live-file hits are in *navigable headings*, so they show up in TOCs and anchor links. A mechanical sweep (replace U+FFFD with the intended emoji or strip it) is ~30 minutes and touches only headings/prose; archive files can keep their damage as history or be included for completeness.

**Options:**
1. Fix the 3 live files only (SCOPE/architecture/lessons), leave archives as historical record. *(Recommended.)*
2. Fix everything including archives.
3. Leave as recorded debt.

---

## Row 69 — Feature survey: what remains is a product roadmap, not a defect list

**Row's claim (narrowed):** P0 (missing endpoints), P1 (sabotage UI), and the P2 clan-research item all shipped (rows 70/71/72 closed). Open remainder: unstarted P2/P3 items.

**Re-probed 2026-09-28:** survey artifact present (`dev/audits/FEATURE-SURVEY-2026-09-16.md`); rows 70/71/72 confirmed closed in the ledger. The remaining P2/P3 items — battle/attack UI, territory-capture UI, shrine sacrifice/extend, tutorial/complete, specialization mastery — remain unstarted (no dedicated components; tutorial routes exist server-side with partial UI).

**Assessment:** these are features, not repairs; each is a scoping exercise of its own. Two have product-shaped questions attached (territory capture was explicitly flagged as needing a redesign; specialization mastery has zero bonus consumers — building UI for it would be the inverse of the FID-20260925-005 lesson). Recommendation: keep row 69 open as the roadmap pointer, and pick items one at a time by directive.

**Options:**
1. Keep open as the roadmap index; choose items individually when wanted. *(Recommended.)*
2. Close row 69 and track features in a fresh planning doc.
3. Pick one now (state which).

---

## Row 124 — Session-summary enforcement (option a shipped; b/c/d remain)

**Row's claim (partially actioned):** option (a) became census check D, drilled, live. Remaining: (b) check the summaries' `Last updated` header against `VERSION`; (c) retro-file the 2026-09-19..09-22 span; (d) start clean and state the convention change.

**Re-probed 2026-09-28:** check D is present and enforced (`scripts/ledgerIntegrityCensus.cjs:34-58`); nothing anywhere checks a `Last updated` header (grep over `scripts/*.cjs`, workflows → exit 1); the 2026-09-19..09-22 span still has **no summaries** (`ls dev/session-summaries/ | grep 2026-09-1[9]|2[0-2]` → empty) and **71 commits** (`git rev-list --count` over that window).

**Assessment per option:**
- **(b)** low value: the header is prose; VERSION is already the machine truth, and check D already binds closures to dated summaries. Recommend *declining*.
- **(c)** history work: 71 commits, four days, no living witness. A retro-summary would be reconstruction, not record — exactly what the ledger's evidence rules warn against. Recommend *declining* and marking the span "accepted gap" in the row.
- **(d)** effectively already the live convention: since 2026-09-24 every session files a summary (check D enforces the closure side). Recommend *adopting (d) as the formal answer* and closing the row: the convention change is stated by the cutover date check D already uses.

**Options:**
1. Adopt (d) as the formal statement, decline (b) and (c) with reasons recorded in the row, close row 124. *(Recommended — zero new gates, honest history.)*
2. Implement (b) as a census check (needs its own FID + drill).
3. Commission (c) as a documented reconstruction effort.

---

## Row 125 — SCOPE's own structure (two structural clauses remain)

**Row's claim:** three of four clauses resolved; still true that (i) one 4-column table mixes open items with the session ledger so "which items are open" is not mechanically answerable, and (ii) the `[DEFERRED]/[OUT-OF-SCOPE] — Operator-Confirmed` section still reads "(none yet)" (`SCOPE.md:1140`).

**Re-probed 2026-09-28:** both confirmed — the register is a single table from row 1 through the 130s; the deferred section's text at `:1140` is `*(none yet — this section records items only after the operator confirms a drop or deferral)*`.

**Assessment:**
- **(i)** is now *largely self-resolved in practice*: the census parses every row, reports open/closed statuses, and out-of-order/duplicate checks are live — "which items are open" is answerable by running the census, even if the table shape doesn't separate them. Splitting the register into two tables would be a large diff across every historical row edit and would break the census's line-oriented checks; the value is presentational.
- **(ii)** is trivially resolvable *by this very decision list*: rows the operator confirms declined (e.g. row 124's options b/c) are exactly the content that section was created for. Using it the first time also gives the census a second data point.

**Options:**
1. Decline the table split (census already answers the question mechanically) and seed the `[DEFERRED]` section with this week's declined options — close row 125. *(Recommended.)*
2. Commission the two-table split as its own FID (large mechanical diff, gate re-verification).
3. Keep the row open indefinitely.

---

## Summary — the one-line-per-row reply sheet

| Row | Decision needed | Recommendation |
| --- | --------------- | -------------- |
| 5 | Amend protocol FID-Format clause (drop `Author`) → close | **Do it** (1-line edit) |
| 6 | Rotate/supersede old SkySQL credential (+ fold in `ABLY_*` keys) | **Credential pass** (operator-only) |
| 29 | Fix U+FFFD in 3 live files vs leave as debt | **Fix live files** (small mechanical) |
| 69 | Keep as roadmap index vs close vs pick an item | **Keep open as index** |
| 124 | Adopt (d), decline (b)/(c) → close | **Adopt (d), decline rest** |
| 125 | Decline table split; seed `[DEFERRED]` section → close | **Decline split, seed section** |

Reply with the numbers you approve (e.g. "5, 29, 124, 125") and each gets executed as its own path-scoped change with Law-16 probes; anything declined lands in `[DEFERRED]/[OUT-OF-SCOPE]` with your reason, which is what closes row 125.
