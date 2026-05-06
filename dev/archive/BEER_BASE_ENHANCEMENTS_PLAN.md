# 🍺 Beer Base System Enhancements - Planning Document

**Created:** 2025-10-25  
**Status:** 📋 PLANNING  
**Priority:** 🟢 LOW-MEDIUM (Quality of Life Enhancements)  
**Total Complexity:** 4/5 (Complex multi-feature enhancement)  
**Estimated Time:** 16-20 hours total

---

## 📋 OVERVIEW

Four enhancement features for the Beer Base Smart Spawning System:
1. **Variety Settings** - Minimum variety enforcement
2. **Historical Data** - Player history-based tier prediction
3. **Dynamic Schedules** - Multiple respawn times per week
4. **Analytics Dashboard** - Spawn pattern tracking and visualization

**Current System Status:**
- ✅ Smart spawning algorithm operational (40/30/10/20 distribution)
- ✅ Player level analysis with 15-minute cache
- ✅ Admin controls for all parameters
- ✅ Single weekly respawn schedule (configurable day/hour)

---

## 🎯 FEATURE BREAKDOWN

### [FID-20251025-001] Variety Settings: Minimum Variety Enforcement
**Priority:** 🟡 MEDIUM **Complexity:** 2/5 **Estimate:** 3-4 hours

**Problem:**
Currently, if all players are homogeneous (e.g., all Level 15), the system spawns mostly one tier (Mid). This reduces hunting variety and strategic options.

**Solution:**
Enforce minimum variety percentages across all power tiers regardless of player distribution.

**Configuration Parameters:**
```typescript
interface VarietyConfig {
  enabled: boolean;              // Enable variety enforcement (default: true)
  minWeakPercent: number;        // Min % of WEAK bases (default: 15%)
  minMediumPercent: number;      // Min % of MEDIUM bases (default: 20%)
  minStrongPercent: number;      // Min % of STRONG bases (default: 15%)
  minElitePercent: number;       // Min % of ELITE bases (default: 10%)
  maxSameTierPercent: number;    // Max % from single tier (default: 60%)
}
```

**Algorithm Enhancement:**
1. Calculate player-based distribution (current system)
2. Apply variety minimums if enabled
3. Balance remaining percentage across tiers based on player data
4. Ensure total = 100%

**Example:**
- Current: 100% Mid tier (homogeneous Level 15 players)
- With Variety: 15% WEAK, 25% MEDIUM, 40% STRONG, 15% ELITE, 5% ULTRA
- Result: Players have variety of targets while majority still matches their level

**Files to Modify:**
- `/lib/beerBaseService.ts` [MOD] - Add variety enforcement to `generateSmartPowerTierDistribution()`
- `/app/api/admin/beer-bases/config/route.ts` [MOD] - Add variety config to schema
- `/app/admin/page.tsx` [MOD] - Add variety settings UI controls
- `/types/game.types.ts` [MOD] - Add VarietyConfig interface

**Acceptance Criteria:**
- ✅ Minimum variety percentages configurable via admin panel
- ✅ Algorithm respects minimums while still favoring player levels
- ✅ Total percentages always equal 100%
- ✅ Can be disabled (enabled: false) to use pure player-based distribution

---

### [FID-20251025-002] Historical Data: Player History Analysis
**Priority:** 🟢 LOW-MEDIUM **Complexity:** 3/5 **Estimate:** 5-6 hours

**Problem:**
Current system only analyzes current player levels. Doesn't account for:
- Player growth trends (rapidly leveling players need harder targets)
- Inactive high-level players (skews distribution upward)
- New player influx (needs more low-tier targets)

**Solution:**
Track player level history and use weighted analysis for smarter tier prediction.

**Data Collection:**
```typescript
interface PlayerLevelHistory {
  playerId: string;
  snapshots: Array<{
    level: number;
    timestamp: Date;
    totalPower: number;
  }>;
  growthRate: number;          // Levels per week
  lastActive: Date;
  activityScore: number;       // 0-100 based on login frequency
}
```

**Collection Strategy:**
- Daily snapshot of all active players (cron job)
- Store last 30 days of history (balance detail vs storage)
- Calculate growth rate from linear regression
- Weight recent activity higher (exponential decay)

**Enhanced Algorithm:**
1. Load player level history (30 days)
2. Calculate weighted current distribution (active players = higher weight)
3. Predict future distribution (growth rate analysis)
4. Spawn Beer Bases for predicted player levels (1-2 weeks ahead)

**Example:**
- Player FAME currently Level 12, but growing 2 levels/week
- Current: Spawn mostly WEAK/MEDIUM
- Enhanced: Spawn 30% MEDIUM, 40% STRONG (anticipating growth to Level 16-18)
- Result: Player has appropriate targets when they reach predicted level

**Files to Modify:**
- `/lib/beerBaseService.ts` [MOD] - Add historical analysis functions
- `/lib/playerHistoryService.ts` [NEW] - Player history tracking service
- `/app/api/cron/player-snapshot/route.ts` [NEW] - Daily snapshot cron job
- `/app/api/admin/beer-bases/config/route.ts` [MOD] - Add historical config
- `/app/admin/page.tsx` [MOD] - Add historical settings toggle
- MongoDB collection: `playerLevelHistory` [NEW]

**Configuration:**
```typescript
interface HistoricalConfig {
  enabled: boolean;              // Use historical data (default: false initially)
  lookbackDays: number;          // Days of history to analyze (default: 30)
  activeWeight: number;          // Weight multiplier for active players (default: 2.0)
  predictAheadWeeks: number;     // How far ahead to predict (default: 1-2)
  growthRateSmoothing: number;   // Smoothing factor for growth rate (default: 0.7)
}
```

**Acceptance Criteria:**
- ✅ Daily player snapshots stored in `playerLevelHistory`
- ✅ Growth rate calculation from historical data
- ✅ Weighted distribution favoring active players
- ✅ Predictive spawning based on growth trends
- ✅ Graceful fallback to current system if insufficient history
- ✅ Can be toggled on/off via admin panel

---

### [FID-20251025-003] Dynamic Schedules: Multiple Respawn Times
**Priority:** 🟡 MEDIUM **Complexity:** 2/5 **Estimate:** 3-4 hours

**Problem:**
Current system only supports one weekly respawn (e.g., Sunday 4 AM). This means:
- Players in different timezones may miss respawns
- One-time event creates surge then drought
- Limited flexibility for admin management

**Solution:**
Support multiple respawn schedules per week with timezone awareness.

**Configuration:**
```typescript
interface RespawnSchedule {
  id: string;                    // Unique schedule ID
  enabled: boolean;              // Active/inactive
  dayOfWeek: number;             // 0-6 (Sunday-Saturday)
  hour: number;                  // 0-23 (UTC)
  spawnPercentage: number;       // % of total Beer Bases to spawn (default: 100%)
  timezone: string;              // IANA timezone (e.g., "America/New_York")
}

interface DynamicScheduleConfig {
  enabled: boolean;              // Use dynamic schedules (default: false)
  schedules: RespawnSchedule[];  // Array of schedules
  legacyMode: boolean;           // Use old single-schedule system (default: true)
}
```

**Example Configuration:**
```typescript
schedules: [
  { id: '1', enabled: true, dayOfWeek: 0, hour: 4, spawnPercentage: 50, timezone: 'UTC' },      // Sunday 4 AM UTC (50%)
  { id: '2', enabled: true, dayOfWeek: 3, hour: 16, spawnPercentage: 50, timezone: 'UTC' },     // Wednesday 4 PM UTC (50%)
]
```

**Implementation Strategy:**
1. Migrate existing single schedule to schedules array (backward compatible)
2. Cron job checks all enabled schedules
3. Each schedule spawns its percentage of total Beer Bases
4. Prevent duplicate spawns (track last spawn time per schedule)

**Files to Modify:**
- `/lib/beerBaseService.ts` [MOD] - Support multiple schedules
- `/app/api/cron/respawn-beer-bases/route.ts` [MOD] - Check all schedules
- `/app/api/admin/beer-bases/config/route.ts` [MOD] - Add schedules to config
- `/app/api/admin/beer-bases/schedules/route.ts` [NEW] - CRUD for schedules
- `/app/admin/page.tsx` [MOD] - Schedule management UI

**Admin UI:**
- List of all schedules with enable/disable toggles
- Add/Edit/Delete schedule modal
- Timezone selector with local time preview
- Visual calendar showing all active schedules
- "Next Respawn" countdown for each schedule

**Acceptance Criteria:**
- ✅ Multiple schedules supported (unlimited)
- ✅ Each schedule spawns configurable percentage
- ✅ Timezone conversion handled correctly
- ✅ No duplicate spawns from same schedule
- ✅ Backward compatible with existing single schedule
- ✅ Admin UI for schedule management

---

### [FID-20251025-004] Analytics Dashboard: Spawn Pattern Tracking
**Priority:** 🟢 LOW **Complexity:** 4/5 **Estimate:** 5-6 hours

**Problem:**
No visibility into:
- Beer Base spawn history and patterns
- Player engagement with Beer Bases (attack rates, defeat rates)
- Effectiveness of smart spawning algorithm
- Optimal spawn rates and distributions

**Solution:**
Comprehensive analytics dashboard tracking Beer Base lifecycle and player interactions.

**Data Collection:**
```typescript
interface BeerBaseSpawnEvent {
  timestamp: Date;
  powerTier: PowerTier;
  position: { x: number; y: number };
  specialization: BotSpecialization;
  totalPower: number;
  playerDistributionSnapshot: PlayerLevelDistribution;
  configSnapshot: BeerBaseConfig;
}

interface BeerBaseDefeatEvent {
  timestamp: Date;
  beerBaseId: string;
  powerTier: PowerTier;
  defeatedBy: string;           // Player username
  defeaterLevel: number;
  survivalTime: number;         // Hours from spawn to defeat
  lootValue: number;            // Total resources rewarded
}

interface BeerBaseAnalytics {
  period: string;                // 'day' | 'week' | 'month'
  startDate: Date;
  endDate: Date;
  
  spawns: {
    total: number;
    byTier: Record<PowerTier, number>;
    bySpecialization: Record<BotSpecialization, number>;
  };
  
  defeats: {
    total: number;
    byTier: Record<PowerTier, number>;
    uniqueAttackers: number;
    averageSurvivalTime: number;
    totalLootDistributed: number;
  };
  
  engagement: {
    attackRate: number;          // Attacks per Beer Base
    defeatRate: number;          // % of Beer Bases defeated
    averageAttacksToDefeat: number;
    topAttackers: Array<{ username: string; defeats: number }>;
  };
  
  distribution: {
    targetDistribution: Record<PowerTier, number>;  // What we aimed for
    actualDistribution: Record<PowerTier, number>;   // What we spawned
    defeatDistribution: Record<PowerTier, number>;   // What got defeated
    varianceScore: number;                           // How close to target
  };
}
```

**Analytics Endpoints:**
- `GET /api/admin/beer-bases/analytics/summary` - Overview stats
- `GET /api/admin/beer-bases/analytics/timeline?period=week` - Time-series data
- `GET /api/admin/beer-bases/analytics/distribution` - Tier distribution analysis
- `GET /api/admin/beer-bases/analytics/engagement` - Player interaction metrics

**Dashboard UI Components:**
1. **Overview Cards:**
   - Total Beer Bases spawned (period)
   - Total Beer Bases defeated (period)
   - Defeat rate percentage
   - Total loot distributed

2. **Spawn Distribution Chart:**
   - Pie chart: Target vs Actual vs Defeated distribution by tier
   - Shows if spawning matches algorithm goals

3. **Timeline Chart:**
   - Line graph: Spawns and defeats over time
   - Multiple series: WEAK, MEDIUM, STRONG, ELITE, ULTRA

4. **Engagement Metrics:**
   - Average survival time by tier
   - Attack rate (attacks per Beer Base)
   - Top 10 Beer Base hunters leaderboard

5. **Effectiveness Score:**
   - Algorithm effectiveness (how well distribution matches player levels)
   - Engagement score (player interaction rate)
   - Balance score (variety across tiers)

6. **Recent Activity Log:**
   - Last 20 spawn events
   - Last 20 defeat events
   - Filterable by tier, time range

**Files to Create:**
- `/lib/beerBaseAnalytics.ts` [NEW] - Analytics calculation functions
- `/app/api/admin/beer-bases/analytics/[endpoint]/route.ts` [NEW] - Multiple endpoints
- `/components/admin/BeerBaseAnalyticsDashboard.tsx` [NEW] - Dashboard component
- `/components/admin/BeerBaseSpawnChart.tsx` [NEW] - Chart components
- `/components/admin/BeerBaseTimelineChart.tsx` [NEW]
- `/components/admin/BeerBaseEngagementMetrics.tsx` [NEW]
- `/app/admin/beer-bases/analytics/page.tsx` [NEW] - Analytics page
- MongoDB collections: `beerBaseSpawnEvents`, `beerBaseDefeatEvents` [NEW]

**Files to Modify:**
- `/lib/beerBaseService.ts` [MOD] - Log spawn events
- `/lib/combatService.ts` [MOD] - Log defeat events
- `/app/admin/page.tsx` [MOD] - Add link to analytics dashboard

**Acceptance Criteria:**
- ✅ Spawn events logged with full context
- ✅ Defeat events logged with attacker info
- ✅ Analytics API returns accurate metrics
- ✅ Dashboard visualizes all key metrics
- ✅ Time range filtering (day/week/month)
- ✅ Export analytics data to CSV
- ✅ Real-time updates (auto-refresh every 60s)

---

## 🔗 DEPENDENCIES & ORDER

**Recommended Implementation Order:**

1. **FID-20251025-001: Variety Settings** (3-4 hours)
   - No dependencies
   - Quick win, immediate value
   - Foundation for understanding distribution tuning

2. **FID-20251025-003: Dynamic Schedules** (3-4 hours)
   - No dependencies
   - Moderate complexity, high admin value
   - Improves flexibility immediately

3. **FID-20251025-004: Analytics Dashboard** (5-6 hours)
   - Depends on: Variety Settings (to analyze effectiveness)
   - Requires event logging infrastructure
   - Provides data to validate other enhancements

4. **FID-20251025-002: Historical Data** (5-6 hours)
   - Depends on: Analytics Dashboard (to track effectiveness)
   - Most complex, requires 30 days of data collection
   - Long-term enhancement (needs time to gather history)

**Total Sequential Time:** 16-20 hours (spread over 2-3 weeks for Historical Data maturity)

---

## 📊 TECHNICAL CONSIDERATIONS

### Database Impact
- **New Collections:**
  - `playerLevelHistory` (~365 docs/player/year = ~180KB/player/year with 500 players = 90 MB/year)
  - `beerBaseSpawnEvents` (~52 spawns/year × 500 bases = 26,000 docs/year = ~5 MB/year)
  - `beerBaseDefeatEvents` (~26,000 defeats/year = ~5 MB/year)
  - **Total:** ~100 MB/year with 500 active players

- **Indexing Strategy:**
  - `playerLevelHistory`: Index on `playerId`, `timestamp`
  - `beerBaseSpawnEvents`: Index on `timestamp`, `powerTier`
  - `beerBaseDefeatEvents`: Index on `timestamp`, `defeatedBy`

### Performance Impact
- **Historical Analysis:** 30-day query per spawn calculation
  - Mitigation: Cache results for 1 hour (players don't grow that fast)
  - Estimated query time: 50-100ms with proper indexing

- **Analytics Calculation:** Aggregation over time ranges
  - Mitigation: Pre-calculate daily summaries via cron job
  - Store in `beerBaseAnalyticsSummaries` collection

- **Dashboard Rendering:** Multiple charts and metrics
  - Mitigation: Server-side calculation, client-side caching
  - Auto-refresh every 60s (not real-time)

### Backward Compatibility
- All enhancements must work with existing system
- Legacy single-schedule mode maintained
- Variety enforcement defaults to OFF (opt-in)
- Historical data defaults to OFF until 30 days collected

---

## 🎯 CLARIFICATION QUESTIONS

Before proceeding with implementation, please clarify:

### 1. **Priority & Timing**
   - Do you want all 4 features, or prioritize a subset?
   - Timeline preference: All at once (20 hours) or incremental (1-2 features now)?
   - Any blockers or higher-priority work?

### 2. **Variety Settings**
   - Default variety minimums acceptable? (15% WEAK, 20% MEDIUM, 15% STRONG, 10% ELITE)
   - Should variety apply always, or only when player distribution is too homogeneous (>60% single tier)?
   - UI preference: Simple on/off toggle or full granular control per tier?

### 3. **Historical Data**
   - Acceptable to wait 30 days for full historical analysis? (Can start collecting now, use after maturity)
   - Storage concern with ~100 MB/year growth? (Can implement data retention policy)
   - Growth prediction: 1 week or 2 weeks ahead? (Balance anticipation vs over-prediction)

### 4. **Dynamic Schedules**
   - How many schedules realistically needed? (Impacts UI design - list vs calendar view)
   - Timezone handling: Admin sets UTC or local time? (UTC simpler, local more intuitive)
   - Spawn percentage overlap handling: If schedules overlap, combine percentages or limit to 100%?

### 5. **Analytics Dashboard**
   - Preferred chart library: Chart.js, Recharts, or other? (Affects bundle size and features)
   - Data retention: Keep events forever or archive after X months?
   - Export format: CSV only or also JSON/PDF?
   - Real-time priority: 60s auto-refresh sufficient or need WebSocket real-time?

---

## 💡 ALTERNATIVE APPROACHES

### Simplified Variety (Low-Complexity Alternative)
Instead of granular per-tier minimums:
- Single "variety factor" slider (0-100%)
- 0% = Pure player-based distribution (current)
- 100% = Equal distribution across all tiers (maximum variety)
- 50% = Blend of player-based and equal (balanced)

**Pros:** Simpler UI, easier to understand  
**Cons:** Less precise control, may not meet specific needs

### Historical Data - Lightweight Version
Instead of full 30-day history:
- Track only last level and level-up timestamp
- Calculate "weeks since level up" as growth indicator
- Spawn slightly harder if player recently leveled (< 3 days ago)

**Pros:** Minimal storage, simpler implementation  
**Cons:** Less accurate prediction, no trend analysis

### Schedules - Template System
Instead of custom schedules:
- Pre-built templates: "Twice Weekly", "Daily", "Weekend Only"
- Admin selects template and adjusts times

**Pros:** Faster setup, guided experience  
**Cons:** Less flexible, may not fit all needs

### Analytics - Summary Only
Instead of full dashboard:
- Single summary page with key metrics
- No charts, just numbers
- Manual export to CSV for deeper analysis

**Pros:** Much faster implementation (2-3 hours)  
**Cons:** Less visual, harder to spot trends

---

## 📋 ACCEPTANCE CRITERIA SUMMARY

**FID-20251025-001 (Variety Settings):**
- ✅ Configurable minimum percentages per tier
- ✅ Algorithm balances minimums with player distribution
- ✅ Toggle to enable/disable variety enforcement
- ✅ Admin UI for all variety settings

**FID-20251025-002 (Historical Data):**
- ✅ Daily player level snapshots stored
- ✅ Growth rate calculation from history
- ✅ Predictive spawning 1-2 weeks ahead
- ✅ Graceful fallback if insufficient data
- ✅ Toggle to enable/disable historical analysis

**FID-20251025-003 (Dynamic Schedules):**
- ✅ Multiple schedules supported
- ✅ Each schedule configurable (day/hour/percentage)
- ✅ Timezone handling (UTC or local)
- ✅ Admin UI for schedule CRUD operations
- ✅ Backward compatible with single schedule

**FID-20251025-004 (Analytics Dashboard):**
- ✅ Spawn and defeat events tracked
- ✅ Time-series analysis (day/week/month)
- ✅ Distribution effectiveness metrics
- ✅ Player engagement statistics
- ✅ Visual dashboard with charts
- ✅ Export capability (CSV)

---

## 🎯 NEXT STEPS

**If you want to proceed:**
1. Answer clarification questions above
2. Confirm feature priorities (all 4 or subset)
3. Approve implementation order
4. Say **"proceed"** or **"code"** to enter coding mode

**If you want to discuss:**
- Ask questions about any feature
- Request alternative approaches
- Suggest modifications to scope
- Discuss timeline and priorities

---

**Status:** ⏸️ **AWAITING USER FEEDBACK**  
**Estimated Total Effort:** 16-20 hours (all 4 features)  
**Recommended Approach:** Incremental (1-2 features at a time for faster value delivery)
