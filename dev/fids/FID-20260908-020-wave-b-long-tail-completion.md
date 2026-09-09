# FID-20260908-020: Wave B long tail — full-app rubric completion + Phase 7 re-audit

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-020-wave-b-long-tail-completion.md`
**ID:** FID-20260908-020
**Severity:** MEDIUM (final closure of the neon-noir program; ~78 residue instances across 32 files)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

The Phase 7 pre-audit census shows 32 files still carrying banned-pattern hits
(~78 instances). The overwhelming majority are **single-site residues left by the
earlier waves** — the waves migrated each file's dominant debt but its census
pattern was narrower than the final rubric (raw `focus:border-blue/purple-500`
inputs, un-gated `animate-spin`/`animate-pulse`, residual `text-text-*` tokens).
Four files are **comment-only false positives** (they merely *describe* retired
classes). This FID closes every last instance hand-migrated, then runs the Phase 7
re-audit to certify the program complete.

## 2. Evidence (RED) — census by defect family

- **Comment-only false positives (4):** `InventoryPanel.tsx:482`,
  `AuctionHousePanel.tsx:547`, `SafeHtmlRenderer.tsx:50` (comment + italic note),
  `help/page.tsx:12`, `ChatMessage.tsx:528` (comment) — no real sites.
- **Raw focus-border inputs (~14 sites / 7 files):** StatsViewWrapper ×4,
  BattleLogViewer ×3, BotMagnetPanel ×2 (also raw `bg-slate-700`), auto-farm
  settings ×2, LeaderboardPanel/View ×1 each, UnitBuildPanelEnhanced ×1,
  ShrinePanel ×1 (`focus:border-purple-400`), test/websocket ×1. → `nn-input`.
- **Un-gated spinners (8):** LeaderboardPanel/View CSS divs + emoji spans,
  BattleLogViewer, ReputationPanel, HotkeyManagerPanel, BountyBoardPanel,
  AddFriendModal, ChatPanel ×5 `Loader2 … animate-spin`, BankPanel context.
- **Un-gated pulses (~11):** TopNavBar ×2 (VIP Sparkles, WMD dot — meaningful
  states to gate), FlagTrackerPanel ×3, WMDMiniStatus, BountyBoardPanel Gift,
  TutorialQuestPanel CheckCircle, clan family ×4, ChatPanel connection dot,
  test/websocket status dot.
- **Legacy token layer:** BankPanel ×12 (`bg-bg-tertiary`, `border-border-main`,
  `focus:border-accent-primary`, `text-text-*`), ConfirmDialog ×3
  (`bg-glass-darker`, `border-glass-border`, `text-text-*`, `shadow-glow-cyan-sm`),
  SafeHtmlRenderer, specialization page ×3.
- **VIP success page:** un-gated `animate-fade-in` + `shadow-2xl
  shadow-green-500/50` raw; `animate-pulse-scale` is a globals-owned, universally
  gated utility — **documented exception**.
- **game/page.tsx:900:** toast with `animate-fade-in` + chrome `shadow-lg`.

## 3. Impact Analysis

- Files touched: ~28 TSX + 1 comment-only note where warranted. No CSS changes
  expected (all primitives/gated utilities exist).
- Risk: game shell surfaces (TopNavBar, ChatPanel, StatsViewWrapper) are
  high-traffic; only class-level changes, handlers untouched.
- No API/schema changes.

## 4. Five Questions

1. **Root cause?** Earlier waves' census patterns predated the final rubric;
   their residue is the long tail.
2. **Reproduce?** the full-app census grep (§2 families).
3. **Smallest correct fix?** Primitive swaps only: `nn-input`, gated spin/pulse
   classes, token text/borders; ConfirmDialog keeps its public API, changes
   chrome classes only.
4. **Verify?** Per-file tsc between edits; family eslint on touched dirs; census
   greps; handler census HEAD↔working on all touched files; full vitest.
5. **Side effects?** Reduced-motion users gain correct behavior; Comment-only
   files get no functional change.

## 5. Proposed Fix (GREEN)

1. Comment-only files: no code change (census note only).
2. Raw-focus inputs → `nn-input` (imports added by hand where missing).
3. Un-gated spinners → `Loader2` + `nn-spin-icon` (emoji variants retired);
   pulses → gated `nn-pulse` per-site.
4. BankPanel/ConfirmDialog/SafeHtmlRenderer/specialization → token layer
   (`--nn-text-*`, token borders/backgrounds, token glow).
5. VIP success/game toast → gated `nn-fade`, token glows; `animate-pulse-scale`
   retained (documented exception).
6. Phase 7 re-audit: full-app census must return zero real sites; produce the
   program scorecard in FID-006 §9.

## 6. Audit Record

*(pasted at implementation)*

## 7. Implementation Record

*(pasted at implementation)*

## 8. Closure

- **Gates:** [ ] typecheck 0 · [ ] lint 0 (touched) · [ ] tests pass · [ ] census 0 real sites
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add` the touched files (full list finalized in §7) plus
  this FID, FID-006, and the session log.
- **Follow-through:** Phase 7 re-audit scorecard; then the program is complete.
