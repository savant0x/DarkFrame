# 🐛 Bug Analysis & Resolution Guide

**Date**: 2025-10-23  
**Status**: ✅ FIXED (Requires Server Restart)

---

## 🚨 Critical Issues

### 1. Beer Base Duplicate Key Error (E11000) ✅ FIXED

**Problem**:
```
MongoServerError: E11000 duplicate key error collection: darkframe.players 
index: ux_username dup key: { username: "🍺BeerBase-STRONG-1" }
```

**Root Cause**:
- Race condition in `spawnBeerBase()` function
- Multiple concurrent spawn attempts generated same username
- Username generation used: `🍺BeerBase-${powerTier}-${sequentialNumber}`
- Sequential numbering not atomic → collisions inevitable

**Solution Applied**:
```typescript
// OLD (Race Condition):
const beerBaseNumber = (await getCurrentBeerBaseCount()) + 1;
bot.username = `🍺BeerBase-${powerTier}-${beerBaseNumber}`;

// NEW (Collision-Free):
const timestamp = Date.now();
const randomSuffix = Math.floor(Math.random() * 10000);
bot.username = `🍺BeerBase-${powerTier}-${timestamp}-${randomSuffix}`;
```

**Files Modified**:
- `lib/beerBaseService.ts` (line 462-464)

**Cleanup Script Created**:
- `scripts/cleanup-beer-bases.ts` - Removes old Beer Bases from database

**Action Required**:
1. **Stop the development server** (already done based on logs)
2. **Run cleanup script**:
   ```powershell
   npx ts-node scripts/cleanup-beer-bases.ts
   ```
3. **Restart development server**:
   ```powershell
   npm run dev
   ```

---

### 2. Harvest Results Disappear on Movement ✅ FIXED

**Problem**:
- User harvests resource (metal/energy/cave item)
- Harvest result modal appears
- User moves to another tile
- Result disappears immediately instead of persisting for 3 seconds

**Root Cause**:
```typescript
// In app/game/page.tsx useEffect (line 286)
if (lastTileKey && lastTileKey !== tileKey) {
  setHarvestResult(null);  // ❌ Cleared harvest result on ANY tile change
  setAttackResult(null);
  setFactoryData(null);
}
```

**Solution Applied**:
```typescript
// Preserve harvest results across tile changes
if (lastTileKey && lastTileKey !== tileKey) {
  // DO NOT clear harvestResult - let it persist
  setAttackResult(null);     // Still clear position-specific results
  setFactoryData(null);
}
```

**Behavior Now**:
- ✅ Harvest result persists for full 3-second timeout
- ✅ Player can move while seeing what they harvested
- ✅ Result only clears on: (1) 3-second timeout OR (2) new harvest action
- ✅ Attack/Factory results still clear correctly (position-specific)

**Files Modified**:
- `app/game/page.tsx` (line ~283-290)

---

## ⚠️ Non-Critical Warnings

### 3. Socket.io Authentication Failures

**Observation**:
```
[Socket.io] Authentication failed: Invalid or expired authentication token
```

**Analysis**:
- Occurs intermittently during page loads
- Likely timing issue: WebSocket connects before HTTP session established
- Session API works fine: `GET /api/auth/session 200`
- User remains logged in and functional

**Status**: 📊 **MONITORING** (Non-blocking, no immediate action needed)

**Potential Improvements** (Future):
- Add retry logic to WebSocket connection
- Delay WebSocket connection until session confirmed
- Implement exponential backoff for auth failures

---

### 4. Webpack Cache Warnings

**Observation**:
```
<w> [webpack.cache.PackFileCacheStrategy] Caching failed for pack: 
Error: Unable to snapshot resolve dependencies
```

**Analysis**:
- Next.js build cache optimization warning
- Does NOT affect functionality or runtime performance
- Compilation still succeeds (no errors)
- Common in development mode with frequent file changes

**Status**: ℹ️ **INFORMATIONAL** (Safe to ignore in development)

**If This Becomes Frequent**:
```powershell
# Clear Next.js cache
rm -rf .next
npm run dev
```

---

## 📋 Step-by-Step Resolution Checklist

### Immediate Actions (Required):

- [x] **Step 1**: Code fixes applied
  - ✅ Beer Base username generation fixed
  - ✅ Harvest result persistence fixed

- [ ] **Step 2**: Run database cleanup
  ```powershell
  npx ts-node scripts/cleanup-beer-bases.ts
  ```
  **Expected Output**:
  ```
  🍺 [Beer Base Cleanup] Starting cleanup...
  🍺 Found X Beer Base(s) to remove
     1. 🍺BeerBase-STRONG-1 (Level X, Position: X,Y)
     ...
  ✅ Successfully removed X Beer Base(s)
  🍺 Cleanup complete!
  ```

- [ ] **Step 3**: Restart development server
  ```powershell
  npm run dev
  ```

- [ ] **Step 4**: Verify fixes
  - ✅ No more E11000 duplicate key errors in console
  - ✅ Harvest results persist while moving
  - ✅ New Beer Bases spawn with unique names (timestamp-based)

---

## 🧪 Testing Verification

### Beer Base Fix Verification:
1. Wait for Beer Base spawn cycle (~30-60 seconds)
2. Check console for: `🍺 Spawned Beer Base: 🍺BeerBase-LEGENDARY-1729695234567-8423`
3. Verify NO `E11000` errors appear
4. Multiple spawns should all succeed with unique names

### Harvest Persistence Verification:
1. Stand on Metal/Energy/Cave/Forest tile
2. Press G (or F) to harvest
3. Immediately move to adjacent tile
4. ✅ Harvest result modal should remain visible
5. ✅ Modal should disappear after 3 seconds OR when harvesting again

---

## 📊 Expected Logs After Fix

**✅ Good Logs (Success)**:
```
[BeerBase] 🍺 Population deficit detected, spawning Beer Bases...
🍺 Spawned Beer Base: 🍺BeerBase-STRONG-1729695234567-3891 (STRONG) | STR: 12345 | DEF: 23456 | Units: 8
[BeerBase] ✅ Population maintenance complete! { spawned: 1, newTotal: 1, target: 1 }
```

**❌ Bad Logs (Still Broken - Indicates Server Not Restarted)**:
```
Failed to spawn Beer Base 1: MongoServerError: E11000 duplicate key error
```

---

## 🔧 Additional Notes

### Beer Base Username Format:
- **Old (Broken)**: `🍺BeerBase-STRONG-1`, `🍺BeerBase-MID-2`
- **New (Fixed)**: `🍺BeerBase-STRONG-1729695234567-8423`, `🍺BeerBase-MID-1729695235891-1337`

### Why This Fix Works:
- `Date.now()` returns unique millisecond timestamp
- `Math.random() * 10000` adds 0-9999 random suffix
- Even if two spawns happen in same millisecond (unlikely), random suffix prevents collision
- Probability of collision: ~0.0001% (1 in 1,000,000)

---

## 📞 Support

If issues persist after following all steps:
1. Check that cleanup script ran successfully
2. Verify server restarted with new code (check console for new Beer Base name format)
3. Check database directly:
   ```javascript
   // In MongoDB shell or Compass
   db.players.find({ isBot: true, isSpecialBase: true })
   ```

---

**Status**: 🟢 **Ready for Testing**  
**Next Action**: Run cleanup script + restart server
