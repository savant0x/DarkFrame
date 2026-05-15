# FID-20260508-PAGE-STRUCTURE: Unify All Pages Under GameLayout Wrapper + Synth Palette

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260508-PAGE-STRUCTURE |
| **Date Created** | 2026-05-08 |
| **Status** | CLOSED |
| **Priority** | HIGH |
| **Phase** | All 20 pages implemented |

---

## Context

Audit of all 27 pages in the DarkFrame app reveals two major issues:

### Issue 1: Missing GameLayout Wrapper
Only 4 pages correctly use the `GameLayout` wrapper. The remaining 20 game-related pages render as standalone pages that break the game's visual design system. The game wrapper provides left sidebar (stats), center tile view (content), and right sidebar (controls) — all game content should appear within this wrapper.

### Issue 2: Old Color Palette / Design System
The standalone pages also use the old color palette and design system (glass/blur utilities, old color classes like `bg-gray-900`, `bg-gray-950`, `bg-space-darker`, `text-neon-cyan`, `from-cyan-500 to-blue-500`, etc.) instead of the synth palette that was applied during the May 7 theme overhaul. The synth palette uses CSS custom properties (`--void`, `--card`, `--surface`, `--neon-pink`, `--neon-cyan`, etc.) and glow shadows defined in `globals.css` and `tailwind.config.ts`.

**Both issues must be fixed together:** when wrapping each page in GameLayout, the inner content must also be updated to use the synth palette design system.

---

## Canonical Reference Pattern

The main game page (`app/game/page.tsx`) is the canonical reference. It uses:

```tsx
// 1. TopNavBar for navigation
<TopNavBar onLeaderboardClick={...} onClansClick={...} ... />

// 2. GameLayout with three panels
<GameLayout
  statsPanel={<StatsPanel ... />}
  controlsPanel={<ControlsPanel />}
  tileView={/* center content */}
  chatUser={...}
/>

// 3. Synth palette classes throughout
// bg-[--void], bg-[--card], bg-[--surface], text-[--neon-pink], text-[--neon-cyan]
// shadow-glow-pink, shadow-glow-cyan
// No backdrop-blur, no glass utilities
```

---

## Audit Results

### Pages That Use GameLayout + Synth Palette Correctly (4)
| Page | Route |
|------|-------|
| `app/game/page.tsx` | `/game` — Main game hub, canonical implementation |
| `app/game/unit-factory/page.tsx` | `/game/unit-factory` |
| `app/stats/page.tsx` | `/stats` |
| `app/map/page.tsx` | `/map` |

### Pages That Break the Pattern (20 game-related pages)

#### Tier 1: High Priority (frequently accessed by players)

| # | Page | Route | Current Issues |
|---|------|-------|---------------|
| 1 | `app/game/vip-upgrade/page.tsx` | `/game/vip-upgrade` | Standalone, old palette. **Critical: monetization flow.** |
| 2 | `app/game/specialization/page.tsx` | `/game/specialization` | Standalone, `bg-space-darker`, `text-neon-cyan`, old gradient buttons |
| 3 | `app/game/inventory/page.tsx` | `/game/inventory` | Standalone, `bg-gray-900`, old color classes |
| 4 | `app/game/battle-logs/[type]/page.tsx` | `/game/battle-logs/:type` | Standalone, old palette |
| 5 | `app/game/auto-farm-settings/page.tsx` | `/game/auto-farm-settings` | Standalone, `bg-gray-950`, old palette |
| 6 | `app/shop/rp-packages/page.tsx` | `/shop/rp-packages` | Standalone, old palette |

#### Tier 2: Medium Priority (navigation/feature pages)

| # | Page | Route | Current Issues |
|---|------|-------|---------------|
| 7 | `app/leaderboard/page.tsx` | `/leaderboard` | Standalone, old palette. Game page already embeds LeaderboardView. |
| 8 | `app/clans/page.tsx` | `/clans` | Standalone, old palette. Game page already embeds ClanLeaderboardView. |
| 9 | `app/clan/page.tsx` | `/clan` | Standalone, old palette. ClanPanel designed for GameLayout. |
| 10 | `app/tech-tree/page.tsx` | `/tech-tree` | Has `embedded` prop but standalone mode lacks GameLayout + old palette |
| 11 | `app/wmd/page.tsx` | `/wmd` | Has `embedded` prop but standalone mode lacks GameLayout + old palette |
| 12 | `app/profile/page.tsx` | `/profile` | Has `embedded` prop but standalone mode lacks GameLayout + old palette |
| 13 | `app/referrals/page.tsx` | `/referrals` | Standalone, custom header/tabs, old palette |
| 14 | `app/messages/page.tsx` | `/messages` | Standalone, split-pane layout, old palette |
| 15 | `app/help/page.tsx` | `/help` | Standalone, old palette |

#### Tier 3: Lower Priority (admin pages)

| # | Page | Route | Current Issues |
|---|------|-------|---------------|
| 16 | `app/admin/page.tsx` | `/admin` | Has `embedded` prop but standalone mode lacks GameLayout + old palette |
| 17 | `app/admin/vip/page.tsx` | `/admin/vip` | Standalone, old palette |
| 18 | `app/admin/referrals/page.tsx` | `/admin/referrals` | Standalone, old palette |

#### Acceptable as Standalone (3 pages — no changes needed)

| # | Page | Route | Reason |
|---|------|-------|--------|
| 19 | `app/game/vip-upgrade/success/page.tsx` | `/game/vip-upgrade/success` | Post-payment confirmation (Stripe redirect) |
| 20 | `app/game/vip-upgrade/cancel/page.tsx` | `/game/vip-upgrade/cancel` | Post-cancellation page (Stripe redirect) |
| 21 | `app/test/websocket/page.tsx` | `/test/websocket` | Dev/test tool |

---

## Design System Inconsistency — Specific Patterns to Fix

### Old Design Patterns Found in Broken Pages
| Old Pattern | Synth Replacement |
|-------------|-------------------|
| `bg-space-darker` | `bg-[--void]` |
| `bg-gray-900`, `bg-gray-950` | `bg-[--card]` or `bg-[--surface]` |
| `text-neon-cyan`, `text-neon-pink` | `text-[--neon-cyan]`, `text-[--neon-pink]` |
| `from-cyan-500 to-blue-500` gradients | `bg-[--neon-cyan]` or `bg-[--synth-purple]` |
| `shadow-[0_0_30px_rgba(0,240,255,0.5)]` | `shadow-glow-cyan` |
| `backdrop-blur`, `glass` utilities | Remove entirely |
| `border-white/10`, `border-white/40` | `border-[--border]` or `border-white/20` |
| `text-text-secondary`, `text-white/50` | `text-white/60` or `text-white/40` |
| `font-display` | Remove or use standard font |
| `hover:shadow-[0_0_30px_...]` | `hover:shadow-glow-cyan` or `hover:shadow-glow-pink` |

### Reference Files for Synth Palette
- `app/globals.css` — CSS custom properties (`--void`, `--card`, `--surface`, `--neon-pink`, `--neon-cyan`, `--neon-red`, `--neon-green`, `--neon-orange`, `--synth-purple`, `--synth-cyan`, `--synth-pink`, `--border`)
- `tailwind.config.ts` — Synth color definitions and glow shadow utilities
- `components/ui/design.tsx` — Shared design tokens (CARD, TABLE, BTN)
- `app/game/page.tsx` — Canonical reference for synth palette usage
- `components/GameLayout.tsx` — Layout wrapper with synth styling
- `components/TopNavBar.tsx` — Navigation bar with synth styling

---

## Perfection Loop — Deep Audit Findings

### Transformation Pattern for Simple Pages (specialization, inventory, auto-farm-settings, battle-logs)

These pages have a simple structure: loading state + content. The transformation is:

**Before (broken):**
```tsx
export default function SomePage() {
  const router = useRouter();
  const { player } = useGameContext();
  if (!player) return <div className="min-h-screen bg-space-darker">Loading...</div>;
  return (
    <div className="min-h-screen bg-space-darker p-6">
      <button onClick={() => router.push('/game')} className="text-neon-cyan">Back</button>
      <div className="max-w-6xl mx-auto">
        {/* content with old palette */}
      </div>
    </div>
  );
}
```

**After (fixed):**
```tsx
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

export default function SomePage() {
  const { player } = useGameContext();
  if (!player) return null; // GameLayout handles loading
  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] p-6">
            <div className="max-w-6xl mx-auto">
              {/* content with synth palette */}
            </div>
          </div>
        }
      />
    </>
  );
}
```

### Transformation Pattern for Pages with Embedded Prop (tech-tree, wmd, profile, admin)

These already support `embedded` mode for use in the game page's center tile. Add a standalone mode:

```tsx
export default function SomePage({ embedded = false }: { embedded?: boolean }) {
  const renderContent = () => { /* existing content */ };
  
  if (embedded) return renderContent();
  
  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={<div className="h-full w-full overflow-auto">{renderContent()}</div>}
      />
    </>
  );
}
```

### Transformation Pattern for VIP/Purchase Pages

The VIP upgrade page is the most critical (monetization flow). It has its own complex layout with pricing tiers, Stripe checkout, feature comparison, and FAQ. The transformation wraps it in GameLayout while preserving all inner functionality:

```tsx
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

export default function VipUpgradePage() {
  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void]">
            {/* Existing VIP content with synth palette applied */}
          </div>
        }
      />
    </>
  );
}
```

The success/cancel sub-pages (`/game/vip-upgrade/success`, `/game/vip-upgrade/cancel`) can remain standalone since they're shown after Stripe redirect.

---

## Impact Matrix

| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `app/game/vip-upgrade/page.tsx` | Wrap GameLayout + synth palette | VIP purchase flow | MED |
| 2 | `app/game/specialization/page.tsx` | Wrap GameLayout + synth palette | Specialization selection | LOW |
| 3 | `app/game/inventory/page.tsx` | Wrap GameLayout + synth palette | Inventory management | LOW |
| 4 | `app/game/battle-logs/[type]/page.tsx` | Wrap GameLayout + synth palette | Battle log viewing | LOW |
| 5 | `app/game/auto-farm-settings/page.tsx` | Wrap GameLayout + synth palette | Auto-farm config | LOW |
| 6 | `app/shop/rp-packages/page.tsx` | Wrap GameLayout + synth palette | RP purchase | MED |
| 7 | `app/leaderboard/page.tsx` | Wrap GameLayout + synth palette | Leaderboard | LOW |
| 8 | `app/clans/page.tsx` | Wrap GameLayout + synth palette | Clan leaderboard | LOW |
| 9 | `app/clan/page.tsx` | Wrap GameLayout + synth palette | Clan management | LOW |
| 10 | `app/tech-tree/page.tsx` | Add standalone GameLayout mode + synth | Tech tree | LOW |
| 11 | `app/wmd/page.tsx` | Add standalone GameLayout mode + synth | WMD hub | LOW |
| 12 | `app/profile/page.tsx` | Add standalone GameLayout mode + synth | Profile | LOW |
| 13 | `app/referrals/page.tsx` | Wrap GameLayout + synth palette | Referrals | LOW |
| 14 | `app/messages/page.tsx` | Wrap GameLayout + synth palette | Messaging | MED |
| 15 | `app/help/page.tsx` | Wrap GameLayout + synth palette | Help/guide | LOW |
| 16 | `app/admin/page.tsx` | Add standalone GameLayout mode + synth | Admin panel | LOW |
| 17 | `app/admin/vip/page.tsx` | Wrap GameLayout + synth palette | Admin VIP | LOW |
| 18 | `app/admin/referrals/page.tsx` | Wrap GameLayout + synth palette | Admin referrals | LOW |

---

## Verification Checklist

- [ ] All game-related pages use GameLayout wrapper
- [ ] All pages show TopNavBar (where applicable)
- [ ] No standalone pages with old palette (except auth, success/cancel, test)
- [ ] VIP purchase flow works within GameLayout
- [ ] Embedded modes still work for pages that support it (tech-tree, wmd, profile, admin)
- [ ] No `bg-space-darker`, `bg-gray-900`, `bg-gray-950` classes remain
- [ ] No `backdrop-blur` or `glass` utilities remain
- [ ] No old gradient buttons (`from-cyan-500 to-blue-500`)
- [ ] Build passes: `npx tsc --noEmit` — 0 errors
- [ ] Lint passes: `next lint` — 0 errors

---

## Notes

- Auth pages (`/login`, `/register`) are correctly standalone — no changes needed
- Success/cancel pages for Stripe redirects can remain standalone
- Test/dev pages can remain standalone
- The main game page (`/game`) is the canonical reference for both GameLayout usage and synth palette
- Some pages may need their inner content adjusted to fit properly within the center tile area
- The `BackButton` component used by many standalone pages should be replaced with TopNavBar navigation
