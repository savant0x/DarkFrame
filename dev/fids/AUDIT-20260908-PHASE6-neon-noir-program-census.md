# Phase 6 Program Audit — NEON NOIR Adoption Census (final)

**ID:** AUDIT-20260908-PHASE6
**Date:** 2026-09-08
**Scope:** `app/`, `components/` — excludes `dev/archive`, `docs`, `*_OLD`, `components/ui/` (the legacy kit itself), `components/transitions/` (framer shims)
**Baseline reference:** FID-20260908-006 §9 + session 002 records

---

## 1. Executive summary

The rubric-critical surfaces named by the operator (game shell, unit-factory, factory management, stats, tech-tree, WMD family, clans family, login, register, BackButton) are **rubric-clean**: 0 kit imports, 0 banned classes in those families.

The long tail remains. The remaining debt is concentrated, enumerable, and dominated by three mechanical patterns. **Total: 552 banned-class instances across 60 files**, plus:

| Pattern | Files | Notes |
| ------- | ----- | ----- |
| Banned classes (`text-text-*`, `bg-glass-*`, `bg-bg-*`, `rounded-lg/xl/full`, `animate-spin/fade-in`) | 60 | 552 instances |
| Inline gradients (`bg-gradient-to`, `bg-clip-text`) | 43 | includes 12 files with 4+ hits |
| Legacy kit imports (`Card/Panel/Button/Badge/Divider/Input` from `@/components/ui`) | 24 | ~11 with styling symbols, rest retention-only |
| framer-motion / transitions wrappers | 6 | `ClanLeaderboardPanel/View`, `AchievementPanel`, `DiscoveryLogPanel`, `SpecializationPanel`, `TierUnlockPanel` |
| `animate-spin` (un-gated) | 31 | should all become gated `nn-spin-icon` |

Deliberate retentions (NOT debt): `ConfirmDialogHost` in `app/layout.tsx`, `confirmDialog` helpers (token-adjacent shared dialog), `RichTextEditor` (functional editor).

## 2. Debt ranking — banned classes (top 20 files)

| # | File | Hits | Dominant pattern |
| - | ---- | ---- | ---------------- |
| 1 | `app/help/page.tsx` | 97 | `bg-glass-light` ×31, `text-text-secondary` ×34 |
| 2 | `components/ReferralDashboard.tsx` | 46 | |
| 3 | `app/referrals/page.tsx` | 45 | |
| 4 | `app/profile/ProfileView.tsx` | 40 | |
| 5 | `app/leaderboard/page.tsx` | 27 | |
| 6 | `components/ReferralLeaderboard.tsx` | 25 | |
| 7 | `app/map/page.tsx` | 25 | |
| 8 | `components/messaging/MessageInbox.tsx` | 23 | |
| 9 | `components/TileRenderer.tsx` | 20 | + 9 gradients (game-critical tile view) |
| 10 | `components/AuctionHousePanel.tsx` | 19 | |
| 11 | `app/shop/rp-packages/page.tsx` | 16 | + 9 gradients |
| 12 | `app/profile/[username]/page.tsx` | 15 | |
| 13 | `app/messages/page.tsx` | 15 | |
| 14 | `components/BankPanel.tsx` | 14 | |
| 15 | `components/messaging/MessageThread.tsx` | 13 | |
| 16 | `components/InventoryPanel.tsx` | 13 | |
| 17 | `components/admin/ClanInspectorModal.tsx` | 10 | |
| 18–50 | (47 further files with 1–9 hits) | ~90 | see census command |

*(full enumeration commands in §5)*

## 3. Categorization

### 3.1 Wave B surfaces (operator-visible pages, structural redesign needed)
| Surface | Files | Debt (classes) | Gradients | framer |
| ------- | ----- | -------------- | --------- | ------ |
| help | `app/help/page.tsx` | 97 | ✓ | — |
| referrals family | `app/referrals/page.tsx`, `ReferralDashboard`, `ReferralLeaderboard`, `app/admin/referrals` | ~95 | ✓ | — |
| profile family | `app/profile/ProfileView.tsx`, `app/profile/[username]` | 55 | ✓ | — |
| leaderboard standalone | `app/leaderboard/page.tsx` | 27 | — | — |
| messages/messaging | `app/messages/page.tsx`, `MessageInbox`, `MessageThread` | ~51 | ✓ | — |
| shop (RP packages) | `app/shop/rp-packages/page.tsx` | 16 | 9 | — |
| map view | `app/map/page.tsx`, `ZoomControls`, `MapLegend` | 35 | ✓ | — |
| vip-upgrade | `app/game/vip-upgrade/*` | low | ✓ | — |

### 3.2 Game-shell panels (mounted by `/game` — visible in the primary play loop)
| Panel | Classes | kit | framer |
| ----- | ------- | --- | ------ |
| `TierUnlockPanel` | low | Card | ✓ |
| `AuctionHousePanel` | 19 | — | — |
| `InventoryPanel` | 13 | — | — |
| `DiscoveryLogPanel` | low | Panel | ✓ |
| `AchievementPanel` | low | Card | ✓ |
| `SpecializationPanel` | 3 | Card | ✓ |
| `BotMagnetPanel` / `BotSummoningPanel` / `BountyBoardPanel` / `BeerBasePanel` | low | — | — |
| `TileRenderer` | 20 | — | — (+9 gradients; game-critical, changes affect the play loop) |

### 3.3 Admin family (internal tooling — lower priority by function)
`AdminView`, `ModerationPanel`, `PlayerDetailModal`, `ClanInspectorModal` (+4 inspector modals), 5 `admin/charts/*` files, `app/admin/vip`, `app/admin/referrals`. ~40 instances total, kit symbols in 3 files.

### 3.4 Token gaps (infrastructure — small, high-leverage)
- ~~`nn-fade` referenced but undefined~~ **FIXED during this audit**: `@keyframes nn-fade` + gated `.nn-fade` added to `neon-noir.css` (the FID-010 sed pass emits the class; it was silently unanimated before).
- No `.nn-avatar` primitive (avatars currently square via `rounded-none` aliases) — add when profile family enters Wave B.
- `Button.tsx` kit remains the dependency of `LoadingSpinner`/`PageTransition` shims — retiring `components/transitions/` removes framer from the bundle for good.

### 3.5 Deliberate retentions (documented, not debt)
- `confirmDialog` / `ConfirmDialogHost` — shared modal host, token-adjacent.
- `RichTextEditor` (ClanManagementView) — functional editor.
- `components/ui/*` + `components/transitions/*` themselves — retired once consumers hit zero (see §4 sequence).

## 4. Recommended remediation sequence (Wave B→C)

1. **Token gap fixes first** (30 min): verify `nn-fade` exists; add `.nn-avatar`; pre-flight the codemod classes for `bg-bg-*`/`border-border-*` mappings (not needed in clans family, needed in long tail).
2. **Game-shell panels** (highest visibility per effort): TierUnlock, Auction, Inventory, DiscoveryLog, Achievement, Specialization, TileRenderer gradients. Reuses the proven v4 codemod + sed pass.
3. **Wave B pages** (structural, one FID per family): help, referrals, profile, messages, leaderboard, shop, map, vip-upgrade.
4. **Admin family last** (internal tooling): single FID, mechanical.
5. **Retire the dead kit**: once consumers = 0, delete `components/ui/` styling components + `components/transitions/`, dropping framer-motion from the client bundle. `ui/ConfirmDialog` and `RichTextEditor` move to `components/` proper.

**Estimated remaining scope:** comparable to the clans family (~1 FID-day per major family with the codemod pipeline).

## 5. Reproduction commands

```bash
# banned classes per file
grep -rcE "text-text-[a-z]+|bg-glass-[a-z]+|border-glass-border|bg-bg-[a-z]+|border-border-[a-z]+|bg-gray-[0-9]|bg-primary-[0-9]|animate-spin|animate-fade-in|rounded-(lg|xl|full)" --include="*.tsx" app components | grep -v ":0$" | grep -vE "_OLD|archive|components/ui/|components/transitions/"

# kit imports with styling symbols
grep -rln "@/components/ui" app components --include="*.tsx" | grep -vE "_OLD|archive|components/ui/|components/transitions/"

# gradients
grep -rln "bg-gradient-to\|bg-clip-text" app components --include="*.tsx" | grep -vE "_OLD|archive|components/ui/|components/transitions/"

# framer / transitions
grep -rln "framer-motion|components/transitions" app components --include="*.tsx" | grep -vE "_OLD|archive|components/ui/|components/transitions/"
```

## 6. Verification of clean surfaces (spot re-check this audit)

- clans family: 0 banned classes, 0 kit symbols, 0 framer ✓
- WMD family: 0 banned classes, 0 kit symbols ✓
- register / tech-tree: 0 banned classes ✓
- unit-factory / stats / login / FactoryManagementPanel: 0 (verified in FID-006 §9) ✓

*— Audit mechanically produced from the grep detector set; every number is reproducible via §5.*
