# 🧪 **RP Economy Test Plan & Balance Verification**

**Feature ID:** FID-20251020-RP-OVERHAUL  
**Phase:** 7/8 - Testing & Balance Verification  
**Created:** October 20, 2025  
**Status:** READY FOR EXECUTION

---

## 📋 **Test Overview**

This document outlines comprehensive testing for the new RP economy system. Each test case includes:
- **Scenario description**
- **Expected behavior**
- **Acceptance criteria**
- **Test data**
- **Verification steps**

---

## 🎯 **Critical Test Cases**

### **TEST 1: Daily Harvest Milestone System**

**Objective:** Verify all 6 milestones award correct RP amounts

**Setup:**
```javascript
// Create test user with 0 harvests today
const testUser = {
  username: 'test_harvester',
  researchPoints: 0,
  isVIP: false
};
```

**Test Steps:**

1. **Milestone 1 (1,000 harvests)**
   - Simulate 1,000 harvests via auto-farm
   - Expected: +500 RP award notification
   - Verify: Player.researchPoints = 500
   - Check: RPTransaction created with source='harvest_milestone'

2. **Milestone 2 (2,500 harvests)**
   - Continue to 2,500 total harvests
   - Expected: +750 RP award (1,500 harvests after milestone 1)
   - Verify: Player.researchPoints = 1,250 (500 + 750)

3. **Milestone 3 (5,000 harvests)**
   - Continue to 5,000 total harvests
   - Expected: +1,000 RP award
   - Verify: Player.researchPoints = 2,250

4. **Milestone 4 (10,000 harvests)**
   - Continue to 10,000 total harvests
   - Expected: +1,500 RP award
   - Verify: Player.researchPoints = 3,750

5. **Milestone 5 (15,000 harvests)**
   - Continue to 15,000 total harvests
   - Expected: +1,250 RP award
   - Verify: Player.researchPoints = 5,000

6. **Milestone 6 (22,500 harvests - Full Map)**
   - Continue to 22,500 total harvests
   - Expected: +1,000 RP award
   - Verify: Player.researchPoints = 6,000 RP TOTAL ✅

**Acceptance Criteria:**
- ✅ All 6 milestones trigger at correct harvest counts
- ✅ Total RP = 6,000 after full map (22,500 tiles)
- ✅ Each milestone awards only once per daily reset
- ✅ DailyHarvestProgress document created in MongoDB
- ✅ Transaction log entry for each milestone

**Edge Cases:**
- Harvest count exactly at threshold (e.g., 1000 not 1001)
- Multiple milestones in rapid succession
- Harvesting after already reaching all milestones (should award 0 RP)

---

### **TEST 2: VIP Bonus Application (+50%)**

**Objective:** Verify VIP players receive +50% RP on ALL sources

**Setup:**
```javascript
const vipUser = {
  username: 'test_vip',
  researchPoints: 0,
  isVIP: true,
  vipExpiresAt: new Date('2026-01-01') // Active VIP
};
```

**Test Steps:**

1. **Harvest Milestone with VIP**
   - Complete 1,000 harvests as VIP
   - Expected: 500 RP × 1.5 = **750 RP**
   - Verify: RPTransaction.vipBonusApplied = true
   - Verify: RPTransaction.metadata.baseAmount = 500

2. **Daily Login with VIP**
   - Trigger daily login on Day 7+ streak
   - Expected: 170 RP × 1.5 = **255 RP**
   - Verify: VIP bonus applied to streak bonus too

3. **Level-Up with VIP**
   - Level up to Level 50
   - Expected: (50 × 5) × 1.5 = 250 × 1.5 = **375 RP**
   - Verify: Calculation happens before VIP multiplier

4. **Battle Victory with VIP**
   - Win infantry battle against Level 30 opponent (player is Level 40)
   - Expected: (100 + 200) × 1.5 = **450 RP** (300 base × 1.5)
   - Verify: Level advantage calculated first, then VIP applied

5. **Achievement with VIP**
   - Complete "Legendary Hero" achievement (250 RP base)
   - Expected: 250 × 1.5 = **375 RP**
   - Verify: Achievement RP bonus scales with VIP

**Full Map Test (VIP):**
- Complete all 6 milestones as VIP
- Expected total: 6,000 × 1.5 = **9,000 RP** ✅

**Acceptance Criteria:**
- ✅ VIP multiplier (1.5x) applies to ALL RP sources
- ✅ Base amount logged in transaction metadata
- ✅ vipBonusApplied flag = true in all transactions
- ✅ Calculations are correct (base × 1.5, rounded down)

---

### **TEST 3: Daily Login Streak System**

**Objective:** Verify streak tracking, bonuses, and reset logic

**Setup:**
```javascript
const streakUser = {
  username: 'test_streak',
  researchPoints: 0,
  lastLoginDate: null,
  loginStreak: 0,
  lastStreakReward: null
};
```

**Test Steps:**

1. **Day 1 - First Login**
   - Call checkDailyLogin()
   - Expected: +100 RP (base, no streak bonus)
   - Verify: Player.loginStreak = 1
   - Verify: Player.lastLoginDate = today's date
   - Verify: Player.lastStreakReward = timestamp

2. **Day 2 - Streak Continues**
   - Advance time by 24 hours + 1 second
   - Call checkDailyLogin()
   - Expected: +110 RP (100 base + 10 streak)
   - Verify: Player.loginStreak = 2

3. **Day 3 - Streak Continues**
   - Advance time by 24 hours
   - Expected: +120 RP (100 base + 20 streak)
   - Verify: Player.loginStreak = 3

4. **Day 7 - Streak Cap Reached**
   - Continue daily logins to Day 7
   - Expected: +170 RP (100 base + 70 streak, CAPPED)
   - Verify: Player.loginStreak = 7

5. **Day 8 - Streak Cap Maintains**
   - Continue to Day 8
   - Expected: +170 RP (still capped at 70 bonus)
   - Verify: Player.loginStreak = 8 (continues counting)

6. **Streak Break - 25 Hours Later**
   - Wait 25 hours (>24hr threshold)
   - Call checkDailyLogin()
   - Expected: +100 RP (reset to base)
   - Verify: Player.loginStreak = 1 (RESET)

7. **Same Day Check - No Reward**
   - Call checkDailyLogin() again immediately
   - Expected: 0 RP awarded
   - Verify: lastStreakReward within 24 hours

**VIP Streak Test:**
- Day 7 login as VIP: 170 × 1.5 = **255 RP** ✅

**Acceptance Criteria:**
- ✅ Streak increments daily (24hr+ since last login)
- ✅ Bonus capped at +70 RP (7+ day streak)
- ✅ Streak resets to 1 if >24hr gap
- ✅ Only 1 reward per day (lastStreakReward check)
- ✅ VIP bonus applies to total (base + streak)

---

### **TEST 4: Level-Up Scaling Formula**

**Objective:** Verify formula `level × 5, max 500 RP`

**Test Cases:**

| Player Level | Formula | Expected RP (Free) | Expected RP (VIP) |
|--------------|---------|-------------------|-------------------|
| 1 | 1 × 5 | 5 RP | 7 RP |
| 10 | 10 × 5 | 50 RP | 75 RP |
| 25 | 25 × 5 | 125 RP | 187 RP |
| 50 | 50 × 5 | 250 RP | 375 RP |
| 75 | 75 × 5 | 375 RP | 562 RP |
| 100 | 100 × 5 = 500 | **500 RP** (capped) | **750 RP** |
| 150 | 150 × 5 = 750 | **500 RP** (capped) | **750 RP** |
| 200 | 200 × 5 = 1000 | **500 RP** (capped) | **750 RP** |

**Test Steps:**
1. Create test users at levels 1, 10, 25, 50, 75, 100, 150, 200
2. Trigger level-up event for each
3. Verify RP awarded matches expected values
4. Verify cap at 500 RP for levels 100+

**Acceptance Criteria:**
- ✅ Formula applied correctly: `Math.min(level × 5, 500)`
- ✅ Cap enforced at 500 RP base (750 RP for VIP)
- ✅ Low-level players get meaningful RP (not just 1 RP)

---

### **TEST 5: Battle RP Rewards**

**Objective:** Verify RP awards based on battle type and level advantage

**Test Cases:**

| Battle Type | Attacker Lv | Defender Lv | Advantage | Base RP | Bonus RP | Total (Free) | Total (VIP) |
|-------------|-------------|-------------|-----------|---------|----------|--------------|-------------|
| Infantry | 50 | 50 | 0 | 100 | 0 | 100 RP | 150 RP |
| Infantry | 50 | 40 | +10 | 100 | 200 | 300 RP | 450 RP |
| Infantry | 40 | 50 | -10 | 100 | 0 | 100 RP | 150 RP |
| Base Raid | 50 | 50 | 0 | 150 | 0 | 150 RP | 225 RP |
| Base Raid | 60 | 50 | +10 | 150 | 200 | 350 RP | 525 RP |
| Base Raid | 50 | 60 | -10 | 150 | 0 | 150 RP | 225 RP |

**Formula:**
```typescript
// Infantry base: 100 RP
// Base Raid: 150 RP
const advantage = Math.max(0, attackerLevel - defenderLevel);
const bonusRP = advantage × 20;
const totalRP = baseRP + bonusRP;
// Apply VIP if applicable: totalRP × 1.5
```

**Test Steps:**
1. Create attacker (Level 50) and defender (Level 40, 50, 60) users
2. Simulate infantry battle victories
3. Verify RP awarded = 100 + (advantage × 20)
4. Repeat for base raids (150 base)
5. Test VIP multiplier on all scenarios

**Acceptance Criteria:**
- ✅ Base RP correct (100 infantry, 150 raid)
- ✅ Level advantage bonus: +20 RP per level
- ✅ No bonus if defender higher level (advantage ≤ 0)
- ✅ VIP multiplier applied to total
- ✅ Loss awards 0 RP (not tested, but logic check)

---

### **TEST 6: Achievement RP Bonuses**

**Objective:** Verify rpBonus implementation in achievementService

**Test Achievements:**

| Achievement | rpBonus | Expected (Free) | Expected (VIP) |
|-------------|---------|-----------------|----------------|
| First Blood | 50 | 50 RP | 75 RP |
| Speed Demon | 50 | 50 RP | 75 RP |
| Master Builder | 75 | 75 RP | 112 RP |
| Elite Warrior | 100 | 100 RP | 150 RP |
| Ancient Explorer | 200 | 200 RP | 300 RP |
| Legendary Hero | 250 | 250 RP | 375 RP |

**Test Steps:**
1. Create test user with prerequisites for each achievement
2. Trigger achievement unlock
3. Verify RP awarded matches rpBonus value
4. Check RPTransaction created with source='achievement'
5. Verify VIP bonus applied

**Acceptance Criteria:**
- ✅ rpBonus field implemented in all achievements
- ✅ RP awarded when achievement unlocked
- ✅ Values match achievement tier (50-250 RP)
- ✅ VIP multiplier applied correctly

---

### **TEST 7: Daily Reset Logic**

**Objective:** Verify harvest progress resets daily at map reset

**Test Steps:**

1. **Day 1 - Partial Progress**
   - Complete 10,000 harvests (4 milestones, 3,750 RP earned)
   - Verify DailyHarvestProgress.harvestCount = 10,000
   - Verify DailyHarvestProgress.milestonesReached = [1000, 2500, 5000, 10000]

2. **Map Reset Event**
   - Trigger daily map reset (typically at midnight server time)
   - Expected: DailyHarvestProgress.harvestCount = 0
   - Expected: DailyHarvestProgress.milestonesReached = []
   - Expected: Player.researchPoints unchanged (keeps 3,750 RP)

3. **Day 2 - Fresh Start**
   - Complete 1,000 harvests
   - Expected: +500 RP awarded AGAIN (milestone available)
   - Verify: Can earn another 6,000 RP today

**Acceptance Criteria:**
- ✅ Harvest count resets to 0 daily
- ✅ Milestone flags cleared for new day
- ✅ Player keeps all earned RP (not reset)
- ✅ Can earn full 6,000 RP again next day

---

### **TEST 8: Target Progression Timelines**

**Objective:** Verify economy targets are achievable

**Scenario 1: Casual Player (Non-VIP)**
- **Play Pattern:** 1 full map per day (22,500 harvests)
- **Daily RP:** 6,000 (milestones) + 170 (7-day streak) + 150 (2 battle wins) = 6,320 RP/day
- **Target:** 100,000 RP for Flag T4
- **Expected Timeline:** 100k ÷ 6,320 = **15.8 days** ✅

**Scenario 2: Active Player (Non-VIP)**
- **Play Pattern:** 2 full maps per day (map reset used)
- **Daily RP:** 12,000 (2 maps) + 170 (streak) + 500 (level-up every 3 days avg) + 300 (5 battles) = 13,137 RP/day
- **Expected Timeline:** 100k ÷ 13,137 = **7.6 days** ✅

**Scenario 3: Active VIP Player**
- **Play Pattern:** 2 full maps per day
- **Daily RP:** (12,000 + 170 + 500 + 300) × 1.5 = 19,455 RP/day
- **Expected Timeline:** 100k ÷ 19,455 = **5.1 days** ✅

**Flag Tier Unlocks (Active VIP):**
- **T1 (500 RP):** 19,455 ÷ 24 hours × X = 500 → **1.5 hours** ✅
- **T2 (1,500 RP):** **4.6 hours** ✅
- **T3 (5,000 RP):** **15.4 hours** (same day) ✅
- **T4 (15,000 RP):** **46 hours** (2 days) ✅

**Acceptance Criteria:**
- ✅ Casual players reach 100k RP in 15-17 days
- ✅ Active players reach 100k RP in 7-9 days
- ✅ VIP players reach 100k RP in 5-6 days
- ✅ Flag T1 unlockable same day for all players
- ✅ Flag T4 achievable in 2-3 days for VIP

---

### **TEST 9: Transaction Logging & Admin Dashboard**

**Objective:** Verify all RP transactions are logged correctly

**Test Steps:**

1. **Transaction Creation**
   - Award RP via each source (harvest, login, level, battle, achievement)
   - Verify RPTransaction documents created in MongoDB
   - Check fields: username, amount, source, description, timestamp, vipBonusApplied, metadata

2. **Admin Dashboard Data**
   - Navigate to `/admin/rp-economy`
   - Verify statistics cards show correct data:
     - Total RP in circulation
     - RP generated today (24h)
     - Active earners today
     - VIP players count
   - Check transaction history table populated
   - Verify filters work (date range, source type, username)

3. **Source Breakdown Analytics**
   - Check "Generation by Source" table
   - Verify milestone data: completions count, total RP awarded
   - Check top 10 earners/spenders leaderboards

4. **Bulk Adjustment Tool**
   - Award +1,000 RP to test user via admin tool
   - Verify transaction logged with source='admin_adjustment'
   - Verify admin username recorded in metadata

**Acceptance Criteria:**
- ✅ Every RP award creates transaction log entry
- ✅ Admin dashboard displays real-time data
- ✅ Filtering and search work correctly
- ✅ Bulk adjustments create audit trail
- ✅ No missing or duplicate transactions

---

### **TEST 10: Edge Cases & Error Handling**

**Test Cases:**

1. **Negative RP Prevention**
   - Attempt to spend more RP than player has
   - Expected: Transaction rejected, balance unchanged
   - Error message: "Insufficient Research Points"

2. **Concurrent Transactions**
   - Award RP from multiple sources simultaneously
   - Expected: All transactions succeed, no race conditions
   - Verify: Player balance = sum of all awards

3. **VIP Expiration During Day**
   - Player starts day as VIP, expires at noon
   - Morning harvest: VIP bonus applied ✅
   - Afternoon harvest: No VIP bonus ✅

4. **Milestone Already Reached**
   - Player completes 5,000 harvests (milestone 3)
   - Later harvests 5,001-10,000
   - Expected: No duplicate milestone 3 award
   - Expected: Milestone 4 awards at 10,000

5. **Daily Login Multiple Checks**
   - Call checkDailyLogin() 3 times in 1 hour
   - Expected: Only first call awards RP
   - Subsequent calls return { alreadyClaimedToday: true }

6. **Level-Up at Level 200**
   - Player levels from 199 → 200
   - Expected: 500 RP (capped, not 1,000)
   - VIP: 750 RP (capped)

**Acceptance Criteria:**
- ✅ No negative RP balances possible
- ✅ Concurrent transactions handled safely
- ✅ VIP status checked in real-time
- ✅ Milestones only awarded once per reset
- ✅ Daily rewards only claimable once per day
- ✅ Caps enforced correctly

---

## 🎯 **Manual Test Checklist**

Run through this checklist in-game:

### **Player Experience Flow**

- [ ] 1. Create new account (fresh player)
- [ ] 2. Complete tutorial, check starting RP (should be 0)
- [ ] 3. Harvest 1,000 tiles → Verify +500 RP notification
- [ ] 4. Check inventory panel → Verify RP balance shows 500
- [ ] 5. Complete 2,500 harvests → Verify +750 RP notification
- [ ] 6. Continue to 22,500 harvests → Verify 6,000 RP total
- [ ] 7. Log out and log back in next day → Verify +100 RP login reward
- [ ] 8. Harvest 1,000 tiles again → Verify milestone available again
- [ ] 9. Level up → Verify RP awarded based on level
- [ ] 10. Win battle → Verify RP awarded in victory screen
- [ ] 11. Unlock achievement → Verify RP bonus awarded
- [ ] 12. Check `/admin/rp-economy` → Verify all transactions logged

### **VIP Experience Flow**

- [ ] 1. Activate VIP subscription on test account
- [ ] 2. Complete 1,000 harvests → Verify 750 RP (500 × 1.5)
- [ ] 3. Daily login → Verify 150 RP (100 × 1.5)
- [ ] 4. Level up → Verify VIP bonus applied
- [ ] 5. Win battle → Verify VIP bonus applied
- [ ] 6. Complete full map → Verify 9,000 RP total (6,000 × 1.5)

### **Admin Dashboard Testing**

- [ ] 1. Navigate to `/admin/rp-economy`
- [ ] 2. Verify statistics cards show correct counts
- [ ] 3. Test date range filter (24h, 7d, 30d, all)
- [ ] 4. Test source filter (harvest, login, level, battle, achievement)
- [ ] 5. Test username search
- [ ] 6. Use bulk adjustment tool → Add +100 RP to test user
- [ ] 7. Verify transaction appears in history
- [ ] 8. Check milestone stats → Verify completion counts
- [ ] 9. Check top players leaderboards → Verify sorted correctly

---

## 📊 **Performance Testing**

### **Database Query Performance**

Test large-scale operations:

1. **1,000 concurrent players harvesting**
   - Simulate 1,000 users reaching milestone 1 simultaneously
   - Measure transaction insertion time
   - Target: <100ms per transaction

2. **Admin dashboard with 100k transactions**
   - Load admin page with 100,000+ transaction history
   - Verify pagination works smoothly
   - Target: <2s initial load time

3. **Daily reset for 10,000 players**
   - Simulate daily reset clearing 10,000 DailyHarvestProgress docs
   - Target: <30s total reset time

**Acceptance Criteria:**
- ✅ No database timeouts under load
- ✅ Queries optimized with proper indexes
- ✅ Admin dashboard remains responsive

---

## 🔍 **Balance Verification**

### **Economy Health Checks**

After 1 week of live testing:

1. **Average RP Generation per Player**
   - Target: 5,000-8,000 RP/day for active players
   - Check: Query average RPTransaction amounts by source

2. **Milestone Completion Rates**
   - Target: 70%+ players reach milestone 1 (1,000 harvests) daily
   - Target: 30%+ players reach milestone 6 (full map) daily
   - Check: Milestone stats in admin dashboard

3. **VIP Conversion Impact**
   - Compare VIP vs Free player RP generation
   - Target: VIP averages 1.5x Free player RP/day
   - Check: Generation by player type analytics

4. **Flag Unlock Timeline (Real Data)**
   - Measure days to unlock Flag T1, T2, T3, T4
   - Compare to target timelines (15-17 days for 100k RP)
   - Adjust milestone values if off by >20%

5. **Shop Package Attractiveness**
   - Monitor RP package purchase rates
   - Target: <10% of players purchasing (most use free RP)
   - Adjust pricing if conversion too high (= free-to-play feels required)

**Acceptance Criteria:**
- ✅ Real data matches theoretical calculations
- ✅ Free-to-play progression feels fair
- ✅ VIP provides value without creating paywall
- ✅ No exploits or unintended RP generation

---

## ✅ **Sign-Off Criteria**

Phase 7 complete when:

- ✅ All 10 critical test cases pass
- ✅ Manual test checklist 100% complete
- ✅ No critical bugs found
- ✅ Performance targets met
- ✅ Balance matches target timelines (within ±20%)
- ✅ User experience feels fair and rewarding
- ✅ Admin tools functional and accurate

---

## 📝 **Test Results Documentation**

After testing, document results in this format:

```md
## Test Results - [Date]

**Tester:** [Name]
**Environment:** [Dev/Staging/Prod]
**Duration:** [Hours]

### Test 1: Daily Harvest Milestones
- Status: ✅ PASS / ❌ FAIL
- Issues Found: [None / List issues]
- Notes: [Observations]

### Test 2: VIP Bonus Application
- Status: ✅ PASS / ❌ FAIL
- Issues Found: [None / List issues]
- Notes: [Observations]

... (repeat for all 10 tests)

### Overall Assessment:
- **Readiness:** APPROVED / NEEDS FIXES
- **Confidence Level:** HIGH / MEDIUM / LOW
- **Recommendation:** DEPLOY / HOLD / REVISE

### Action Items:
1. [If any bugs found, list fixes needed]
2. [Balance adjustments recommended]
3. [Documentation updates needed]
```

---

## 🚀 **Next Steps After Testing**

1. **Fix any critical bugs** found during testing
2. **Balance adjustments** if real data differs from targets
3. **Deploy to production** with announcement (use CHANGELOG_RP_OVERHAUL.md)
4. **Monitor live economy** for 1 week
5. **Collect player feedback** via surveys/Discord
6. **Iterate if needed** based on real-world usage
7. **Move to Phase 8** (Player Documentation - already complete!)
8. **Close FID-20251020-RP-OVERHAUL** as COMPLETED

---

**END OF TEST PLAN** 🧪
