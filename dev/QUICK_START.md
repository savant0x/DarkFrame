# Quick Start — DarkFrame Development

**Last Updated:** 2026-05-06 (Economy Rebalance Planning Complete)
**Overall Progress:** Supabase migration 100%. 0 TypeScript errors. Balance FIDs written.
**Current Status:** Economy rebalance planning complete — 4-phase implementation ready to execute

---

## Current State

**Project:**
- **GitHub:** https://github.com/fame0528/DarkFrame.git
- **TypeScript:** 0 compilation errors
- **Database:** Supabase PostgreSQL (17 migrations pushed)
- **Auth:** Cookie-based via `requireAuth()` → Supabase session cookie
- **Map:** 22,500 tiles seeded
- **API:** 194+ routes, all cookie-authenticated

**Active Work:**
- Economy Rebalance (FID-20260506-BALANCE-MASTER)
- Phase 1: Critical fixes (multipliers, diggers, harvest, XP) — READY TO IMPLEMENT
- Phase 2: New sinks (upkeep, durability, stamina, PvP burn)
- Phase 3: Progression (tiers, tech tree, VIP, shrine)
- Phase 4: Long-term health (achievements, decay, content cadence)

**Completed Stabilization (2026-05-05):**
- 45 API routes standardized from manual `username` param to cookie auth
- Factory system regen bug fixed (full factories now regenerate correctly)
- WMD admin panel wired to analytics/admin services
- WMD player panels — all shape mismatches resolved
- Clan creation fixed (tag auto-generation, cost alignment)
- Items/diggers — tiered name pools, DIGGER_TIERS diminishing returns
- Inventory API — `normalizeItemRow()`, digger breakdown by rarity
- Toast system — handles API error objects gracefully
- Harvest calculator — balance math corrected
- `player_sessions` table + `is_banned` column created

---

## Quick Commands

```bash
# Dev server
npm run dev

# Type check
npx tsc --noEmit

# Supabase
npx supabase db push

# Scripts
npx tsx scripts/map/seed-tiles.ts
npx tsx scripts/admin/create-admin.ts
```

---

## Key Files

- **`lib/authMiddleware.ts`** — `resolveAuth()`, `requireAuth()`, `getAuthenticatedUser()`
- **`lib/itemUtils.ts`** — `pickRandomName()`, `getDiggerBonus()`, `normalizeItemRow()`, `RARITY_NAME_POOLS`
- **`lib/caveItemService.ts`** — Item generation with tiered names + diminishing returns
- **`lib/clanService.ts`** — `joinClanDirectly()`, full rollback on create failure
- **`lib/jobs/factorySlotRegeneration.ts`** — Regenerates `used_slots > 0` factories
- **`lib/wmd/admin/wmdAnalyticsService.ts`** — Rich WMD analytics (now wired)
- **`lib/wmd/admin/wmdAdminService.ts`** — Admin WMD operations (now wired)
- **`app/api/admin/wmd/route.ts`** — WMD admin dashboard (now functional)
- **`dev/fids/archived/`** — All 15 completed FIDs

---

## Development Patterns

**Adding a new protected API route:**
```typescript
import { requireAuth } from '@/lib/authMiddleware';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const username = auth.playerId;
  // ... route logic
}
```

**Adding a new item type:**
```typescript
// Add to RARITY_NAME_POOLS in lib/itemUtils.ts
// Format: { rarity: ['Name1', 'Name2', ...] }
```

