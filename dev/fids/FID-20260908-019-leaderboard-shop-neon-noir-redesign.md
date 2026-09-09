# FID-20260908-019: Leaderboard + shop neon-noir remediation — legacy layer, gradient no-ops, un-gated spin

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-019-leaderboard-shop-neon-noir-redesign.md`
**ID:** FID-20260908-019
**Severity:** MEDIUM (two player-facing commerce/progression surfaces on legacy classes; shop sells real packages)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

Phase 6 census attributed 27 instances to leaderboard and 16 to shop. RED confirms
four files: `app/leaderboard/page.tsx` (27), `app/shop/rp-packages/page.tsx` (26),
plus 4 residues each in the FID-013-migrated `ClanLeaderboardPanel/View` (gray-950
modal shells, a gradient `bg-clip-text` hero, un-gated `animate-spin`, and a raw
`shadow-cyan-500/20`). The shop additionally carries **three same-color gradient
no-ops in its package data** (`green→green`, `cyan→cyan`, `amber→amber`), two
self-canceling hovers, a doubled background class, and a same-color hover on the
VIP CTA button — the exact defect families the earlier waves established.

## 2. Evidence (RED)

- `app/leaderboard/page.tsx` — 3× `bg-glass-dark` shells; 2× self-canceling
  `bg-glass-light hover:bg-glass-light`; un-gated `animate-spin` (CSS div AND an
  emoji span); `text-text-primary/secondary` ×14; search input with
  `focus:border-blue-500`; `disabled:bg-glass-light`; table on `bg-glass-light`
  shells + `divide-glass-border` + `hover:bg-glass-light` rows.
- `app/shop/rp-packages/page.tsx` — 2× `from-bg-space to-bg-nebula` gradient
  shells; triple-stop hero gradient (`amber via amber to magenta` — a same-color
  pair inside a "gradient"); data gradients `from-X to-X` ×3 (no-ops);
  `bg-glass-light` ×5; `border-glass-border` + `hover:border-glass-border`
  (self-canceling); doubled `bg-[color-mix(...)] bg-[color-mix(...)]` on the
  purchase button; popular strip/button `amber→amber`; VIP CTA gradient +
  same-color hover; `shadow-yellow-500/50` raw; `text-text-*` ×9.
- `ClanLeaderboardPanel.tsx` / `ClanLeaderboardView.tsx` — `from-gray-950
  via-gray-900 to-black` modal shells; gradient `bg-clip-text` titles;
  un-gated `animate-spin` on `Loader2`; `shadow-lg shadow-cyan-500/20`.

## 3. Impact Analysis

- Files touched: 4 TSX. No CSS changes required (all needed primitives exist).
- Risk: shop is commerce — purchase handler, VIP math, and result-string ternary
  (`startsWith('✅'/'🚧')`) are logic and will not be touched.
- No API/schema changes.

## 4. Five Questions

1. **Root cause?** Both pages predate the FID-010 token wave; the leaderboard pair
   was FID-013's kit migration, which fixed components but not their shell chrome.
2. **Reproduce?** `grep -rnE "bg-glass|text-text-|border-glass|bg-gradient|animate-spin|shadow-(lg|yellow)" app/leaderboard app/shop components/ClanLeaderboard*`
3. **Smallest correct fix?** Token-shell + primitive migration; shop package
   `color` field becomes a flat token accent rendered via inline `color-mix`
   (MapLegend data-color precedent); all animations gated.
4. **Verify?** Per-file tsc; family eslint; census greps; handler census
   HEAD↔working; full vitest.
5. **Side effects?** Rank/medal emojis retained as game imagery (FID-014
   precedent); decorative heading emojis removed per chat/messages idiom.

## 5. Proposed Fix (GREEN)

1. `app/leaderboard/page.tsx` — `var(--nn-void)` shells; `nn-table` ledger
   (token hover built in); `nn-input` search; `nn-btn--primary/--ghost`;
   `Loader2` + `nn-spin-icon`; token text; medals retained in-table.
2. Clan leaderboard pair — modal shells → `var(--nn-void)`; titles → Orbitron
   token; spins gated; tab glow → token shadow.
3. `app/shop/rp-packages/page.tsx` — void shells; `nn-panel` sections (violet for
   VIP CTA); balance box → `nn-panel--amber`; package cards → `nn-surface--dark`
   + flat accent header band (data-driven inline `color-mix`); purchase buttons →
   `nn-btn--amber`/`--primary`; FAQ → `nn-panel` + `nn-well`-style rows; token
   text/glow throughout; doubled class and self-canceling hovers eliminated.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint (family) / vitest / rubric greps | tsc 0 · family eslint 0 · vitest 362/0/1 · census 0 | pass |
| Method 2: manual re-read | per-file tsc between edits; handler census HEAD↔working | 9/9, 3/3, 15/15, 12/12 — identical | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete — hand-migrated file by file (no scripts), per-file tsc verification between each.
- **Changes applied:**
  1. `app/leaderboard/page.tsx` — 3 `bg-glass-dark` shells → `var(--nn-void)`; loading spinner (un-gated CSS div) → `Loader2` + gated `nn-spin-icon`; the Refresh button's un-gated emoji spin → `Loader2` glyph gated per-state; error state → `nn-panel` with `nn-btn--primary`/`--ghost`; search input (`focus:border-blue-500`) → `nn-input`; rank table → `nn-table` ledger (token hover built in; row tint on current player kept); `text-text-*` ×14 → tokens; both self-canceling `bg-glass-light hover:bg-glass-light` buttons → token buttons; `disabled:bg-glass-light` → token disabled opacity. Medal/rank emojis retained in-table as game imagery (FID-014 precedent).
  2. `components/ClanLeaderboardPanel.tsx` + `ClanLeaderboardView.tsx` — `from-gray-950 via-gray-900 to-black` modal shells → `var(--nn-void)` + token glow; gradient `bg-clip-text` heroes → Orbitron token titles; un-gated `Loader2 … animate-spin` → gated `nn-spin-icon`; CategoryButton **corrupted inactive branch repaired** — six stacked classes (active + inactive styles merged, an earlier automated-pass defect) → clean two-state ternary with token shadow replacing raw `shadow-lg shadow-cyan-500/20`.
  3. `app/shop/rp-packages/page.tsx` — 2 `from-bg-space to-bg-nebula` shells → `var(--nn-void)`; triple-stop hero (`amber via amber to magenta`) → Orbitron token title; **package data gradients re-modeled**: `color` field held Tailwind gradient strings with 3 same-color no-ops (`green→green`, `cyan→cyan`, `amber→amber`) → now holds a single accent token (`var(--nn-green/cyan/violet/magenta/amber)`), rendered as a flat `color-mix` header band (MapLegend data-color precedent — the violet→magenta and amber→magenta two-stop *combos* collapsed to their dominant accent, a deliberate rubric call recorded here); popular strip `amber→amber` → flat amber band with void text; package cards → `nn-surface--dark`; purchase buttons → `nn-btn--amber`/`--primary` (doubled identical `bg-[color-mix]` class fixed); VIP CTA gradient panel + same-color-hover gradient button → `nn-panel--violet` + `nn-btn--amber`; balance box → amber-accented `nn-panel`; FAQ → `nn-panel` + token `FAQItem`; FreeSourceCard → `nn-surface--dark`; `text-text-*` ×9 → tokens; raw `shadow-yellow-500/50` → token amber glow. Purchase handler, VIP math, and result-string ternary untouched.
- **Gates:** tsc 0 · eslint (family) 0 · vitest **362 passed / 0 failed / 1 skipped** · rubric census **0** across all four files.
- **Audit Method 2:** handler census identical HEAD↔working on all four files.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 (family) · [x] tests pass · [x] rubric census 0
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/leaderboard/page.tsx app/shop/rp-packages/page.tsx components/ClanLeaderboardPanel.tsx components/ClanLeaderboardView.tsx dev/fids/FID-20260908-019-leaderboard-shop-neon-noir-redesign.md dev/fids/FID-20260908-006-neon-noir-full-internal-redesign.md dev/session-summaries/SESSION-2026-09-08-002.md`
- **Follow-through (proposed, not executed):** remaining legacy-token-layer
  consumers (specialization, BankPanel, SafeHtmlRenderer, ConfirmDialog) and the
  Phase 7 re-audit.
