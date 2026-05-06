# 🎯 DarkFrame - COMPLETE Phase 3 Plan

**Last Updated:** 2025-10-18  
**Current Phase:** Phase 3 (50% complete - 2 of 4 remaining sub-phases done)  
**Total Remaining:** 12-15 hours (4 sub-phases)

---

## 📋 **PHASE 3 STATUS OVERVIEW**

### ✅ **COMPLETED SUB-PHASES** (2 of 4)

**Already Done:**
1. ✅ **Base Systems** - XP, leveling, tier unlocks, 40 units
2. ✅ **PVP Combat** - Pike attacks, base attacks, battle logs
3. ✅ **Specialization** - Selection, mastery, respec system
4. ✅ **Discovery System** - Cave drops, technology unlocks
5. ✅ **Achievement System** - Unlock conditions, prestige units
6. ✅ **Auction House** - Bidding, buyout, listings
7. ✅ **FID-20251018-P6: Activity & Battle Logging** (JUST COMPLETED - 1 hour)

---

### 🔄 **REMAINING SUB-PHASES** (4 features)

---

## 1️⃣ **FID-20251018-P5: Full Clan System** 🔴 HIGH PRIORITY

**Status:** IN PLANNING (Enhanced Plan Complete)  
**Complexity:** 5/5  
**Original Estimate:** 5-6 hours  
**Enhanced Estimate:** 9-10 hours (with level/perk/banking systems)

### **Core Features:**

#### **Clan Management**
- Creation: 1.5M Metal + 1.5M Energy (admin configurable)
- Solo clan creation allowed (min 1 member)
- Max 100 members
- 6 roles: Leader, Co-Leader, Officer, Elite, Member, Recruit
- 21 granular permissions (including bank/tax management)
- Invite/kick/promote/demote system
- Transfer leadership
- Clan description and MOTD

#### **Clan Level System** (1-50) 🆕
- XP from member actions (harvesting, combat, research, territory)
- Exponential progression curve
- Prestige badges and visual indicators
- **Level Milestones:**
  - Level 5: Unlock clan wars
  - Level 10: Unlock clan bank
  - Level 15: Unlock advanced research
  - Level 20: +10 member slots (110 total)
  - Level 25: Unlock monument control
  - Level 30: +20 member slots (130 total)
  - Level 40: Unlock legendary perks
  - Level 50: Prestige system

#### **Clan Perks System** (Config-driven) 🆕
- 4 categories: COMBAT, ECONOMIC, SOCIAL, STRATEGIC
- Tiered perks: Bronze → Silver → Gold → Legendary
- Active bonuses apply to all members
- Activation costs resources (refundable)
- Examples:
  - COMBAT: +5-25% ATK/DEF/HP
  - ECONOMIC: +10-50% harvest, 0-5% auction fee reduction
  - SOCIAL: Extra chat channels, member slots
  - STRATEGIC: Territory claim discounts, war cost reduction

#### **Clan Banking & Taxes** 🆕
- Clan treasury: Metal, Energy, RP storage
- Tax system: 0-50% rates per resource (Leader only)
- Automatic tax collection on member harvests
- 6 upgrade levels (increasing capacity)
- Transaction history (last 100)
- Withdrawal permissions (Leader/Co-Leader only)

#### **Enhanced Research Tree** (15+ techs) 🆕
- 4 branches: INDUSTRIAL, MILITARY, ECONOMIC, SOCIAL
- Shared RP pool contribution
- Research unlocks require clan level + prerequisites
- Modular config-driven design
- Permanent clan-wide bonuses
- Examples:
  - INDUSTRIAL: Factory efficiency, harvest bonuses
  - MILITARY: ATK/DEF bonuses, unit unlocks
  - ECONOMIC: Auction fees, bank upgrades
  - SOCIAL: Member slots, chat features

#### **Territory Control**
- Claim tiles: 500 Metal + 500 Energy (reduced by perks)
- Must be adjacent to existing territory
- Defense bonus: +10% per adjacent tile (max +50%, boosted by research)
- Max 50 territories per clan

#### **Clan Warfare**
- War declaration: 2000 Metal + 2000 Energy (requires level 5+)
- Territory capture during wars
- War status: DECLARED, ACTIVE, ENDED, TRUCE
- Battle logging integration
- War history tracking

#### **Monuments** (5 total)
- Ancient Forge: +5% Metal production
- War Memorial: +10% ATK
- Market Plaza: -5% auction fees
- Research Lab: +15% RP gain
- Grand Temple: +5% XP gain
- Requires: Level 25+ and 9-tile control (3x3 grid)

#### **Social Features**
- Clan chat (100 message history, 7-day retention)
- Officer/Leader channels (permission-based)
- Additional channels unlocked by perks
- Activity feed with XP tracking
- 16 activity types

#### **Leaderboard** (8 categories)
- Total Power (member XP + territory + research + level)
- Member Count
- Territory Count
- Monuments Controlled
- Wars Won
- Total RP Contributed
- Average Member Level
- Bank Size

### **Implementation Options:**

**Option A: Full Implementation** ⭐ RECOMMENDED (9-10 hours)
- All 6 phases: Core + Types + Level/Perks + Banking + Research + Territory + Warfare + Monuments
- 38 files total (1 type, 10 services, 20 APIs, 7 UI components)

**Option B: Phased Implementation**
- B1: Minimal viable (2h) - Core + banking only
- B2: With progression (4h) - Core + levels + perks
- B3: With research (5.5h) - Core + levels + perks + research
- B4: Everything (9-10h) - Same as Option A

**Option C: Foundation First** (6-7 hours)
- Simplified versions to validate mechanics
- Basic levels (1-10), placeholder perks (3-5), basic research (5 techs)

### **Files to Create (38 total):**

**Types (1):**
- ✅ `types/clan.types.ts` (~900 lines) - COMPLETED, 0 errors

**Services (10):**
- `lib/clanService.ts` - Core clan management
- `lib/clanLevelService.ts` - Level progression, XP, milestones 🆕
- `lib/clanPerkService.ts` - Perk activation, bonuses 🆕
- `lib/clanBankService.ts` - Banking, taxes, transactions 🆕
- `lib/clanResearchService.ts` - Enhanced 4-branch research
- `lib/territoryService.ts` - Territory claiming
- `lib/clanWarfareService.ts` - War system
- `lib/clanMonumentService.ts` - Monument control
- `lib/clanChatService.ts` - Chat system
- `lib/clanLeaderboardService.ts` - 8 ranking types
- `lib/clanActivityService.ts` - Activity feed

**API Routes (20):**
- Core: create, join, leave, invite, kick, promote
- Level: level (GET)
- Perks: available, activate, active
- Bank: deposit, withdraw, setTaxes, upgrade
- Research: contribute, unlock, tree
- Territory: claim, defend
- Warfare: declare, capture
- Monument: control
- Stats: stats/leaderboard

**UI Components (7):**
- `ClanPanel.tsx` - Enhanced with level display
- `ClanLevelDisplay.tsx` - Level progress, milestones 🆕
- `ClanPerkPanel.tsx` - Perk management 🆕
- `ClanBankPanel.tsx` - Banking interface 🆕
- `ClanResearchTree.tsx` - Enhanced 4-branch tree
- `TerritoryMap.tsx` - Territory visualization
- `ClanWarModal.tsx` - War declarations

---

## 2️⃣ **FID-20251018-P7: Full Admin Control Panel** 🟡 MEDIUM PRIORITY

**Status:** PLANNED  
**Complexity:** 4/5  
**Estimate:** 4.5-5.5 hours (increased from 4-5h with config system)

### **Core Features:**

#### **Admin Authentication**
- Separate role-based access control
- Admin-only routes with middleware protection
- Permission system (granular access levels)

#### **Live Dashboard**
- Active players count
- Actions per hour
- Server uptime
- System health metrics
- Real-time action stream (WebSocket)

#### **Player Management**
- Advanced search (username, ID, email)
- Detailed profile viewer
- Ban/unban system with reason tracking
- Resource modification with audit trail
- Factory ownership transfer
- XP/level modification

#### **Game Configuration Management** 🆕
- **Clan Settings:**
  - Creation costs (Metal/Energy)
  - Member limits
  - Territory costs
  - War declaration costs
  - Tax rate limits
- **Economy Settings:**
  - Harvest base rates
  - Factory production multipliers
  - Auction fee percentages
  - Bank capacity multipliers
- **Combat Settings:**
  - ATK/DEF multipliers
  - XP per kill
  - Unit costs
  - Battle duration
- **Progression Settings:**
  - XP curve multipliers
  - Level cap
  - RP contribution rates
  - Discovery rates

#### **Server Settings Editor** 🆕
- Real-time config updates (no restart required)
- Validation before applying changes
- Rollback capability (undo last 10 changes)
- Complete audit trail
- Live preview of changes
- Impact analysis

#### **Activity Log Viewer**
- Advanced filtering (player, action type, date range)
- Search functionality
- CSV export
- Real-time log streaming

#### **Security Monitoring**
- Brute force detection alerts
- Rate limit violation tracking
- Suspicious activity flagging
- IP address monitoring

#### **Analytics & Reporting**
- Hourly activity charts
- Top actions dashboard
- Error rate monitoring
- Player growth metrics
- Resource economy tracking

### **Files to Create (21 total):**

**Pages (6):**
- `app/admin/page.tsx` - Main dashboard
- `app/admin/players/page.tsx` - Player management
- `app/admin/settings/page.tsx` - Game config editor 🆕
- `app/admin/logs/page.tsx` - Activity logs
- `app/admin/security/page.tsx` - Security monitoring
- `app/admin/analytics/page.tsx` - Analytics charts

**Services (3):**
- `lib/adminService.ts` - Admin operations
- `lib/serverConfigService.ts` - Config management 🆕
- `lib/securityService.ts` - Security monitoring

**Types (2):**
- `types/admin.types.ts` - Admin definitions
- `types/serverConfig.types.ts` - Config types 🆕

**API Routes (9):**
- `app/api/admin/dashboard/route.ts`
- `app/api/admin/players/search/route.ts`
- `app/api/admin/players/ban/route.ts`
- `app/api/admin/players/modify/route.ts`
- `app/api/admin/config/get/route.ts` 🆕
- `app/api/admin/config/update/route.ts` 🆕
- `app/api/admin/logs/route.ts`
- `app/api/admin/security/alerts/route.ts`

**Components (4):**
- `components/AdminDashboard.tsx`
- `components/PlayerSearchPanel.tsx`
- `components/GameConfigEditor.tsx` 🆕
- `components/SecurityAlertsPanel.tsx`

**Modifications:**
- `middleware.ts` - Add admin route protection

---

## 3️⃣ **FID-20251018-P8: Manual Testing & Polish** 🔴 HIGH PRIORITY

**Status:** PLANNED  
**Complexity:** 2/5  
**Estimate:** 3-4 hours

### **Testing Scope:**

#### **System Testing:**
- ✅ Base systems (XP, leveling, tier unlocks, 40 units)
- ✅ PVP combat (pike attacks, base attacks, battle logs)
- ✅ Specialization (selection, mastery, respec)
- ✅ Discovery system (cave drops, technology unlocks)
- ✅ Achievement system (unlock conditions, prestige units)
- ✅ Auction house (bidding, buyout, listings)
- ✅ Activity logging (all action types) - JUST COMPLETED
- [ ] Clan system (all features)
- [ ] Admin panel (all management features)
- [ ] Integration testing (all systems working together)
- [ ] Performance testing (database queries, API response times)
- [ ] Security testing (auth, permissions, input validation)

#### **Balance Adjustments:**
- [ ] Unit costs optimization (if needed)
- [ ] Discovery drop rates fine-tuning
- [ ] Auction fee balancing
- [ ] XP progression curve refinement
- [ ] Research point distribution review
- [ ] Clan research cost balancing
- [ ] Territory control balance
- [ ] Clan level XP requirements
- [ ] Perk activation costs
- [ ] Tax rate recommendations

#### **Polish Tasks:**
- [ ] UI/UX improvements based on testing
- [ ] Error message clarity
- [ ] Loading states and transitions
- [ ] Mobile responsiveness checks
- [ ] Performance optimization
- [ ] Code cleanup and refactoring
- [ ] Documentation updates

### **Deliverables:**

**Testing Documentation:**
- `MANUAL_TESTING_CHECKLIST.md` - Complete testing checklist
- `PHASE3_TESTING_GUIDE.md` - Testing procedures
- Balance adjustment summary
- Bug fix documentation

**Documentation Updates:**
- `README.md` - Feature list, setup instructions
- `dev/architecture.md` - System architecture updates
- `dev/metrics.md` - Final Phase 3 metrics
- `dev/lessons-learned.md` - Insights and improvements

### **Acceptance Criteria:**
- [ ] All systems tested end-to-end with zero critical bugs
- [ ] Balance adjustments documented and implemented
- [ ] Performance meets targets (<200ms API responses)
- [ ] All documentation updated
- [ ] Zero TypeScript errors
- [ ] User experience polished and intuitive
- [ ] Edge cases handled gracefully

---

## 📊 **PHASE 3 SUMMARY**

### **Time Breakdown:**

| Feature | Priority | Complexity | Estimate | Status |
|---------|----------|------------|----------|--------|
| FID-20251018-P6: Activity Logging | 🟡 MEDIUM | 3/5 | 3-4h | ✅ COMPLETE (1h actual) |
| FID-20251018-P5: Clan System | 🔴 HIGH | 5/5 | 9-10h | 📋 PLANNED |
| FID-20251018-P7: Admin Panel | 🟡 MEDIUM | 4/5 | 4.5-5.5h | 📋 PLANNED |
| FID-20251018-P8: Testing & Polish | 🔴 HIGH | 2/5 | 3-4h | 📋 PLANNED |

**Remaining Work:** 16.5-19.5 hours (3 features)  
**Estimated Completion:** 2-3 days of focused work

---

## 🚀 **POST-PHASE 3: FUTURE PHASES**

### **Phase 4: Enhanced Social Features** (8-10 hours)
- Private messaging between players
- Friends list with online status
- Clan diplomacy (alliances, NAPs)
- Gift system (send resources/items)
- Trade reputation system
- Player profiles with achievements
- Notification system

### **Phase 5: Advanced Map Features** (10-12 hours)
- Fog-of-war system
- Minimap component
- Fast travel system
- World events (meteor showers, invasions)
- Dynamic tile events
- Map bookmarks and waypoints
- Exploration achievements

### **Phase 6: Mobile Optimization & PWA** (6-8 hours)
- Responsive mobile layout
- Touch-friendly UI
- Swipe gestures for movement
- Progressive Web App manifest
- Offline capability with service workers
- Install to home screen

**Total Future Work:** 24-30 hours

---

## 🎯 **RECOMMENDED EXECUTION ORDER**

### **Today (2025-10-18):**
1. **Choose P5 Implementation Path** (A, B, or C)
2. **Begin P5 Implementation** (9-10h for Option A)
   - Phase 1: Core + Banking (2h)
   - Phase 2: Level/Perks (2h)
   - Phase 3: Research (1.5h)
   - Phase 4: Territory/Warfare (1.5h)
   - Phase 5: Monuments/Social (1.5h)
   - Phase 6: Polish (0.5h)

### **Day 2:**
3. **Implement P7 Admin Panel** (4.5-5.5h)
   - Include server config management
   - Clan cost configuration
   - Real-time updates

### **Day 3:**
4. **Complete P8 Testing & Polish** (3-4h)
   - Manual testing all systems
   - Balance adjustments
   - Documentation updates
   - **PHASE 3 COMPLETE** 🎉

---

## 📈 **SUCCESS METRICS**

**Phase 3 Completion Criteria:**
- ✅ All 4 remaining features implemented
- ✅ 0 TypeScript errors across all files
- ✅ All acceptance criteria met
- ✅ Complete documentation
- ✅ Manual testing checklist complete
- ✅ Performance targets met (<200ms API)
- ✅ /dev tracking updated
- ✅ Features moved to completed.md

**Key Performance Indicators:**
- Feature delivery velocity: ~3-4 features/week
- Code quality: 0 errors, 100% JSDoc coverage
- Estimation accuracy: Within 25% of estimates
- User experience: Polished and intuitive

---

## 💡 **KEY DECISIONS PENDING**

1. **P5 Clan System Implementation Path:**
   - Option A: Full (9-10h) ⭐ RECOMMENDED
   - Option B: Phased (choose B1/B2/B3/B4)
   - Option C: Foundation (6-7h)

2. **Admin Config System Scope:**
   - Minimum: Clan costs only
   - Recommended: All game balance values
   - Future: Event multipliers, A/B testing

3. **Testing Approach:**
   - Manual testing only (per user requirement)
   - No automated test packages
   - Focus on end-to-end validation

---

**Ready to proceed? Choose P5 implementation path (A/B/C) and say "proceed"!** 🚀
