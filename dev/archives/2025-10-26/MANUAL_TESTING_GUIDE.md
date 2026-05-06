# 🎮 DarkFrame - Comprehensive Manual Testing Guide

**Created:** October 25, 2025  
**Purpose:** Systematic testing guide for production readiness validation  
**Scope:** All major systems + recent enhancements  
**Status:** Ready for comprehensive testing phase

---

## 🎯 **TESTING OBJECTIVES**

### Primary Goals:
1. **Validate recent implementations** (Production Readiness, npm audit fix)
2. **Verify system integrations** (All major features working together)
3. **Identify edge cases and bugs** before user testing
4. **Document test results** for tracking
5. **Prepare for production deployment**

### Testing Coverage:
- ✅ Core gameplay (movement, harvesting, combat)
- ✅ Progression systems (XP, leveling, specializations)
- ✅ Economy (banking, resources, trading)
- ✅ Social features (clans, chat, alliances)
- ✅ Endgame content (WMD, Beer Bases, Achievements)
- ✅ Monetization (VIP, Stripe, Referrals)
- ✅ Admin tools (all management panels)
- ✅ Recent changes (Security headers, Health endpoint, Redis docs)

---

## 📋 **PRE-TESTING CHECKLIST**

### Environment Setup:
```bash
# 1. Start fresh dev server
npm run dev

# 2. Verify environment variables
# Check .env.local has all required keys:
- MONGODB_URI
- JWT_SECRET
- STRIPE keys (if testing payments)
- REDIS_URL (optional)

# 3. Clear browser cache
# Press Ctrl+Shift+R for hard refresh
```

### Database State:
- [ ] Backup production database (if testing with real data)
- [ ] Use test accounts (not real users)
- [ ] Have admin account ready
- [ ] Have multiple test player accounts (levels 1, 10, 20, 50)

---

## 🧪 **SYSTEMATIC TEST PLAN**

### **SECTION 1: Authentication & Security (15 min)**

#### Test 1.1: Login Flow
- [ ] Navigate to `/` (should redirect to `/login`)
- [ ] Enter invalid credentials → Verify error message
- [ ] Enter valid credentials → Should redirect to `/game`
- [ ] Check "Remember Me" → Close browser → Reopen → Still logged in ✅
- [ ] Verify JWT cookie present (dev tools → Application → Cookies)

#### Test 1.2: Registration
- [ ] Go to `/register`
- [ ] Enter existing username → Should show error
- [ ] Enter invalid email → Should show validation error
- [ ] Enter weak password (< 6 chars) → Should reject
- [ ] Create new account → Should auto-login and redirect to `/game`
- [ ] Verify new player has starting resources (metal, energy)

#### Test 1.3: Security Headers (NEW - FID-20251025-104)
- [ ] Open DevTools → Network tab
- [ ] Navigate to `/game`
- [ ] Check Response Headers should include:
  * `Content-Security-Policy`
  * `X-Frame-Options: DENY`
  * `X-Content-Type-Options: nosniff`
  * `Referrer-Policy: strict-origin-when-cross-origin`
  * `Permissions-Policy`
  * (Production only: `Strict-Transport-Security`)

#### Test 1.4: Health Endpoint (NEW - FID-20251025-104)
- [ ] Visit `/api/health` in browser
- [ ] Should return JSON with:
  * `status`: "healthy" | "degraded" | "unhealthy"
  * `checks.database`: status + responseTime
  * `checks.redis`: status + mode + version (if configured)
  * `checks.websocket`: status + connections
- [ ] If MongoDB down → status should be "unhealthy" (503)
- [ ] If Redis unavailable → status should be "degraded" (200) with mode "in-memory-fallback"

---

### **SECTION 2: Core Gameplay (30 min)**

#### Test 2.1: Movement
- [ ] Use arrow keys to move player tile → Verify position updates
- [ ] Try numpad (8426) → Should also move
- [ ] Move to edge of map → Should wrap around (150→0 or 0→149)
- [ ] Move onto another player → Should block
- [ ] Check `/dev` console (F12) for movement logs

#### Test 2.2: Resource Harvesting
- [ ] Move to Plains (green) tile → Press H
- [ ] Should receive 100-300 metal (balanced with variety)
- [ ] Move to Mountain (gray) tile → Press H
- [ ] Should receive 100-300 energy
- [ ] Check `/dev` console for XP awards (harvest = +5 XP)
- [ ] Check for Discovery notifications (5% chance in caves/forests)
- [ ] Verify daily milestone tracking (admin panel shows progress)

#### Test 2.3: Factory Capture
- [ ] Move to unclaimed factory → Press R (Raid)
- [ ] Enter 100 STR units → Click Attack
- [ ] Should capture factory (add to inventory)
- [ ] Verify slot regeneration starts (1 slot/hour, max 10)
- [ ] Press U at owned factory → Unit building panel opens
- [ ] Build 10 Riflemen → Should consume resources + slots
- [ ] Verify STR/DEF totals update in stats panel

#### Test 2.4: Beer Base Attacks
- [ ] Find Beer Base tile (username starts with 🍺)
- [ ] Press R → Raid Beer Base
- [ ] Should show difficulty tier (WEAK/MEDIUM/STRONG/etc)
- [ ] Attack with appropriate forces
- [ ] Victory → Check rewards (metal + energy)
- [ ] Verify defeat event recorded (admin analytics)

---

### **SECTION 3: Progression Systems (20 min)**

#### Test 3.1: XP & Leveling
- [ ] Check current XP/Level in stats panel
- [ ] Perform actions (harvest, capture factory, battle)
- [ ] Verify XP bar fills in stats panel
- [ ] Level up → Should show LevelUpModal with rewards (RP, tier unlocks)
- [ ] Check RP balance increased (1 RP per level)

#### Test 3.2: Specialization (Press P)
- [ ] At Level 15+ → Press P
- [ ] Choose specialization (Offensive/Defensive/Tactical)
- [ ] Verify doctrine unlocks 5 specialized units
- [ ] Build specialized units → Should have bonus stats
- [ ] Check mastery progress (0-100%)
- [ ] Award mastery XP via actions
- [ ] At 75% mastery → 4th specialized unit unlocks
- [ ] At 100% mastery → 5th specialized unit unlocks

#### Test 3.3: Achievements (Press A)
- [ ] Open achievement panel (A key)
- [ ] Check unlocked achievements → Should show completion %
- [ ] Complete achievement task → Notification should appear
- [ ] Verify RP reward granted
- [ ] Check achievement categories (Combat, Economic, Exploration, Social)

#### Test 3.4: Discoveries (Press D)
- [ ] Open discovery log (D key)
- [ ] Check discovered ancient tech
- [ ] Verify bonuses apply (harvest yield, unit stats, etc.)
- [ ] Progress toward 15/15 should show

---

### **SECTION 4: Economy & Banking (15 min)**

#### Test 4.1: Banking (Press B)
- [ ] Open bank panel (B key)
- [ ] Deposit resources → Verify balance increases
- [ ] Withdraw resources → Should deduct from bank, add to inventory
- [ ] Exchange metal ↔ energy → Verify rates applied
- [ ] Check transaction limits respected

#### Test 4.2: Auction House (Press Q)
- [ ] Open auction panel (Q key)
- [ ] Create item listing (unit, resource, discovery)
- [ ] Set buyout price and duration
- [ ] Place bid on another item
- [ ] Wait for auction expiration → Winner gets item
- [ ] Verify buyout works instantly

#### Test 4.3: VIP System
- [ ] Check VIP status in stats panel
- [ ] If VIP → Should show "👑 ACTIVE" badge
- [ ] If not VIP → "Get VIP" button → Go to `/game/vip-upgrade`
- [ ] VIP benefits should apply:
  * 2x harvest rewards
  * 2x XP gain
  * Instant unit production
  * +50% RP from all sources
  * Access to VIP channel in chat

#### Test 4.4: Stripe Payments (⚠️ TEST MODE ONLY)
- [ ] Go to `/game/vip-upgrade`
- [ ] Click purchase tier (Weekly/Monthly/etc)
- [ ] Should redirect to Stripe Checkout (test mode)
- [ ] Complete test payment (4242 4242 4242 4242)
- [ ] Redirect to success page
- [ ] VIP should activate automatically (webhook)
- [ ] Check admin panel → Should see transaction in payment history

---

### **SECTION 5: Social Features (25 min)**

#### Test 5.1: Clan System
- [ ] Create new clan → Verify creation successful
- [ ] Invite player → They should receive invite
- [ ] Join clan → Verify membership
- [ ] Check clan research → Unlock clan perks
- [ ] Clan bank operations (deposit, withdraw, fund distribution)
- [ ] Test clan roles (Leader, Officer, Member) permissions

#### Test 5.2: Chat System (Press C)
- [ ] Open chat panel (C key)
- [ ] Send message in Global → Should broadcast to all
- [ ] Send message in Clan → Only clan members see
- [ ] Test typing indicators → Other users see "... is typing"
- [ ] Test @mentions → Should highlight mentioned users
- [ ] Test emoji picker → Insert emoji works
- [ ] Test profanity filter → Bad words blocked
- [ ] Test link detection → URLs become clickable

#### Test 5.3: Ask Veterans Feature
- [ ] As Level 1-10 player → Access "Ask Veterans" button
- [ ] Send question with category
- [ ] Verify rate limiting (1 question per 5 minutes)
- [ ] As Level 50+ veteran → Should receive notification
- [ ] Respond to question in chat

#### Test 5.4: Alliance System
- [ ] Clan leader → Propose alliance to another clan
- [ ] Other clan → Accept alliance
- [ ] Verify shared research bonuses
- [ ] Break alliance → Cooldown period applied

---

### **SECTION 6: Endgame Content (30 min)**

#### Test 6.1: WMD System (Press W)
- [ ] Open WMD panel (W key)
- [ ] **Research Tab:**
  * Check tech tree (3 tracks: Missile, Defense, Intelligence)
  * Spend RP to unlock tech → Should unlock next tier
  * Verify unlock notification
- [ ] **Missiles Tab:**
  * Create missile → Select warhead type (T1-T5)
  * Assemble missile → Consume components
  * Launch missile at target coordinates
  * Verify damage dealt and notification sent
  * Target receives launch warning
- [ ] **Defense Tab:**
  * Deploy defense battery at location
  * Set auto-intercept parameters
  * Test manual interception
  * Repair damaged battery
- [ ] **Intelligence Tab:**
  * Recruit spy → Train to higher rank
  * Start intelligence mission → Wait for completion
  * Sabotage enemy (missile/defense/factory)
  * Run counter-intel to detect enemy spies
- [ ] **Voting Tab:**
  * Create clan vote (missile launch, war declaration)
  * Cast vote (Yes/No)
  * Leader veto vote → Should cancel immediately
  * Wait for vote conclusion → Action auto-executes

#### Test 6.2: Beer Base System (Admin)
- [ ] Go to `/admin` (admin account required)
- [ ] **Smart Spawning Section:**
  * Verify spawn percentage setting (default 8%)
  * Enable/disable smart spawning toggle
  * Manual spawn button → Should create Beer Base
  * Check tier distribution matches player levels
- [ ] **Variety Settings:**
  * Set minimum variety percentages (15% WEAK, 20% MID, etc.)
  * Save → Next spawn should respect minimums
  * Verify total percentages = 100%
- [ ] **Dynamic Schedules:**
  * Add multiple respawn schedules (different days/times)
  * Set timezone (EST/UTC)
  * Verify percentage allocation
  * Delete/edit schedules
- [ ] **Analytics Dashboard:**
  * Expand analytics section
  * Select period (7d/14d/30d/90d/365d)
  * Verify quick stats (spawns, defeats, defeat rate, lifespan)
  * Check tier distribution visualization
  * View top 10 players leaderboard
  * Export CSV → Should download analytics data
- [ ] **Predictive Spawning** (⚠️ Requires FID-20251025-002 completion):
  * Enable predictive mode
  * Set weeks ahead (2-12)
  * View current vs predicted distribution comparison
  * Manually recalculate predictions

#### Test 6.3: Flag System (Press F)
- [ ] Open flag tracker panel (F key)
- [ ] Check factory ownership display (30-sec auto-refresh)
- [ ] Verify real-time updates when factories change hands
- [ ] Test manual refresh button

---

### **SECTION 7: Referral System (15 min)**

#### Test 7.1: Referral Code Generation
- [ ] Go to `/referrals` page
- [ ] Verify unique code displayed (format: DF-XXXXXXXX)
- [ ] Copy referral code → Share with test account

#### Test 7.2: Referral Rewards
- [ ] Create new account → Enter referral code during registration
- [ ] New account reaches Level 2 → Referrer gets Tier 1 reward (1k M + 500 E)
- [ ] New account reaches Level 5 → Tier 2 reward (2k M + 1k E)
- [ ] Continue to Level 50 → All 8 milestones should trigger
- [ ] Verify VIP extension at milestones 5, 7, 8 (7/14/21 days)

#### Test 7.3: Admin Referral Management
- [ ] Go to `/admin` → Referral section
- [ ] View referral stats (total codes, success rate, rewards paid)
- [ ] Check top referrers leaderboard
- [ ] View recent rewards granted
- [ ] Run manual validation check

---

### **SECTION 8: Admin Tools (20 min)**

#### Test 8.1: Admin Dashboard
- [ ] Navigate to `/admin` (admin account required)
- [ ] Verify all sections load:
  * System Stats (uptime, players, resources)
  * Player Management
  * VIP Management
  * Beer Base Configuration
  * Referral Analytics
  * Payment History (if Stripe configured)
  * WMD Controls

#### Test 8.2: Player Management
- [ ] Search for player by username
- [ ] View player details (level, resources, units, VIP status)
- [ ] Grant VIP manually → Set expiration date
- [ ] Revoke VIP → Should remove benefits immediately
- [ ] Adjust player resources (add/remove metal/energy)
- [ ] Ban/unban player
- [ ] View player action logs

#### Test 8.3: System Monitoring
- [ ] Check health endpoint status in admin
- [ ] View database connection stats
- [ ] Redis status (connected/in-memory/unavailable)
- [ ] WebSocket connections count
- [ ] System uptime and version

---

### **SECTION 9: Production Readiness Verification (NEW)**

#### Test 9.1: npm audit (FID-20251025-104)
```bash
# Run in terminal
npm audit

# Expected result: found 0 vulnerabilities ✅
```

#### Test 9.2: Security Headers
- [ ] Open DevTools → Network → Select any request
- [ ] Verify Response Headers include all 7 OWASP headers
- [ ] CSP should allow Stripe, WebSocket, Google Fonts
- [ ] HSTS header (production only)

#### Test 9.3: Health Monitoring
- [ ] Visit `/api/health`
- [ ] Should return 200 with status: "healthy" or "degraded"
- [ ] MongoDB unavailable → Should return 503 "unhealthy"
- [ ] Redis unavailable → Should return 200 "degraded" (fallback active)
- [ ] WebSocket down → Should return 200 "degraded"

#### Test 9.4: Redis Integration (Optional)
- [ ] If REDIS_URL configured → Check `/api/health` shows redis status "ok"
- [ ] Test rate limiting on endpoints:
  * Login: 10 requests/min → 11th should return 429
  * Registration: 5 requests/hour → 6th should return 429
  * Movement: 120 requests/min → 121st should return 429
- [ ] If Redis unavailable → Should gracefully fallback to in-memory

#### Test 9.5: Test Suite (NEW - FID-20251025-104)
```bash
# Run all tests
npm test

# Expected: All tests pass ✅
# - 18 unit tests (Redis rate limiter)
# - 9 integration tests (WebSocket chat)
# - 13 API route tests (channels, ask-veterans)
```

---

## 📊 **TEST RESULTS TRACKING**

### Test Session Information:
- **Date:** _____________
- **Tester:** _____________
- **Environment:** Dev / Staging / Production
- **Browser:** Chrome / Firefox / Safari / Edge
- **Total Tests:** 70+ test cases
- **Pass Rate:** _____ / _____ (target: 95%+)

### Critical Issues Found:
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

### Minor Issues Found:
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

### Performance Notes:
- [ ] Page load times acceptable (< 3s)
- [ ] API response times acceptable (< 500ms)
- [ ] No memory leaks observed
- [ ] No console errors (except expected warnings)

### Security Notes:
- [ ] All security headers present
- [ ] No exposed secrets in console
- [ ] Authentication enforced on protected routes
- [ ] CSRF protection working (where applicable)

---

## 🐛 **BUG REPORTING TEMPLATE**

When bugs are found, use this format for `dev/issues.md`:

```markdown
### [BUG] Short Description
**Date:** YYYY-MM-DD
**Severity:** 🔴 Critical | 🟡 Major | 🟢 Minor
**Section:** (e.g., Movement, Combat, Chat)

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Browser: 
- OS: 
- Account Level: 

**Console Errors:**
```
[Paste any console errors]
```

**Additional Notes:**
[Any other relevant information]
```

---

## ✅ **SIGN-OFF CHECKLIST**

Before declaring testing complete:

### Functionality:
- [ ] All core systems work as expected
- [ ] No critical bugs blocking gameplay
- [ ] Recent changes (production readiness) verified
- [ ] Edge cases tested and handled

### Performance:
- [ ] No significant lag or slowdowns
- [ ] API responses under 500ms average
- [ ] WebSocket connections stable
- [ ] Memory usage acceptable

### Security:
- [ ] npm audit passes (0 vulnerabilities)
- [ ] Security headers verified
- [ ] Health endpoint functional
- [ ] Authentication working correctly

### Documentation:
- [ ] All bugs documented in `dev/issues.md`
- [ ] Test results logged in this file
- [ ] Known limitations documented
- [ ] User-facing documentation updated (if needed)

### Deployment Readiness:
- [ ] All tests passed (95%+ pass rate)
- [ ] No critical/major bugs remain
- [ ] Performance metrics acceptable
- [ ] Security audit complete
- [ ] Database migrations tested
- [ ] Environment variables documented

---

## 📝 **POST-TESTING ACTIONS**

1. **Update Tracking:**
   - Move failed tests to `dev/issues.md`
   - Update `dev/progress.md` with testing results
   - Document any technical debt

2. **Communicate Results:**
   - Provide summary to stakeholders
   - List any blockers for production
   - Estimate time for bug fixes

3. **Plan Next Steps:**
   - Prioritize critical bug fixes
   - Schedule follow-up testing
   - Plan production deployment (if ready)

---

**Testing Guide Version:** 1.0  
**Last Updated:** October 25, 2025  
**Maintained By:** Development Team

---

## 🎯 **QUICK START TESTING COMMANDS**

```bash
# Terminal Commands
npm run dev              # Start dev server
npm test                 # Run test suite
npm audit                # Check dependencies
npm run build            # Test production build
npx tsc --noEmit         # TypeScript check

# Browser Testing
http://localhost:3000/           # Home page
http://localhost:3000/game       # Main game
http://localhost:3000/admin      # Admin panel
http://localhost:3000/api/health # Health check

# Keyboard Shortcuts to Test
Arrow Keys / Numpad    # Movement
H                      # Harvest
R                      # Raid factory/Beer Base
U                      # Unit building (at owned factory)
B                      # Bank panel
C                      # Chat panel
A                      # Achievements
D                      # Discoveries
P                      # Specialization
F                      # Flag tracker
Q                      # Auction house
W                      # WMD panel
M                      # Shrine/Mastery (if applicable)
I                      # Inventory
```

**Ready to start testing!** 🚀

Use this guide systematically to ensure comprehensive coverage of all DarkFrame features. Document all findings and update tracking files accordingly.
