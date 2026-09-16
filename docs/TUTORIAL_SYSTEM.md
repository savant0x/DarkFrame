# 🎓 Interactive Tutorial System

> **Status (2026-09-16 audit):** current — Postgres/Drizzle backing store
> (`tutorial_progress` / `tutorial_action_tracking`, see
> `lib/db/schema/tutorial.ts`).

## Overview

The **Interactive Tutorial Quest System** guides new players through DarkFrame's core mechanics with an engaging, reward-driven experience designed to increase tutorial completion from 70% to 85%.

**Key Features:**
- 6 progressive quest chains with 17 total steps
- Interactive element highlighting using react-joyride
- Real-time progress tracking in Postgres (`tutorial_progress` /
  `tutorial_action_tracking` tables)
- Persistent mini-quest tracker panel
- Optional quest skipping with confirmation
- Reward distribution (Metal, Oil, XP, Items, Achievements)

---

## 🎮 Quest Chain

### Quest 1: Movement Basics (Required)
**Steps:**
1. Welcome message (auto-completes after 3s)
2. Press W to move north 5 times → +50 Metal
3. Move around with WASD (10 moves any direction)

**Reward:** Achievement "Navigator"

### Quest 2: Cave Discovery (Required)
**Steps:**
1. Learn about caves (auto-completes after 5s)
2. Navigate to the nearest cave (resolved live — no fixed coordinates)
3. Press F to harvest → **LEGENDARY Digger** (+50% harvest speed)
4. Open inventory (I key) to see the digger

**Reward:** +200 Metal

### Quest 3: Combat Introduction (Required)
**Steps:**
1. Learn about Beer Bases (auto-completes after 7s)
2. Find a WEAK Beer Base on the map
3. Attack the base → +100 XP

**Reward:** Achievement "Warrior"

### Quest 4: Social Introduction (Optional)
**Steps:**
1. Learn about clans (auto-completes after 5s)
2. Open Clans panel

**Reward:** +150 Metal

### Quest 5: Tech Tree Basics (Optional)
**Steps:**
1. Learn about research (auto-completes after 5s)
2. Open Tech Tree panel

**Reward:** +100 Oil

### Quest 6: Tutorial Complete (Required)
**Steps:**
1. Claim starter pack → 500 Metal, 300 Oil, 5 random items

**Reward:** Achievement "Tutorial Master" (+50% bonus!)

---

## 📁 File Structure

```
types/tutorial.types.ts          # TypeScript interfaces (257 lines)
lib/tutorialService.ts           # Quest chains & business logic (450+ lines)
components/tutorial/
  ├── TutorialOverlay.tsx        # Main overlay with joyride (230+ lines)
  ├── TutorialQuestPanel.tsx     # Mini quest tracker (250+ lines)
  └── index.ts                   # Component exports
app/api/tutorial/route.ts        # REST API endpoints (240+ lines)
```

**Total:** ~1,437 lines of production-ready code

---

## 🚀 Setup & Installation

### 1. NPM Dependencies (Already Installed)
```bash
npm install react-joyride @types/react-joyride
```

### 2. Database Indexes
Indexes ship with the schema — see `lib/db/schema/tutorial.ts`:
- Unique `(player_id)` on `tutorial_progress`
- `(tutorial_complete, completed_at)`, `(current_quest_id, tutorial_skipped)`
- Unique `(player_id, step_id)` on `tutorial_action_tracking`
- `(last_updated)` for cleanup queries

No setup script is needed (the old `scripts/setup-tutorial-indexes.js`
one-shot was archived).

### 3. Game Integration (Already Complete)
- ✅ `TutorialOverlay` added to `app/game/page.tsx`
- ✅ `TutorialQuestPanel` added to `app/game/page.tsx`
- ✅ Player ID passed from game context

---

## 🔧 Configuration

Edit `types/tutorial.types.ts` → `DEFAULT_TUTORIAL_CONFIG`:

```typescript
export const DEFAULT_TUTORIAL_CONFIG: TutorialConfig = {
  enabled: true,               // Enable/disable system
  showToNewPlayers: true,      // Auto-show for new players
  minimumLevel: 1,             // Min level to see tutorial
  maximumLevel: 5,             // Max level (hides for 6+)
  allowRestart: true,          // Let players restart
  allowSkip: true,             // Let players skip
  skipRequiresConfirmation: true,
};
```

---

## 📊 Postgres Schema

### Table: `tutorial_progress`

```typescript
{
  id: varchar(24),               // PK
  playerId: varchar(20),         // Player username (unique)
  currentQuestId?: varchar(50),  // Active quest ID
  currentStepIndex: number,      // Current step (0-indexed)
  completedQuests: string[],     // jsonb — completed quest IDs
  completedSteps: string[],      // jsonb — completed step IDs
  skippedQuests: string[],       // jsonb — skipped quest IDs
  claimedRewards: string[],      // jsonb — claimed reward IDs
  tutorialSkipped: 0 | 1,        // Full tutorial skip
  tutorialComplete: 0 | 1,       // All quests done
  startedAt: Date,               // Tutorial start
  completedAt?: Date,            // Completion timestamp
  lastUpdated: Date,             // Last update
  totalStepsCompleted: number,   // Progress metric
  totalTimeSpent: number         // Time in seconds
}
```

### Table: `tutorial_action_tracking`

```typescript
{
  id: varchar(24),               // PK
  playerId: varchar(20),         // Player username
  stepId: varchar(50),           // Step ID (unique per player)
  actionType: varchar(160),      // MOVE/HARVEST/ATTACK/etc + count state
  completed: 0 | 1,
  lastUpdated: Date,
}
```

Full definition (columns, indexes): `lib/db/schema/tutorial.ts`.

---

## 🔌 API Endpoints

### GET `/api/tutorial?playerId={id}`
Fetch current tutorial state for player.

**Query Params:**
- `playerId` (required): Player ID
- `checkEligibility` (optional): Check if player should see tutorial

**Response:**
```json
{
  "quest": { /* TutorialQuest */ },
  "step": { /* TutorialStep */ },
  "progress": { /* TutorialProgress */ },
  "shouldShow": true
}
```

### POST `/api/tutorial`
Perform tutorial actions.

**Actions:**

#### 1. Complete Step
```json
{
  "action": "complete_step",
  "playerId": "player123",
  "questId": "quest_movement_basics",
  "stepId": "movement_wasd",
  "validationData": {}
}
```

#### 2. Skip Tutorial
```json
{
  "action": "skip",
  "playerId": "player123",
  "skipType": "ENTIRE_TUTORIAL"
}
```

#### 3. Restart Tutorial
```json
{
  "action": "restart",
  "playerId": "player123"
}
```

---

## 🎨 UI Components

### TutorialOverlay
Main tutorial overlay with step highlighting.

**Props:**
```typescript
{
  playerId: string;
  isEnabled?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}
```

**Features:**
- react-joyride integration
- Real-time progress bar (top of screen)
- Auto-advances on completion
- Skip confirmation dialog

### TutorialQuestPanel
Persistent mini-tracker in bottom-right corner.

**Props:**
```typescript
{
  playerId: string;
  isVisible?: boolean;
  onSkip?: () => void;
  onMinimize?: () => void;
}
```

**Features:**
- Collapsible design
- Shows current objective
- Displays rewards
- 5-second auto-refresh

---

## 🧪 Testing Checklist

- [ ] **New Player Flow**: Create fresh account, verify tutorial auto-starts
- [ ] **Quest Progression**: Complete all 6 quests, verify rewards awarded
- [ ] **Skip Functionality**: Test quest skip and full tutorial skip
- [ ] **Restart**: Test tutorial restart from settings
- [ ] **Progress Persistence**: Refresh page mid-tutorial, verify state maintained
- [ ] **Edge Cases**: Test with level 6+ player, verify tutorial hidden
- [ ] **Analytics**: Check `tutorial_progress` table for data accuracy

---

## 📈 Success Metrics

**Targets:**
- Tutorial completion rate: 70% → **85%** (+15% improvement)
- Average completion time: 10-12 minutes
- Skip rate: <15%
- Step-by-step completion: >90% for required quests
- Player retention (D1): >70%

**Analytics Queries (Postgres):**

```sql
-- Completion rate
SELECT COUNT(*) AS total,
       SUM(tutorial_complete) AS completed,
       100.0 * SUM(tutorial_complete) / COUNT(*) AS completion_rate
FROM tutorial_progress;

-- Average steps completed
SELECT AVG(total_steps_completed) AS avg_steps FROM tutorial_progress;

-- Skip rate
SELECT COUNT(*) AS total,
       SUM(tutorial_skipped) AS skipped,
       100.0 * SUM(tutorial_skipped) / COUNT(*) AS skip_rate
FROM tutorial_progress;
```

---

## 🛠️ Troubleshooting

### Tutorial not appearing
- Check `DEFAULT_TUTORIAL_CONFIG.enabled` is `true`
- Verify player level is between `minimumLevel` and `maximumLevel`
- Check browser console for errors
- Verify Postgres connection is active

### Progress not saving
- Ensure migrations are applied (`tutorial_progress` table exists)
- Check `tutorial_progress` table exists
- Verify API routes return 200 status
- Check browser network tab for failed requests

### Rewards not distributed
- Verify reward integration functions in `lib/tutorialService.ts`
- Check player row has `resources_metal`, `resources_energy`, `xp` fields
- Implement item/achievement reward handlers (marked TODO)

### Performance issues
- Verify indexes exist (see `lib/db/schema/tutorial.ts`)
- Check slow-query logging for the tutorial endpoints
- Reduce `TutorialQuestPanel` refresh interval if needed (default: 5s)

---

## 🔮 Future Enhancements

1. **Advanced Analytics Dashboard**
   - Heat map of drop-off points
   - A/B testing for quest variations
   - Completion time distribution

2. **Dynamic Quest Chains**
   - Admin panel for quest editing
   - Conditional quests based on playstyle
   - Seasonal/event tutorials

3. **Enhanced Rewards**
   - VIP-specific tutorial rewards
   - Referral bonuses for tutorial completion
   - Exclusive cosmetics/titles

4. **Gamification**
   - Tutorial leaderboard (fastest completion)
   - Speedrun mode
   - Perfect completion achievements

5. **Accessibility**
   - Voice narration for steps
   - Screen reader optimization
   - High contrast mode for overlays

---

## 📚 Documentation

**Related code:**
- `types/tutorial.types.ts` — quest/step types, `DEFAULT_TUTORIAL_CONFIG`
- `lib/tutorialService.ts` — quest chains & business logic
- `lib/db/schema/tutorial.ts` — Postgres tables & indexes

**External Resources:**
- [react-joyride Documentation](https://docs.react-joyride.com/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

## ✅ Deployment Checklist

- [x] NPM packages installed (react-joyride)
- [x] TypeScript files created (no compile errors)
- [x] Components integrated into game UI
- [x] Postgres tables migrated (`tutorial_progress`, `tutorial_action_tracking`)
- [ ] Tutorial tested with real player account
- [ ] Analytics queries validated

---

## 📞 Support

For issues or questions:
1. Check this documentation first
2. Review `lib/tutorialService.ts` inline docs
3. Search server logs for errors
4. Check browser console for client-side errors
5. Verify API routes with Postman/curl

**Common Issues:** See Troubleshooting section above

---

**Feature ID:** FID-20251025-101  
**Created:** 2025-10-25  
**Status:** ✅ COMPLETE (Ready for testing)  
**Impact:** CRITICAL - Player retention improvement
