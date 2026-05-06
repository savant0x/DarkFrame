# Tutorial System Test Checklist
**Feature:** FID-20251025-106 - Tutorial Production Readiness Fix  
**Created:** 2025-10-25  
**Purpose:** Comprehensive manual testing scenarios for all 17 tutorial steps

---

## Pre-Test Setup
- [ ] Database indexes created (`npm run create-tutorial-indexes`)
- [ ] MongoDB connected and running
- [ ] Development server started (`npm run dev`)
- [ ] Browser console open for debugging
- [ ] Test player account created (username: `TutorialTester`)

---

## QUEST 1: Movement Basics (3 steps)

### Step 1: Welcome Message
**Test ID:** T1.1  
**Action:** READ_INFO  
**Expected Behavior:**
- [ ] Tutorial panel appears in bottom-right corner
- [ ] Welcome message displays: "Welcome to DarkFrame!"
- [ ] Auto-complete timer starts (3 seconds)
- [ ] Panel automatically advances to next step after 3 seconds
- [ ] No confetti celebration (info step)

**Validation Points:**
- [ ] No errors in console
- [ ] Auto-complete timer logged: `Tutorial auto-complete timer started`
- [ ] Step completion logged: `Tutorial step completed`

---

### Step 2: Move North
**Test ID:** T1.2  
**Action:** MOVE (direction: north, requiredMoves: 5)  
**Expected Behavior:**
- [ ] Instruction displays: "Press W to move north. Try moving 5 spaces up!"
- [ ] Progress bar shows "0/5 moves"
- [ ] Press W key 5 times
- [ ] Progress bar updates: "1/5", "2/5", "3/5", "4/5", "5/5"
- [ ] Step auto-completes when 5/5 reached
- [ ] Confetti celebration triggers (step completion)
- [ ] Reward granted: +50 Metal

**Validation Points:**
- [ ] Direction normalization works: "N" === "north"
- [ ] Only north moves counted (test pressing A, S, D - should not increment)
- [ ] Action tracking updates in real-time (1 second polling)
- [ ] Database: `tutorial_action_tracking` updates with currentCount
- [ ] Database: `players` metal increases by 50

**Edge Cases:**
- [ ] Test rapid key presses (no duplicate counting)
- [ ] Test pressing wrong direction (should not count)
- [ ] Test refresh mid-step (progress persists)

---

### Step 3: Explore Area
**Test ID:** T1.3  
**Action:** MOVE (anyDirection: true, requiredMoves: 10)  
**Expected Behavior:**
- [ ] Instruction: "Move around using W, A, S, D keys"
- [ ] Progress bar shows "0/10 moves"
- [ ] Any direction counts (W, A, S, D all increment)
- [ ] Progress updates real-time
- [ ] Step completes at 10/10
- [ ] Quest completion reward: Achievement "Navigator"

**Validation Points:**
- [ ] All 4 directions accepted (N, S, E, W)
- [ ] Quest progress bar shows 100% (3/3 steps)
- [ ] Achievement unlocked in database: `players.achievements`
- [ ] Quest confetti celebration (3 seconds, 200 particles)

---

## QUEST 2: Cave Discovery (4 steps)

### Step 4: Cave Info
**Test ID:** T2.1  
**Action:** READ_INFO  
**Expected Behavior:**
- [ ] Instruction: "Caves contain valuable resources"
- [ ] Auto-complete timer: 5 seconds
- [ ] Panel auto-advances after 5 seconds
- [ ] No confetti

**Validation Points:**
- [ ] Auto-complete timer logged with 5000ms delay
- [ ] Step completes without user interaction

---

### Step 5: Navigate to Cave
**Test ID:** T2.2  
**Action:** MOVE (targetCoordinates: {x: 20, y: 40, radius: 0})  
**Expected Behavior:**
- [ ] Instruction displays cave coordinates
- [ ] Player must reach EXACT tile (20, 40)
- [ ] Progress bar shows movement tracking
- [ ] Step completes when player reaches (20, 40)
- [ ] Confetti celebration

**Validation Points:**
- [ ] Radius = 0 enforces exact match
- [ ] Nearby tiles (20, 39) or (21, 40) do NOT complete step
- [ ] Step validates targetCoordinates in validateMoveAction()

**Edge Cases:**
- [ ] Test arriving from different directions
- [ ] Test overshooting and coming back

---

### Step 6: Harvest Resources
**Test ID:** T2.3  
**Action:** HARVEST  
**Expected Behavior:**
- [ ] Instruction: "Press F or click Harvest button"
- [ ] Player clicks harvest button
- [ ] Step completes immediately
- [ ] Reward: LEGENDARY Digger added to inventory
- [ ] Confetti celebration

**Validation Points:**
- [ ] Database: `players.inventory.items` contains new item
- [ ] Item has correct fields: `{ id, itemId: 'digger_legendary', name, acquiredAt, source: 'tutorial' }`
- [ ] Reward message displays

---

### Step 7: Check Inventory
**Test ID:** T2.4  
**Action:** OPEN_PANEL (panelName: 'inventory')  
**Expected Behavior:**
- [ ] Instruction: "Open your inventory (I key)"
- [ ] Player presses I or clicks inventory button
- [ ] Panel validation checks: panelName === 'inventory'
- [ ] Step completes
- [ ] Quest completion: +200 Metal

**Validation Points:**
- [ ] validateOpenPanelAction() checks panel name (case-insensitive)
- [ ] Other panels don't complete step (test opening tech-tree)
- [ ] Quest reward added to player metal

---

## QUEST 3: Combat Introduction (3 steps)

### Step 8: Beer Base Info
**Test ID:** T3.1  
**Action:** READ_INFO  
**Expected Behavior:**
- [ ] Info about beer bases displayed
- [ ] Auto-complete timer: 7 seconds
- [ ] Auto-advances after delay

**Validation Points:**
- [ ] Correct auto-complete delay (7000ms)

---

### Step 9: Find Beer Base
**Test ID:** T3.2  
**Action:** CUSTOM (requirementType: 'find_beer_base')  
**Expected Behavior:**
- [ ] Instruction: "Look for a WEAK Beer Base"
- [ ] Step requires manual validation (custom action)
- [ ] Player must trigger validation with `{ requirementMet: true }`

**Validation Points:**
- [ ] validateCustomAction() checks requirementMet boolean
- [ ] Custom validation data structure correct

---

### Step 10: Attack Base
**Test ID:** T3.3  
**Action:** ATTACK (targetType: 'beer_base')  
**Expected Behavior:**
- [ ] Instruction: "Attack the Beer Base"
- [ ] Player clicks attack button
- [ ] Step validates targetType === 'beer_base'
- [ ] Reward: +100 XP
- [ ] Quest completion: Achievement "Warrior"

**Validation Points:**
- [ ] validateAttackAction() checks targetType
- [ ] Player vs player attacks don't complete step
- [ ] Experience added to player
- [ ] Achievement unlocked

---

## QUEST 4: Social Introduction (2 steps)

### Step 11: Clan Info
**Test ID:** T4.1  
**Action:** READ_INFO  
**Expected Behavior:**
- [ ] Clan information displayed
- [ ] Auto-complete: 5 seconds

---

### Step 12: Open Clan Panel
**Test ID:** T4.2  
**Action:** OPEN_PANEL (panelName: 'clans')  
**Expected Behavior:**
- [ ] Player opens clans panel
- [ ] Step completes
- [ ] Quest reward: +150 Metal

**Validation Points:**
- [ ] Panel name validation (case-insensitive 'clans')

---

## QUEST 5: Tech Tree Basics (2 steps)

### Step 13: Tech Tree Info
**Test ID:** T5.1  
**Action:** READ_INFO  
**Expected Behavior:**
- [ ] Tech tree information
- [ ] Auto-complete: 5 seconds

---

### Step 14: Open Tech Tree
**Test ID:** T5.2  
**Action:** OPEN_PANEL (panelName: 'tech-tree')  
**Expected Behavior:**
- [ ] Player opens tech tree panel
- [ ] Step completes
- [ ] Quest reward: +100 Oil

**Validation Points:**
- [ ] Panel name validation (hyphenated name)

---

## QUEST 6: Tutorial Complete (1 step)

### Step 15: Claim Starter Pack
**Test ID:** T6.1  
**Action:** COLLECT_REWARD  
**Expected Behavior:**
- [ ] Congratulations message
- [ ] "Next" button displayed
- [ ] Player clicks Next
- [ ] Reward: Starter Pack (500 Metal, 300 Oil, 5 items)
- [ ] Quest reward: Achievement "Tutorial Master"
- [ ] Tutorial marks as complete

**Validation Points:**
- [ ] Database: `tutorial_progress.tutorialComplete = true`
- [ ] Database: `tutorial_progress.completedAt` timestamp set
- [ ] All rewards granted to player
- [ ] Tutorial panel disappears after completion
- [ ] Final confetti celebration (3 seconds, 200 particles)

---

## Database Validation Tests

### Tutorial Progress
**Collection:** `tutorial_progress`

**Test Queries:**
```javascript
// Check progress record
db.tutorial_progress.findOne({ playerId: "TutorialTester" })

// Expected fields:
{
  _id: ObjectId,
  playerId: "TutorialTester",
  currentQuestId: "quest_tutorial_complete", // Final quest
  currentStepIndex: 0,
  completedQuests: ["quest_movement_basics", "quest_cave_discovery", ...],
  completedSteps: ["movement_welcome", "movement_wasd", ...],
  tutorialComplete: true,
  completedAt: ISODate,
  totalStepsCompleted: 15
}
```

**Validation:**
- [ ] playerId index exists and is unique
- [ ] All 6 quests in completedQuests array
- [ ] All 15 steps in completedSteps array
- [ ] tutorialComplete is true
- [ ] completedAt timestamp present

---

### Action Tracking
**Collection:** `tutorial_action_tracking`

**Test During Step 2 (Move North):**
```javascript
db.tutorial_action_tracking.findOne({ 
  playerId: "TutorialTester", 
  stepId: "movement_wasd" 
})

// Expected during step:
{
  playerId: "TutorialTester",
  stepId: "movement_wasd",
  currentCount: 3, // Current progress
  targetCount: 5,  // Required moves
  lastUpdated: ISODate
}
```

**Validation:**
- [ ] Compound index on playerId + stepId exists
- [ ] Record created when step starts (currentCount: 0)
- [ ] Updates real-time as player moves
- [ ] Deleted when step completes

---

### Player Rewards
**Collection:** `players`

**Test After Tutorial Complete:**
```javascript
db.players.findOne({ username: "TutorialTester" })

// Expected changes:
{
  metal: +1000, // 50 + 200 + 150 + 500 + other rewards
  oil: +400,    // 300 + 100
  experience: +100,
  inventory: {
    items: [
      { itemId: "digger_legendary", ... },
      { itemId: "starter_pack", ... }
    ]
  },
  achievements: [
    { achievementId: "tutorial_movement_complete", ... },
    { achievementId: "tutorial_first_battle", ... },
    { achievementId: "tutorial_master", ... }
  ]
}
```

**Validation:**
- [ ] All rewards granted
- [ ] Inventory items present with correct structure
- [ ] Achievements array populated
- [ ] No duplicate achievements

---

## Performance Tests

### Real-Time Updates
- [ ] Tutorial panel polls every 1 second
- [ ] No lag when updating progress bars
- [ ] Confetti doesn't freeze UI
- [ ] Auto-complete timers accurate (±100ms)

### Database Operations
- [ ] Index scan times < 10ms (tutorial_progress.playerId)
- [ ] Action tracking updates < 5ms
- [ ] Step completion < 50ms total
- [ ] No N+1 queries (check MongoDB profiler)

---

## Error Handling Tests

### Network Failures
- [ ] API timeout during step completion (graceful failure)
- [ ] Offline mode (tutorial pauses, doesn't crash)
- [ ] Retry logic for failed requests

### Edge Cases
- [ ] Refresh browser mid-tutorial (progress persists)
- [ ] Multiple tabs open (no duplicate progress)
- [ ] Skip tutorial button (sets tutorialSkipped = true)
- [ ] Restart tutorial (deletes progress, starts fresh)

### Confetti Library Failure
- [ ] Mock confetti library error
- [ ] UI continues working
- [ ] Error logged but not displayed to user

---

## Accessibility Tests

### Keyboard Navigation
- [ ] Tab through tutorial panel elements
- [ ] Enter key on "Next" button works
- [ ] Escape key to skip tutorial (with confirmation)

### Screen Readers
- [ ] ARIA labels on progress bars
- [ ] Step instructions readable
- [ ] Reward announcements accessible

---

## PASS/FAIL CRITERIA

### CRITICAL (Must Pass)
- [ ] All 15 steps completable in order
- [ ] All rewards granted correctly
- [ ] Database indexes created and functional
- [ ] No TypeScript errors
- [ ] No console errors during normal flow

### HIGH PRIORITY
- [ ] Real-time progress updates working
- [ ] Auto-complete timers accurate
- [ ] Confetti celebrations trigger
- [ ] Direction normalization (N → north)

### MEDIUM PRIORITY
- [ ] Proper logging (no console.log)
- [ ] Error handling for edge cases
- [ ] Performance targets met

---

## Test Execution Log
**Tester:** _______________  
**Date:** _______________  
**Environment:** Development / Staging / Production  
**Pass Rate:** ___ / 17 steps (___%)  

**Blockers Found:**
1. _____________________________
2. _____________________________

**Notes:**
_________________________________
_________________________________
