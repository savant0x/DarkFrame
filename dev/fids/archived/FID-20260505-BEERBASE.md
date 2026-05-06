# FID-20260505-BEERBASE: Beer Base System — Supabase Migration Regression Fix

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-20260505-BEERBASE             |
| **Date Created** | 2026-05-05                        |
| **Status**       | ✅ CLOSED — All Fixes Applied    |
| **Priority**     | CRITICAL                          |
| **Phase**        | Complete                          |
| **Supersedes**   | FID-20251025-BEERBASE-EMERGENCY (MongoDB — same bug, now in Supabase) |

---

## Context

The Beer Base system was migrated from MongoDB to Supabase during Phases 1-6 (FID-20260504-STABLE). A deep audit reveals the Supabase migration **regressed all safety fixes** from the original FID-20251025-BEERBASE-EMERGENCY (Oct 2025), which had resolved an infinite-loop bug that created 153,706 fake beer bases consuming 485 MB of database space.

The player reports beer bases are not spawning — neither automatically via the background job on startup, nor manually via the admin panel.

---

## Root Cause Analysis

### Bug #1: `getTargetBeerBaseCount()` counts human players as bots (Regression from MongoDB fix)

**File:** `lib/beerBaseService.ts:86`

```typescript
// BROKEN — Supabase migration incorrectly ported:
const { count } = await supabase
  .from('players')
  .select('*', { count: 'exact', head: true })
  .neq('is_bot', false); // ❌ Counts humans (null), bots (true), beer bases (true)
```

The original MongoDB fix (FID-20251025-BEERBASE-EMERGENCY) specifically used:
```javascript
// CORRECT — MongoDB original fix:
countDocuments({ isBot: true, isSpecialBase: { $ne: true } })
```

The `.neq('is_bot', false)` operator matches all records where `is_bot` is NOT `false`, which includes:
- Human players (`is_bot = null`)
- Regular bots (`is_bot = true`)
- Beer bases themselves (`is_bot = true, is_special_base = true`)

This is the same infinite-loop bug from October 2025. If 1 human player exists, `count` = 1, `|| 1` fallback = 1, target = `max(1, 1 * 0.075)` = 1. But `getCurrentBeerBaseCount()` returns 0 (correctly filtering by `is_special_base = true`). So the spawner tries to spawn 1, but `spawnBeerBase()` may fail silently due to the Supabase insert constraints.

Additionally, ALL 6 safety caps from the original FID are missing from the Supabase migration:
- No exclusion of beer bases from the bot count
- No `totalBotCap` from bot_config
- No 10% cap of totalBotCap
- No absolute maximum of 1000
- No zero-bot return (uses `|| 1` instead of returning 0)
- No stable calculation (uses random variance instead of average)

### Bug #2: Auth on admin API blocks all manual spawning

**File:** `app/api/beer-bases/route.ts:31-37, 60-77`

POST /api/beer-bases (manual respawn) and PUT (config update) use `getAuthenticatedUser()` from `@/lib/authMiddleware`. This reads Supabase session cookies, but the game uses a different auth method — the cookies don't exist. Every request returns 401.

The user clicked "Manual Respawn Now" in the admin panel and it silently failed with a 401.

### Bug #3: No initial spawn on startup

**File:** `proxy.ts:18`

```typescript
const interval = setInterval(() => beerBaseRespawner(), 60000);
```

The first `beerBaseRespawner()` call waits 60 seconds. No spawn happens on server start.

---

## Fix Plan

### Impact Matrix

| # | File | Change | Risk |
|---|------|--------|------|
| 1 | `lib/beerBaseService.ts:84-90` | Fix query: `.neq('is_bot', false)` → `.eq('is_bot', true).neq('is_special_base', true)`. Add 6 safety caps from original FID. | LOW — restores proven MongoDB fix |
| 2 | `app/api/beer-bases/route.ts:31-37,60-77` | Remove `getAuthenticatedUser()` from GET/POST/PUT. Use `{ username }` body param for POST/PUT. | LOW — matches factory/list, tier/unlock patterns |
| 3 | `proxy.ts:18` | Add immediate `beerBaseRespawner()` call on startup before `setInterval`. | LOW — one additional function call |
| 4 | `npx tsc --noEmit` | Verify 0 errors after all changes. | NONE |

### Implementation Order

1. Fix `getTargetBeerBaseCount()` — restore MongoDB safety caps
2. Fix auth on admin API — remove `getAuthenticatedUser()`
3. Add initial spawn on startup
4. TypeScript verification

---

## Verification Checklist

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `getTargetBeerBaseCount()` uses `.eq('is_bot', true).neq('is_special_base', true)`
- [ ] Returns 0 when no regular bots exist
- [ ] Caps at 10% of totalBotCap
- [ ] Caps at absolute maximum of 1000
- [ ] Admin POST/PUT no longer require Supabase auth cookies
- [ ] `beerBaseRespawner()` runs immediately on server start
- [ ] Manual "Respawn Now" button works from admin panel

---

## Notes

- The original FID (Oct 2025) resolved a 485 MB database emergency with 6 safety caps. The Supabase migration regressed all of them. This FID restores them in the new DB layer.
- The `beerBaseRespawner()` function itself (spawn loop, deficit check, 100/cycle cap, 1000 absolute cap) is correctly implemented and does NOT need changes.
- `spawnBeerBase()` correctly creates bot players with `is_special_base: true` and `spec_doctrine: 'none'`.
- This FID does NOT require new migrations — it fixes queries and auth patterns only.
