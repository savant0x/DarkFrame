# Phase 3 Implementation Plan - DarkFrame

> Detailed week-by-week implementation guide for all Phase 3 systems

**Created:** 2025-10-17  
**Target Start:** 2025-10-17  
**Target Completion:** 2025-11-15 (4 weeks)  
**Total Estimated Time:** 72 hours

---

## 🎯 OVERVIEW

Phase 3 transforms DarkFrame from a basic resource game into a comprehensive strategy MMO with:
- **Advanced economy** (banking, resource exchange)
- **Deep combat** (40 unique units, HP-based PVP)
- **Competitive systems** (10 leaderboard categories)
- **Complete transparency** (activity logging, admin monitoring)
- **Progression mechanics** (XP, leveling, research)

---

## 📅 WEEK 1: ECONOMIC FOUNDATION (Days 1-5)

### **Day 1-2: Banking & Exchange System** (8 hours)
**FID-20251017-018** - CRITICAL Priority

**Implementation Tasks:**
1. **Database Schema** (1 hour)
   - Add `bank: { metal: number, energy: number }` to Player schema
   - Create `BankTransaction` model for audit trail
   - Add indexes for efficient transaction queries

2. **Fixed Bank Locations** (1 hour)
   - Update `mapGeneration.ts` to place banks at exact coordinates:
     * Metal Bank: (25, 25)
     * Energy Bank: (75, 75)
     * Exchange Bank 1: (50, 50)
     * Exchange Bank 2: (100, 100)
   - Add bank tiles to Tile schema with `bankType` field

3. **Bank API Endpoints** (3 hours)
   - `/api/bank/deposit` - Deposit with 1,000 resource fee
   - `/api/bank/withdraw` - Withdraw (no fee)
   - `/api/bank/exchange` - Metal ↔ Energy with 20% fee
   - `/api/bank/balance` - Get player's bank status

4. **Bank UI Components** (3 hours)
   - `BankPanel.tsx` - Main banking interface
   - `ExchangePanel.tsx` - Resource conversion UI
   - Bank modal opens when player at bank tile
   - Shows: Current balance, available to deposit, conversion preview

**Acceptance Test:**
- Player at (25,25) can deposit 10,000 Metal → Bank shows 9,000 (1K fee)
- Player withdraws 5,000 Metal → Inventory +5,000, Bank -5,000
- Player exchanges 1,000 Energy → Receives 800 Metal (20% fee)

---

### **Day 3: Boost Center (Shrine System)** (4 hours)
**FID-20251017-018 (continued)** - CRITICAL Priority

**Implementation Tasks:**
1. **Boost Center Location** (30 min)
   - Place Boost Center at (1, 1) on map generation
   - Add `boostCenter` tile type to Tile schema

2. **Boost Schema** (30 min)
   - Add `activeBoosts` to Player schema:
     ```typescript
     activeBoosts: Array<{
       tier: 'speed' | 'heart' | 'diamond' | 'club';
       expiresAt: Date;
       yieldBonus: number; // +25% per boost (0.25)
     }>;
     ```

3. **Shrine API Endpoints** (2 hours)
   - `/api/shrine/sacrifice` - Trade items for gathering boost
   - `/api/shrine/active` - Get current active boosts
   - `/api/shrine/extend` - Extend boost duration (donate items)
   - Item costs: Speed=3, Heart=10, Diamond=30, Club=60
   - Durations: Speed=1hr, Heart=1hr, Diamond=4hr, Club=8hr
   - Max duration: 8 hours per boost tier
   - Effect: All boosts give +25% resource yield

4. **Shrine UI** (1 hour)
   - `ShrinePanel.tsx` - "Shrine of Remembrance" modal
   - Shows 4 boost tier options in grid layout
   - Each shows: "+25% Resource Yield", duration, cost
   - Active boost timers with countdown (all 4 visible)
   - Total gathering bonus display: "Current Bonus: +50%"
   - Available items summary

**Acceptance Test:**
- Player at (1,1) with 10 cave items can purchase Heart Tier boost
- Boost timer shows "0h 59m" countdown in UI
- Harvesting yields 1,250 Metal (base 1,000 + 25% bonus)
- Player activates Diamond boost → Now shows "+50%" total bonus
- Harvesting yields 1,500 Metal (base 1,000 + 50% bonus)
- Boost expires after 1 hour, yield bonus reduced by 25%

---

### **Day 4-5: Factory Slot System** (10 hours)
**FID-20251017-019** - CRITICAL Priority

**Implementation Tasks:**
1. **Factory Schema Enhancement** (2 hours)
   - Add `level: number` (1-10) to Factory schema
   - Add `slots: { current, max, regenerationRate, lastRegeneration }`
   - Define 10 level progression table in database
   - Upgrade costs scale exponentially

2. **Slot Regeneration Job** (2 hours)
   - Create `scripts/slotRegeneration.ts` cron job
   - Runs every 15 minutes
   - Formula: `slotsToAdd = Math.floor(elapsedHours * factory.regenerationRate)`
   - Update `factory.slots.current` (capped at max)
   - Update `factory.lastRegeneration` timestamp

3. **Factory Upgrade System** (3 hours)
   - `/api/factory/upgrade` - Upgrade factory level
   - Check resource costs (exponential: L2=500, L5=7K, L10=65K)
   - Increment level, update max slots and regen rate
   - Deduct resources from player

4. **Factory Management UI** (3 hours)
   - `FactoryManagementPanel.tsx` - List all owned factories
   - Shows: Coordinates, Level, Slots (current/max), Regen Rate
   - Upgrade button (if resources available)
   - Abandon Empty / Abandon All buttons
   - Slot regeneration progress bar

**Acceptance Test:**
- Factory starts Level 1 with 10,000 slots, 1,000/hr regen
- Player upgrades to Level 2 (costs 500 Metal + 500 Energy)
- Slots increase to 15,000 max, regen to 1,250/hr
- After 1 hour, factory has regenerated 1,250 slots

---

## 📅 WEEK 2: COMBAT & UNITS (Days 6-10)

### **Day 6-7: 40 Unit System** (12 hours)
**FID-20251017-019 (continued)** - CRITICAL Priority

**Implementation Tasks:**
1. **Unit Definitions** (4 hours)
   - Create `lib/unitDefinitions.ts` with all 40 units
   - 20 STR units (5 tiers): Rifleman → Apocalypse Unit
   - 20 DEF units (5 tiers): Barrier → Invincible Wall
   - Each unit: id, name, type, stats (power, hp, slots), cost (metal, energy)

2. **Player Unit Tracking** (2 hours)
   - Add `units: UnitOwnership[]` to Player schema:
     ```typescript
     interface UnitOwnership {
       unitId: string;
       quantity: number;
       totalPower: number; // quantity * unit.stats.power
       totalHP: number;    // quantity * unit.stats.hp
     }
     ```

3. **Unit Building API** (4 hours)
   - `/api/unit/build` - Build units with auto-fill
   - Calculate max buildable: min(resourceLimit, slotLimit)
   - Distribute units across owned factories efficiently
   - Deduct resources and slots from appropriate factories
   - Update player's unit ownership

4. **Unit UI Components** (2 hours)
   - `UnitBuildPanel.tsx` - Unit selection and building interface
   - Shows: Unit card (name, STR/DEF, HP, Slot Cost)
   - Auto-filled quantity input (MAX button)
   - Factory summary: "Available Factories: 10, Total Slots: 90K"
   - Build confirmation with preview

**Acceptance Test:**
- Player with 100K Metal, 50K Energy, 3 factories (33K total slots)
- Selects "Assault Trooper" (1K slots, 3K metal, 1.5K energy each)
- Quantity auto-fills to 33 (slot-limited)
- Units distributed: Factory1(10), Factory2(15), Factory3(8)
- Player owns 33 Assault Troopers (+825 STR total)

---

### **Day 8: Power Balance System** (4 hours)
**FID-20251017-020** - CRITICAL Priority

**Implementation Tasks:**
1. **Balance Calculation** (2 hours)
   - Create `lib/powerService.ts`
   - Calculate totalSTR and totalDEF from player units
   - Ratio formula: `min(STR, DEF) / max(STR, DEF)`
   - Apply multiplier: <0.7 = 0.5x, 0.7-1.5 = 1.0x, >1.5 = 0.8x
   - Store `effectivePower` in Player schema

2. **Balance Indicator UI** (2 hours)
   - `PowerBalanceIndicator.tsx` - Visual balance meter
   - Green zone: 0.7-1.5 ratio (balanced)
   - Yellow zone: 0.5-0.7 or 1.5-2.0 (warning)
   - Red zone: <0.5 or >2.0 (penalty)
   - Warning message: "⚠️ Your army is unbalanced! Build more Defense units."

**Acceptance Test:**
- Player with 10K STR, 5K DEF → Ratio 0.5 → 50% penalty → 7.5K effective power
- Player with 10K STR, 8K DEF → Ratio 0.8 → 100% (no penalty) → 18K effective power
- Warning displays when ratio < 0.7

---

### **Day 9-10: Auto-Fill & Distribution** (6 hours)

**Implementation Tasks:**
1. **Auto-Fill Algorithm** (3 hours)
   - Calculate total available slots across all owned factories
   - Calculate resource-limited max: `min(metal/unitCost.metal, energy/unitCost.energy)`
   - Calculate slot-limited max: `totalSlots / unit.stats.slots`
   - Return `min(resourceLimit, slotLimit)`

2. **Distribution Algorithm** (3 hours)
   - Sort factories by available slots (descending)
   - Allocate units to highest-slot factories first
   - Continue until all units distributed or factories full
   - Return distribution map: `{ factoryId: count }[]`

**Acceptance Test:**
- Player owns factories with: 10K, 15K, 8K available slots
- Wants to build 30 units @ 1K slots each
- Distribution: Factory2(15), Factory1(10), Factory3(5)

---

## 📅 WEEK 3: LEADERBOARDS & ANALYTICS (Days 11-15)

### **Day 11-12: Comprehensive Leaderboard System** (10 hours)
**FID-20251017-026** - HIGH Priority

**Implementation Tasks:**
1. **PlayerStats Schema** (2 hours)
   - Create `models/PlayerStats.ts` with all tracking fields
   - Fields: factoriesOwned, factoriesCaptured, factoryUpgrades, factoryDowngrades
   - Combat: attacksWon, defensesWon
   - Exploration (weekly): cavesEntered, forestsExplored
   - Resources: totalInventory (metal+energy+banked)
   - Shrine (weekly): shrineTributes
   - Metadata: weeklyResetAt

2. **Leaderboard Calculation** (3 hours)
   - Create `lib/leaderboardService.ts`
   - 10 ranking functions (one per category)
   - Sort players by metric, return top 100
   - Cache in Redis with 5-minute TTL

3. **Weekly Reset Job** (2 hours)
   - Create `scripts/weeklyReset.ts` cron job
   - Runs every Monday 00:00 UTC
   - Reset: cavesEntered, forestsExplored, shrineTributes
   - Archive previous week's data

4. **Leaderboard UI** (3 hours)
   - `app/leaderboard/page.tsx` - Full-page leaderboard view
   - `LeaderboardGrid.tsx` - 2x5 grid layout
   - `LeaderboardCard.tsx` - Individual leaderboard (Top 10)
   - Current player highlighted with yellow background
   - WebSocket updates every 60 seconds (optional)

**Acceptance Test:**
- Leaderboard shows 10 categories with Top 10 players each
- "Top Factory Upgraders" sorted by upgrade count
- Weekly stats (Cave Legends) reset every Monday
- Current player highlighted if in Top 10

---

### **Day 13: Activity Logging System** (8 hours)
**FID-20251017-027** - CRITICAL Priority

**Implementation Tasks:**
1. **ActionLog Schema** (2 hours)
   - Create `models/ActionLog.ts`
   - Fields: timestamp, playerId, username, actionType, category, details, success, executionTime
   - Context: ipAddress, userAgent, sessionId
   - Indexes: timestamp, playerId, actionType, category

2. **Logging Service** (2 hours)
   - Create `lib/loggingService.ts`
   - Central logging utility: `logAction(playerId, actionType, details, success)`
   - Extract IP and User-Agent from request headers
   - Measure execution time with performance markers

3. **Logging Middleware** (2 hours)
   - Create `middleware/logMiddleware.ts`
   - Automatically log all API requests
   - Capture: route, method, status code, response time
   - Skip logging for GET requests to `/api/player` (too frequent)

4. **Integrate Logging** (2 hours)
   - Add logging calls to all existing API routes:
     * Login/Logout → AUTH category
     * Harvest → RESOURCE category
     * Factory capture → COMBAT category
     * Unit build → UNIT category
     * Bank deposit → RESOURCE category
     * Shrine tribute → SHRINE category

**Acceptance Test:**
- Player logs in → ActionLog entry created with type "login"
- Player builds units → Log captures: unitType, quantity, resources spent
- Failed factory capture → Log shows success=false with error message
- Admin views logs → Can filter by player, action type, date range

---

## 📅 WEEK 4: ADMIN SYSTEMS (Days 16-20)

### **Day 16-18: Admin Control Panel** (12 hours)
**FID-20251017-028** - HIGH Priority

**Implementation Tasks:**
1. **Admin Authentication** (3 hours)
   - Add `role: 'player' | 'admin'` to User schema
   - Add `permissions: string[]` for fine-grained access
   - Create `/admin/login` route with separate JWT
   - Admin JWT includes `role: 'admin'` claim
   - Session timeout: 30 minutes (stricter than player)

2. **Admin API Endpoints** (4 hours)
   - `/api/admin/stats` - Live dashboard statistics
   - `/api/admin/players/search` - Search by username/ID/IP
   - `/api/admin/players/:id` - Get complete player profile
   - `/api/admin/players/:id/ban` - Ban player with reason
   - `/api/admin/players/:id/modify-resources` - Add/subtract resources
   - `/api/admin/logs` - Query action logs with filters

3. **Admin Dashboard UI** (5 hours)
   - `app/admin/dashboard/page.tsx` - Main admin panel
   - `LiveStatsPanel.tsx` - Active players, total actions, server uptime
   - `LiveActivityStream.tsx` - Real-time action stream (WebSocket)
   - `PlayerSearchPanel.tsx` - Search and profile view
   - `LogFilterPanel.tsx` - Advanced log filtering
   - `AnalyticsChart.tsx` - Hourly activity chart

**Acceptance Test:**
- Admin logs in at `/admin/login` → Redirected to dashboard
- Dashboard shows: 42 active players, 12,453 actions last hour
- Real-time stream updates when players perform actions
- Admin searches "darkwarrior" → View complete profile
- Admin bans player for 7 days with reason → Player can't log in

---

### **Day 19: Security & Monitoring** (6 hours)

**Implementation Tasks:**
1. **Security Alert System** (3 hours)
   - Create `models/SecurityAlert.ts`
   - Create `lib/securityService.ts`
   - Detect suspicious patterns:
     * 5+ failed logins in 5 minutes → Brute force alert
     * Player gains 100K+ resources in 1 minute → Cheat alert
     * Player captures 5+ factories in 10 minutes → Rapid capture alert
     * 100+ API calls in 1 minute → Rate limit alert

2. **Alert Dashboard** (3 hours)
   - `SecurityAlertsPanel.tsx` - Display active alerts
   - Sort by severity: Critical, High, Medium, Low
   - Resolve alert button (marks as handled)
   - Alert detail view with context and player info

**Acceptance Test:**
- Player fails login 5 times → Alert created with severity "High"
- Admin views alerts → Sees "Brute force attempt from IP 192.168.1.100"
- Admin clicks "View Player" → Redirects to player profile

---

### **Day 20: Testing & Integration** (6 hours)

**Integration Tasks:**
1. **End-to-End Testing** (3 hours)
   - Test complete banking flow (deposit, withdraw, exchange)
   - Test unit building with auto-fill across multiple factories
   - Test power balance calculations with various STR/DEF ratios
   - Test leaderboard rankings and weekly resets
   - Test activity logging across all action types
   - Test admin panel: search, ban, resource modification

2. **Performance Optimization** (2 hours)
   - Add Redis caching for leaderboards (5-minute TTL)
   - Index MongoDB collections for efficient queries
   - Optimize slot regeneration job (bulk updates)
   - Test WebSocket performance with 50+ concurrent connections

3. **Documentation** (1 hour)
   - Update README with Phase 3 features
   - Document admin panel usage
   - Create API documentation for new endpoints

---

## 🎯 IMPLEMENTATION PRIORITIES

### **CRITICAL (Must Complete Week 1-2):**
1. Banking & Exchange System
2. Boost Center (Shrine)
3. Factory Slot System
4. 40 Unit System
5. Power Balance System
6. Activity Logging System

### **HIGH (Must Complete Week 3-4):**
7. Comprehensive Leaderboard System
8. Admin Control Panel

### **MEDIUM (Future Enhancement):**
9. Experience & Leveling
10. Research System
11. Security Alert System (basic version in Week 4)

---

## 📊 SUCCESS METRICS

**Week 1 Goals:**
- ✅ All 4 banks functional (deposit, withdraw, exchange)
- ✅ Boost Center active with 4 boost types
- ✅ Factories upgrade from L1 → L10
- ✅ Slot regeneration job running every 15 minutes

**Week 2 Goals:**
- ✅ 40 units defined and buildable
- ✅ Auto-fill calculates max across all factories
- ✅ Power balance penalty applied to rankings
- ✅ Players can build units with resource+slot costs

**Week 3 Goals:**
- ✅ 10 leaderboard categories display Top 10
- ✅ Weekly stats reset every Monday
- ✅ All player actions logged to database
- ✅ Logs include IP, User-Agent, execution time

**Week 4 Goals:**
- ✅ Admin can search and view any player
- ✅ Admin can ban/unban players with reason
- ✅ Admin can modify player resources
- ✅ Real-time action stream in admin dashboard
- ✅ Security alerts detect suspicious activity

---

## 🚨 RISK MITIGATION

**Risk 1: Slot Regeneration Performance**
- **Mitigation:** Batch update all factories in single query
- **Fallback:** Increase cron interval to 30 minutes if needed

**Risk 2: Leaderboard Query Performance**
- **Mitigation:** Redis caching with 5-minute TTL
- **Fallback:** Reduce to Top 50 if queries too slow

**Risk 3: Activity Logging Storage**
- **Mitigation:** Implement log retention (30-90 days)
- **Fallback:** Archive old logs to separate collection

**Risk 4: Admin Panel Security**
- **Mitigation:** Separate authentication, stricter session timeout
- **Fallback:** Add 2FA for admin accounts (future)

---

## 📝 TESTING CHECKLIST

### **Banking System:**
- [ ] Player can deposit Metal at (25,25)
- [ ] 1,000 Metal fee deducted correctly
- [ ] Player can withdraw from bank (no fee)
- [ ] Exchange 1,000 Energy → Receive 800 Metal
- [ ] Bank balance persists across server restarts

### **Boost Center:**
- [ ] Player can sacrifice 3 items → Speed Tier boost (+25% resource yield)
- [ ] Boost timer displays countdown (e.g., "0h 59m")
- [ ] Harvesting yields 1.25x resources with 1 boost active
- [ ] Player can activate multiple boosts (up to 4 simultaneously)
- [ ] 4 boosts active = 2.0x resource yield (base + 100%)
- [ ] Boost expires after duration, yield bonus removed
- [ ] UI shows total gathering bonus: "Current Bonus: +75%" (3 boosts)

### **Factory Slots:**
- [ ] Factory starts L1 with 10K slots, 1K/hr regen
- [ ] Upgrade to L2 costs 500+500, increases to 15K slots
- [ ] Slot regeneration runs every 15 minutes
- [ ] Slots regenerate correctly (e.g., 1K slots after 1 hour)

### **Unit Building:**
- [ ] All 40 units defined and selectable
- [ ] Auto-fill calculates correct max quantity
- [ ] Units distributed efficiently across factories
- [ ] Resources and slots deducted correctly
- [ ] Player unit totals updated (STR/DEF tracked)

### **Power Balance:**
- [ ] 10K STR + 5K DEF → 50% penalty → 7.5K effective
- [ ] Warning displays when ratio < 0.7
- [ ] Balance meter shows green/yellow/red zones

### **Leaderboards:**
- [ ] All 10 categories display Top 10 players
- [ ] "Top Factory Upgraders" sorted correctly
- [ ] Current player highlighted if in Top 10
- [ ] Weekly stats reset every Monday 00:00 UTC

### **Activity Logging:**
- [ ] Login action logged with IP and User-Agent
- [ ] Unit build logged with details (type, quantity, cost)
- [ ] Failed actions logged with success=false
- [ ] Logs queryable by player, action type, date range

### **Admin Panel:**
- [ ] Admin can log in at `/admin/login`
- [ ] Dashboard shows live stats (active players, actions/hour)
- [ ] Real-time action stream updates
- [ ] Admin can search and view player profiles
- [ ] Admin can ban player (7 days with reason)
- [ ] Admin can modify player resources
- [ ] Security alerts detect brute force attempts

---

## 📚 DOCUMENTATION UPDATES NEEDED

1. **README.md** - Add Phase 3 features overview
2. **API_DOCS.md** - Document all new endpoints
3. **ADMIN_GUIDE.md** - Admin panel usage instructions
4. **DEPLOYMENT.md** - Cron job setup (slot regen, weekly reset)
5. **TESTING_GUIDE.md** - Phase 3 testing procedures

---

**Total Estimated Time:** 72 hours  
**Timeline:** 4 weeks (18 hours/week)  
**Target Completion:** 2025-11-15

