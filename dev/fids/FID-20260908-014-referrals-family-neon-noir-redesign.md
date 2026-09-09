# FID-20260908-014: Referrals family — full neon noir structural redesign

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-014-referrals-family-neon-noir-redesign.md`
**ID:** FID-20260908-014
**Severity:** MEDIUM (display-debt; the census's second-worst family at 101 banned-class instances)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

The referrals family (page shell + guide tab, dashboard, leaderboard — 1,050 lines) still carries
101 banned-class instances (`bg-glass-light` ×25, `bg-glass-dark` ×17, `text-text-primary` ×32,
`text-text-secondary` ×27), 13 decorative gradients (5 of which are same-color no-ops like
`from-cyan to-cyan`), 2 un-gated `animate-spin` loaders, one doubled background class, and a
doubled `color-mix` in the leaderboard row. Per operator mandate, migration is **by hand, file by
file** — no scripted bulk rewrite. `components/FlagTrackerPanel.tsx` mentions referrals only in a
bonus list and is already token-clean (out of scope).

## 2. Evidence (RED)

### 2.1 Banned-class census (pre-migration)

| File | Lines | Instances |
| ---- | ----- | --------- |
| app/referrals/page.tsx | 321 | 42 |
| components/ReferralDashboard.tsx | 436 | 36 |
| components/ReferralLeaderboard.tsx | 293 | 23 |
| **Total** | 1,050 | **101** |

Plus: 13 `bg-gradient-to-*` (5 same-color no-ops: `cyan→cyan`, `green→green`, `amber→amber` ×2,
plus one inside a row ternary), 2 un-gated `animate-spin`, 1 doubled
`bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(...)]` in
ReferralLeaderboard row ternary, 1 doubled background class in ReferralDashboard share button,
`rounded-full` pill/badge chrome throughout.

Kit imports: 0. framer-motion: 0. (Family is kit-free; debt is raw Tailwind classes only.)

### 2.2 Content cross-check (Method-2 diligence)

GuideTab's milestone table re-verified against `lib/referralService.ts` `REFERRAL_MILESTONES`
before rewrite: all 8 rows match exactly (1st/3rd/5th/10th/15th/25th/50th/100th — amounts, titles,
badges, special rewards). The non-monotonic metal curve (25th=750k > 50th=625k > 100th=150k) is
**intentional** per the config's own strategy comment ("CONSERVATIVE … RP Strategy: ~12k total");
50th/100th trade metal for massive RP/XP (1,500/3,000 RP, 200k/500k XP). No content change.

## 3. Impact Analysis

- **Affected:** 3 files restyled; all data-fetch, copy-to-clipboard, share-window, pagination, and
  auth-redirect logic byte-preserved.
- **Blast radius:** none server-side; pure client chrome. No API contract touched.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — post-migration census of the 3 files must be 0 banned classes / 0 gradients / 0 un-gated spins |
| Scales? | Yes — same primitives as every prior family; no family-specific tokens needed |
| Hostile attacker? | N/A (display); copy/share flows unchanged |
| Maintainable? | Yes — single token system; local per-file data-derivation helpers kept |
| Industry standard? | Yes — same rubric as FID-006 program |

## 5. Proposed Fix (GREEN)

Hand-migrate file by file (operator mandate), each file verified by diff re-read + tsc before the
next:

1. **app/referrals/page.tsx** — gradient `bg-gradient-to-br from-bg-space via-… to-bg-space` shell →
   flat `var(--nn-void)` shell (help-page idiom: inline style, `BackButton`, Orbitron `nn-num`
   page title); gradient `bg-clip-text` hero → flat `nn-num nn-text-cyan` title; tab strip
   (gradient active state + emoji labels) → `nn-tab` row (`nn-tab--on`), tab labels de-emojified;
   GuideTab: gradient slabs → `nn-panel` sections with domain-accent scanline headers
   (Overview=violet, Steps/Rewards/FAQ=cyan, Tips=green), numbered steps → `nn-row` with `nn-chip`
   ordinals, reward/milestone/FAQ blocks → `nn-well` cells, inline highlighted numerals →
   `nn-num`/`nn-text-*`, ✓/❓/💡 chrome removed.
2. **components/ReferralDashboard.tsx** — header/milestone/rewards gradient slabs → `nn-panel`;
   stat trio → `nn-stat` instruments with `nn-stat__num--glow-*`; milestone progress
   (`rounded-full h-4` bar + gradient fill) → `nn-meter` + `nn-meter__seg--vio`; copy buttons →
   `nn-btn`/`nn-btn--primary`; share buttons → `nn-btn`/`nn-abtn` pair; read-only code/link inputs →
   `nn-input` with `nn-num`; badges/titles pills → `nn-chip` variants (amber badges, violet titles);
   referral rows → `nn-surface--dark` rows with `nn-chip--green`/`nn-chip--amber` status;
   `animate-spin` → gated `nn-spin-icon` (AchievementPanel idiom); reward numerals → `nn-num`.
3. **components/ReferralLeaderboard.tsx** — header gradient slab → `nn-panel--violet` scanline
   header; rank table → `nn-table` (thead auto-styled; player-row highlight via token violet tint);
   doubled background class fixed (single tint); badge chips → `nn-chip` (dedicated amber); medal
   emoji retained (game imagery, matches in-world iconography ruling from FID-012); Load More →
   `nn-btn`; milestone reference cards → `nn-well` grid; `animate-spin` → `nn-spin-icon`.
4. **Gates:** tsc 0 · eslint 0 (3 files) · full vitest · census greps 0.

**Verification plan:** per-file diff re-read against HEAD during migration; final rubric census +
full gates; Method-2 re-read of all three files.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest / rubric greps | *(pasted at implementation)* | pass |
| Method 2: manual re-read | logic diff = 0; milestone table vs REFERRAL_MILESTONES; class-by-class census | *(pasted at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied:**
  - **app/referrals/page.tsx** — gradient `bg-gradient-to-br from-bg-space via-… to-bg-space` shell →
    flat `var(--nn-void)` shell with BackButton + Orbitron `nn-num` page title (help-page idiom);
    gradient `bg-clip-text` hero → flat `nn-num nn-text-cyan` title; gradient active-tab slab →
    `nn-tab`/`nn-tab--on` row (ARIA tablist/tab/selected added; emoji labels removed);
    GuideTab rebuilt: 4 gradient slabs → `nn-panel` sections with scanline headers (overview=violet,
    steps/rewards/FAQ=cyan, tips=amber panel), numbered steps → `nn-row` + `nn-chip` ordinals,
    reward list/milestones/FAQ → `nn-well` cells with `nn-num`/`nn-footnote` text, ✓/❓/💡 chrome
    removed. Milestone table verified 8/8 against `REFERRAL_MILESTONES` — **figures unchanged**
    (non-monotonic 750k→625k→150k curve is intentional per the config's strategy comment).
  - **components/ReferralDashboard.tsx** — 3 gradient header slabs → `nn-panel` scanline headers;
    stat trio → `nn-stat` instruments with glow numerals; `rounded-full h-4` progress bar + gradient
    fill → `nn-meter` + `nn-meter__seg--vio` (ARIA progressbar added); copy buttons → `nn-btn--primary`;
    share pair → `nn-btn`; read-only code/link inputs → `nn-input` + `nn-num`; badges/titles pills →
    `nn-chip--amber`/`nn-chip--violet`; referral rows → `nn-surface--dark` with
    `nn-chip--green`/`nn-chip--amber` status; error state → `nn-note`; reward numerals → `nn-num`
    glow set; un-gated `animate-spin` → `Loader2` + gated `nn-spin-icon` (proper glyph idiom);
    doubled background class on the share row fixed.
  - **components/ReferralLeaderboard.tsx** — gradient header slab → `nn-panel--violet` scanline
    header; rank table → `nn-table` (thead auto-styled by the primitive); doubled
    `bg-[color-mix(...)] bg-[color-mix(...)]` in the current-player row ternary → single token violet
    tint (inline style on the row); badge pills → `nn-chip--amber`; "YOU" pill → `nn-chip--violet`;
    Load More → `nn-btn--primary`; milestone reference → `nn-well` grid; `animate-spin` →
    `Loader2` + `nn-spin-icon`; medal/rank emoji retained (game imagery, per FID-012 ruling).
  - **Companion fixes (FID-011 residue):** AchievementPanel + InventoryPanel used **empty spans**
    with `nn-spin-icon` — the primitive only animates, it renders nothing, so both loaders were
    visually absent. Both now render `Loader2` glyphs carrying `nn-spin-icon` (the idiom used by
    ClanChatPanel/ModerationPanel since FID-010).
  - **Bonus lint hygiene:** the two pre-existing `(ref: any)` / `(entry: any)` API-mapping callbacks
    now typed against the real wire shapes (`ValidatedReferralPayload` derived from
    `types/referral.types` ReferralRecord; `LeaderboardRowPayload` from the route's projection) —
    the pre-existing `any`s the operator's standard requires remediating en route.
  - **Logic preservation:** data-fetch, clipboard, share-window, auth-redirect, and pagination logic
    byte-preserved — handler census identical HEAD↔working on all three files (page 1/1, dashboard
    5/5, leaderboard 1/1).
- **Gates:** tsc 0 · eslint 0 (family + 2 companions) · full vitest **362 passed / 0 failed / 1
  skipped** · rubric census: 0 banned classes, 0 gradients, 0 un-gated spins across all 3 files.
- **Audit Method 2:** per-file diff re-read during hand migration; handler census HEAD↔working;
  milestone figures re-derived from `lib/referralService.ts` (8/8 match); retention check —
  FlagTrackerPanel's referral mention is a data string, not styling (out of scope, correct).

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] rubric census 0
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/referrals/page.tsx components/ReferralDashboard.tsx components/ReferralLeaderboard.tsx dev/fids/FID-20260908-014-referrals-family-neon-noir-redesign.md dev/fids/FID-20260908-006-neon-noir-full-internal-redesign.md dev/session-summaries/SESSION-2026-09-08-002.md`
- **Follow-through (proposed, not executed):** Wave B continues with profile (55) + messages (51);
  admin family (~40) after.
