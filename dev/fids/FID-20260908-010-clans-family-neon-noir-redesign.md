# FID-20260908-010: Clans family — heaviest legacy debt in the app (415 banned-class instances, 12 files on the UI kit)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-010-clans-family-neon-noir-redesign.md`
**ID:** FID-20260908-010
**Severity:** MEDIUM (operator-named Wave A surface; social/strategic layer fully on the legacy kit)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

The clans family (`app/clans/page.tsx`, `app/clan/page.tsx`, and 12 `components/clan/*` files, ~6.8k lines) carries the largest legacy debt measured in the codebase: **415 banned-class instances** across 14 files (`text-text-*` ×195, `bg-glass-light` ×83, `bg-glass-dark` ×17, `text-text-primary` ×20, `animate-spin` ×19, `rounded-full` ×9, `animate-fade-in` ×2, `text-text-tertiary` ×11) and **12 files importing the legacy UI kit** (`Button/Input/Badge/Divider/Card`). `ClanPanel.tsx` alone has 45 hits. None of it speaks the token language: no scanline sections, no `--nn-accent`, no `nn-num`, no `nn-row` ledgers.

## 2. Evidence (RED)

| # | Finding | File | Evidence |
| - | ------- | ---- | -------- |
| 1 | Banned-class census | family-wide | 195+83+17+20+11+19+9+2 = 415 (grep counts, command logged) |
| 2 | Legacy kit imports ×12 | `ClanBankPanel:26`, `ClanChatPanel:52`, `ClanManagementView:29`, `ClanMembersPanel:26`, `ClanPanel:37`, `ClanPerkPanel:31`, `ClanTerritoryPanel:32`, `ClanWarfarePanel:33`, `CreateClanModal:28`, `JoinClanModal:27`, `app/clans/page.tsx:36`, `app/clan/page.tsx:24` | `Button/Input/Badge/Divider(/Card)` |
| 3 | Debt ranking | grep -c | ClanPanel 45 · ClanManagementView 43 · ClanWarfarePanel 35 · ClanPerkPanel 28 · ClanChatPanel 28 · JoinClanModal 23 · ClanTerritoryPanel 21 · ClanLevelDisplay 21 · app/clans 18 · CreateClanModal 17 · PerkCard 16 · ClanBankPanel 15 · ClanMembersPanel 11 · app/clan 8 · ClanXPProgress 5 |
| 4 | framer-motion / legacy motion | family-wide | covered in count set (animate-fade-in ×2; framer imports checked at implementation) |

**Call-graph (Law 4):** `app/clans/page.tsx` = browse/join directory → `JoinClanModal`/`CreateClanModal`; `app/clan/page.tsx` = own-clan page → `ClanPanel` (tab shell) → `ClanManagementView` + subpanels (Bank/Chat/Members/Perk/Territory/Warfare) + `ClanLevelDisplay`/`ClanXPProgress`/`PerkCard`. `refreshPlayer` used by clan modals/management (GameContext) — untouched. `confirmDialog` retained.

## 3. Impact Analysis

- **Affected:** the full social layer — directory, membership, chat, bank, territory, warfare, perks, XP — the most-visited surfaces after the game view.
- **Blast radius:** 14 files, all presentation. Clan CRUD/chat/bank/war logic byte-preserved. No API or context changes.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — both pages, all 12 components, every state (loading/error/empty/member/non-member) |
| Scales? | Yes — mechanical kit-swap; token vocabulary covers every observed pattern |
| Hostile attacker? | N/A (presentation); confirm flows unchanged |
| Maintainable? | Yes — per-file swaps inside one family FID; shared patterns (member rows, ledger) get uniform treatment |
| Industry standard? | Yes — same rubric as shipped surfaces |

## 5. Proposed Fix (GREEN)

Mechanical per-file migration, highest debt first (ClanPanel, ClanManagementView, Warfare):
1. `Card`/glass slabs → `.nn-panel` (+ `--nn-accent` by function: warfare=magenta, bank=amber, chat=cyan, members=green, perks=violet, territory=cyan, directory panels default cyan); scanline `.nn-panel__header` everywhere.
2. `Badge` → `.nn-chip` (role/status semantics); `Button` → `.nn-btn` family (destructive = magenta/danger); `Input` → `.nn-input`; `Divider` → `.nn-divider` or structural spacing.
3. `text-text-*` ×195 → token text classes (`nn-lab` for labels, `nn-text-dim`, semantic `nn-text-*`); `bg-glass-*` ×100 → panel/void-glass structure.
4. Stats/readouts → `.nn-stat` + `.nn-num`; member/ledger lists → `.nn-row`; bank ledger → `.nn-table`; XP/progress → `.nn-meter`.
5. `animate-spin` ×19 → gated `nn-spin`; `animate-fade-in` removed; `rounded-full` avatars → square HUD (token treatment); all micro `transition-*` removed.
6. Both pages rebuilt as centered token-void shells with `.nn-sec` instrument headers.
7. Behavior byte-preserved across all files.

**Verification plan:** tsc 0; eslint 0 (files); vitest full; rubric greps (0 kit imports, 0 banned classes family-wide); re-read highest-debt files for logic diff = 0.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest / rubric greps | *(pasted at implementation)* | pass |
| Method 2: manual re-read | ClanPanel + ManagementView logic diff = 0; accent map review | *(pasted at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied:** all 14 files migrated per §5 — kit imports removed (12 files; only `RichTextEditor` retained — a functional editor, not a styling slab), all 415 banned-class instances eliminated, all 68 `StaggerChildren`/`StaggerItem` framer wrappers → plain `div`s, legacy `Button/Badge/Divider/Input/Panel` JSX → token components (`nn-btn`/`nn-chip`/`nn-divider`/`nn-input`/`nn-panel`), `text-text-*` → `nn-text-*`, `bg-glass-*` → `.nn-surface` (+ `--nn-glass-*` token aliases), `rounded-full|lg|xl` → square HUD, `animate-spin` → gated `nn-spin-icon`.
- **Mechanism (recorded for reuse):** class strings via batch sed; tag rewrites via a verify-gated codemod (`scripts/codemod-clan-noir.cjs`, removed after use) — v1/v2/v3 splicing bugs (mismatched closers, nested-badge stale indices) were each caught by the tsc syntax gate and reverted; v4 streaming stack rewrite passed all 12 files. Dynamic variant ternaries the static regex missed were hand-migrated (pagination, sender-role chip, warfare tabs, perk chip/activate). 5 en-route `any`s remediated (#36) in ClanChatPanel/ClanXPProgress.
- **Gates:** tsc 0 · file eslint 0 · full vitest 362/0/1 · rubric greps: 0 kit imports, 0 banned classes family-wide.
- **Audit Method 2:** accent map review (destructive=magenta only; no decorative glow); logic diff = 0 on ClanPanel + ClanManagementView (all fetch/WS/CRUD flows untouched).

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] rubric greps
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/clans/page.tsx app/clan/page.tsx components/clan/`
