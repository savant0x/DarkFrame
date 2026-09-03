# 🏴 Flag Tracker Panel - Integration Guide

**Created:** 2025-10-20  
**Feature ID:** FID-20251020-FLAG-TRACKER

---

## ✅ **COMPLETED FILES**

All core Flag Tracker Panel components have been created and are ready to use:

### **Core Components:**
1. ✅ `/types/flag.types.ts` - Flag Bearer types, interfaces, and constants
2. ✅ `/lib/flagService.ts` - Distance, direction, and tracker utility functions
3. ✅ `/components/FlagTrackerPanel.tsx` - Main Flag Tracker Panel UI component
4. ✅ `/app/api/flag/route.ts` - REST API endpoint for flag data
5. ✅ `/types/index.ts` - Updated to export flag types

**Status:** 0 TypeScript errors, all files compile successfully ✅

---

## 🎯 **WHAT IT DOES**

The Flag Tracker Panel provides a clean, focused UI for tracking the Flag Bearer player:

**Features:**
- 🎯 Shows current Flag Bearer name, level, and position
- 📏 Calculates distance from your position (in tiles)
- 🧭 Visual compass rose with direction arrow (N, NE, E, SE, S, SW, W, NW)
- ✅ Attack range indicator (green "IN RANGE" / red "OUT OF RANGE")
- ⏱️ Flag hold duration with expiry warnings
- 💚 Bearer HP display (current / max)
- 🔍 "Track Player" button (navigates to profile)
- ⚔️ "Attack" button (only enabled when in range)
- 📱 Mobile-friendly compact mode

---

## 🚀 **HOW TO INTEGRATE**

### **Option 1: Add to Game Page (Recommended)**

Add the Flag Tracker Panel to your main game page:

```tsx
// app/game/page.tsx

import FlagTrackerPanel from '@/components/FlagTrackerPanel';
import { useState, useEffect } from 'react';
import { type FlagBearer } from '@/types/flag.types';

export default function GamePage() {
  const [flagBearer, setFlagBearer] = useState<FlagBearer | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 75, y: 75 });
  
  // Fetch initial flag data
  useEffect(() => {
    fetch('/api/flag')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setFlagBearer(data.data);
        }
      });
  }, []);
  
  // Handle attack action
  const handleAttack = async (bearer: FlagBearer) => {
    const response = await fetch('/api/flag/attack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPlayerId: bearer.playerId,
        attackerPosition: playerPosition
      })
    });
    
    const result = await response.json();
    if (result.success && result.data?.success) {
      alert(`Attack successful! Damage: ${result.data.damage}`);
    } else {
      alert(`Attack failed: ${result.data?.error || 'Unknown error'}`);
    }
  };
  
  return (
    <div className="flex gap-4 p-4">
      {/* Your existing game UI */}
      <div className="flex-1">
        {/* Game content here */}
      </div>
      
      {/* Flag Tracker Panel - Right sidebar */}
      <div className="w-96">
        <FlagTrackerPanel
          playerPosition={playerPosition}
          flagBearer={flagBearer}
          onAttack={handleAttack}
          attackOnCooldown={false}
          compact={false}
        />
      </div>
    </div>
  );
}
```

### **Option 2: Standalone Page**

Create a dedicated flag tracking page:

```tsx
// app/flag/page.tsx

import FlagTrackerPanel from '@/components/FlagTrackerPanel';
// ... (same setup as Option 1)
```

---

## 🔌 **WEBSOCKET INTEGRATION**

For **real-time updates** when the Flag Bearer moves:

```tsx
// In your WebSocket context or component

import { type FlagPositionUpdateEvent, type FlagOwnershipChangeEvent } from '@/types/flag.types';

// Subscribe to flag events
socket.on('flag:position', (event: FlagPositionUpdateEvent) => {
  // Update bearer position in real-time
  setFlagBearer(event.bearer);
});

socket.on('flag:ownership', (event: FlagOwnershipChangeEvent) => {
  // Handle bearer changes (claimed, defeated, dropped)
  if (event.newBearer) {
    setFlagBearer(event.newBearer);
  } else {
    setFlagBearer(null); // Flag unclaimed
  }
});
```

---

## 📋 **PROPS REFERENCE**

### **FlagTrackerPanel Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `playerPosition` | `{ x: number, y: number }` | ✅ Yes | Your current position (for distance/direction) |
| `flagBearer` | `FlagBearer \| null` | ✅ Yes | Current Flag Bearer data (null if unclaimed) |
| `onTrack` | `(bearer: FlagBearer) => void` | ❌ No | Callback when "Track" button clicked |
| `onAttack` | `(bearer: FlagBearer) => void` | ❌ No | Callback when "Attack" button clicked |
| `attackOnCooldown` | `boolean` | ❌ No | Whether attack is on cooldown (default: false) |
| `cooldownRemaining` | `number` | ❌ No | Remaining cooldown in seconds |
| `compact` | `boolean` | ❌ No | Mobile compact mode (default: false) |

---

## 🎨 **VISUAL STATES**

### **No Flag Bearer:**
```
┌────────────────────────────────┐
│ 🏳️  No Flag Bearer            │
│     The flag is currently      │
│     unclaimed                  │
└────────────────────────────────┘
```

### **Bearer In Range (Green Border):**
```
┌────────────────────────────────┐ 🟢
│ 🏴  Flag Bearer                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 👤 DarkLord42  Level 47       │
│ 📍 (120, 85)   💚 3 tiles     │
│ 🧭 ↗ NE                        │
│ ✅ IN ATTACK RANGE             │
│ [🔍 Track] [⚔️ Attack]        │
└────────────────────────────────┘
```

### **Bearer Out of Range (Red Border):**
```
┌────────────────────────────────┐ 🔴
│ 🏴  Flag Bearer                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 👤 ShadowKnight  Level 52     │
│ 📍 (45, 120)   💔 78 tiles    │
│ 🧭 ↙ SW                        │
│ ❌ OUT OF RANGE                │
│ [🔍 Track] [🚫 Attack]        │
└────────────────────────────────┘
```

---

## 🔧 **BACKEND TODO**

The API endpoint (`/app/api/flag/route.ts`) is **currently using mock data**. 

To make it production-ready, replace the mock implementation with:

### **GET /api/flag:**
```typescript
// Replace mock data with database query
const bearer = await db.flagBearer.findFirst({
  where: { isActive: true },
  include: { player: true }
});
```

### **POST /api/flag/attack:**
```typescript
// Implement actual attack logic:
// 1. Verify attacker authentication
// 2. Check attack range (must be within 5 tiles)
// 3. Verify attack cooldown (60 seconds)
// 4. Calculate damage
// 5. Update bearer HP
// 6. Handle bearer defeat (flag transfer)
// 7. Broadcast WebSocket event
```

---

## 📊 **CONFIGURATION**

Attack range and other settings are in `/types/flag.types.ts`:

```typescript
export const FLAG_CONFIG = {
  ATTACK_RANGE: 5,              // Attack range in tiles
  MAX_HOLD_DURATION: 3600,      // 1 hour before auto-drop
  ATTACK_COOLDOWN: 60,          // 60 seconds between attacks
  BASE_ATTACK_DAMAGE: 100,      // Base damage per attack
  POSITION_UPDATE_INTERVAL: 5000 // 5 seconds between updates
};
```

Adjust these values to tune the flag mechanic gameplay.

---

## ✅ **TESTING CHECKLIST**

Before going live, verify:

- [ ] Component renders without errors
- [ ] Shows "No Flag Bearer" when `flagBearer` is null
- [ ] Displays correct bearer name, level, position
- [ ] Distance calculation is accurate (Euclidean distance)
- [ ] Compass direction matches actual direction
- [ ] Attack button disabled when out of range
- [ ] Attack button disabled when on cooldown
- [ ] "Track" button navigates to correct profile
- [ ] "Attack" callback fires with correct bearer data
- [ ] Compact mode works on mobile screens
- [ ] Border color changes (green in range, red out of range)
- [ ] WebSocket updates work in real-time
- [ ] API returns correct mock data

---

## 🎯 **ADVANTAGES OVER MAP**

✅ **Much cleaner visually** - Focused, purpose-built UI  
✅ **Mobile-friendly** - Compact, readable component  
✅ **Faster to implement** - No complex rendering  
✅ **Actually useful** - Shows exactly what players need  
✅ **Real-time ready** - Simple WebSocket integration  
✅ **Better UX** - Clear actions, obvious next steps  
✅ **Performance** - Lightweight, no canvas rendering  

---

## 🚀 **NEXT STEPS**

1. ✅ **Integrate into game page** (Option 1 or 2 above)
2. ✅ **Add WebSocket listeners** for real-time updates
3. ✅ **Replace API mocks** with database queries
4. ✅ **Test attack flow** end-to-end
5. ✅ **Tune FLAG_CONFIG** values for gameplay balance

---

**Ready to use!** The Flag Tracker Panel is complete and waiting for integration. 🎉
