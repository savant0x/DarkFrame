# DarkFrame - Phase 2 Major Update Planning

> Comprehensive planning document for 9-feature project update  
> **Status:** PLANNING PHASE  
> **Created:** 2025-10-17  
> **Target:** Phase 2 Enhancement & Expansion

---

## 📋 EXECUTIVE SUMMARY

**Scope:** 9 major features across 5 categories  
**Estimated Duration:** 4-6 weeks (120-180 hours)  
**Priority Level:** HIGH  
**Dependencies:** Phase 1 complete, Factory System complete

**Feature Categories:**
1. **System Stability** (1 feature) - Critical priority
2. **Authentication** (1 feature) - High priority  
3. **UI Components** (3 features) - Medium-High priority
4. **Resource Infrastructure** (5 features) - Medium priority
5. **Resource Mechanics** (2 features) - Medium priority

---

## 🚨 FEATURE BREAKDOWN & PRIORITIZATION

### 🔴 **CRITICAL PRIORITY** (Week 1)

#### [FID-20251017-003] General Codebase Stabilization

**📊 Status:** PLANNED  
**🎯 Priority:** CRITICAL  
**🔢 Complexity:** 3  
**⏱️ Estimate:** 12-16 hours  
**📅 Target:** Week 1 Days 1-2

**📝 Description:**
Review and resolve 607 known TypeScript/compilation issues. Most are JSX false positives from missing type definitions, but need systematic review to identify real bugs vs configuration issues. Focus on actual runtime errors, type safety violations, and performance bottlenecks.

**🎯 Acceptance Criteria:**
- [ ] All 607 errors categorized (false positive vs real issue)
- [ ] JSX type definition issues resolved (tsconfig.json update)
- [ ] Real bugs identified and documented
- [ ] Critical errors fixed (blocking functionality)
- [ ] Medium errors fixed (type safety, performance)
- [ ] Low-priority errors documented for future work
- [ ] Error count reduced to <50 (mostly warnings)
- [ ] All core features functional and tested

**🏗️ Technical Approach:**

**Error Analysis:**
```typescript
// Current errors breakdown (estimated):
// - 550+ JSX false positives (missing @types/react config)
// - 30-40 Type safety issues (missing types, any usage)
// - 15-20 Import/module resolution issues
// - 10-15 Actual bugs (logic errors, null checks)
```

**Resolution Strategy:**
1. **Fix JSX Errors** (2 hours) - Update tsconfig.json, add proper React types
2. **Type Safety** (4 hours) - Add missing interfaces, remove `any` usage
3. **Import Resolution** (2 hours) - Fix path aliases, module exports
4. **Bug Fixes** (4-6 hours) - Runtime errors, logic issues, edge cases
5. **Testing** (2 hours) - Verify all features work post-fixes

**📁 Files Affected:**
- `tsconfig.json` [MOD] - Add JSX type definitions
- `package.json` [MOD] - Ensure @types/react installed
- `/types/game.types.ts` [MOD] - Add missing type exports
- Various component files [MOD] - Fix type issues
- Various service files [MOD] - Add null checks, error handling

**🔗 Dependencies:**
- **Blocks:** ALL other features (must stabilize first)

---

### 🔴 **HIGH PRIORITY** (Week 1-2)

#### [FID-20251017-004] Cookie-Based Authentication Persistence

**📊 Status:** PLANNED  
**🎯 Priority:** HIGH  
**🔢 Complexity:** 4  
**⏱️ Estimate:** 10-12 hours  
**📅 Target:** Week 1 Days 3-5

**📝 Description:**
Implement secure cookie-based session persistence with "Remember Me" functionality. Currently, users must re-login on every page refresh. Add HTTP-only cookies with configurable expiration, CSRF protection, and automatic token refresh. Support both session cookies (browser close) and persistent cookies (30 days).

**🎯 Acceptance Criteria:**
- [ ] "Remember Me" checkbox on login page
- [ ] Session cookies set on successful login (HTTP-only, Secure)
- [ ] Token stored with 30-day expiration when "Remember Me" checked
- [ ] 1-hour expiration for session-only login
- [ ] Middleware verifies cookie on protected routes
- [ ] Automatic redirect to /login if cookie invalid/expired
- [ ] Token refresh mechanism (silent renewal before expiry)
- [ ] Logout clears cookies completely
- [ ] CSRF token protection implemented
- [ ] Cookie security flags set (SameSite, Secure, HTTP-only)

**🏗️ Technical Approach:**

**Authentication Flow:**
```typescript
// Login flow with cookie persistence
POST /api/auth/login
├─ Validate credentials
├─ Generate JWT token (username, rank, base location)
├─ Set HTTP-only cookie:
│  └─ Name: "darkframe_session"
│  └─ Value: JWT token
│  └─ Max-Age: 3600 (1 hour) or 2592000 (30 days)
│  └─ Secure: true (HTTPS only in production)
│  └─ HTTP-only: true (no JavaScript access)
│  └─ SameSite: 'lax' (CSRF protection)
└─ Return success response

// Middleware authentication check
Middleware on /game routes
├─ Extract cookie from request headers
├─ Verify JWT signature and expiration
├─ If valid: Allow access, attach user to request
├─ If invalid/expired: Redirect to /login
└─ If refresh needed: Generate new token, update cookie
```

**Security Considerations:**
- JWT secret stored in environment variable (32+ bytes)
- Token includes: username, rank, base location, issued timestamp
- No sensitive data in token (password hashes excluded)
- Token refresh 5 minutes before expiry
- Brute-force protection (rate limiting on login endpoint)
- Session invalidation on password change

**📁 Files Affected:**
- `/app/login/page.tsx` [MOD] - Add "Remember Me" checkbox
- `/app/api/auth/login/route.ts` [MOD] - Set cookies on success
- `/app/api/auth/logout/route.ts` [NEW] - Clear cookies endpoint
- `/middleware.ts` [NEW] - Cookie verification for protected routes
- `/lib/auth.ts` [NEW] - JWT token generation/verification utilities
- `/lib/cookieService.ts` [NEW] - Cookie management helpers
- `/.env.local` [MOD] - Add JWT_SECRET variable

**🔗 Dependencies:**
- **Depends on:** [FID-20251017-003] Stabilization
- **Blocks:** Server Time Display (needs auth context)

**💡 Suggestions:**
- Consider adding "Logout on all devices" feature (session invalidation)
- Add "Active sessions" management panel
- Log login history for security audit

---

### 🟡 **MEDIUM-HIGH PRIORITY** (Week 2-3)

#### [FID-20251017-005] Inventory Panel UI Component

**📊 Status:** PLANNED  
**🎯 Priority:** MEDIUM-HIGH  
**🔢 Complexity:** 3  
**⏱️ Estimate:** 8-10 hours  
**📅 Target:** Week 2 Days 1-2

**📝 Description:**
Build comprehensive Inventory Panel component to display player's resources, items, units, and digger bonuses. Currently, InventoryPanel exists but needs expansion for cave items, filtering, sorting, and visual polish. Add keyboard shortcut (I key), category tabs, search functionality, and item details modal.

**🎯 Acceptance Criteria:**
- [ ] I key toggles inventory panel overlay
- [ ] Display resources: Metal, Energy with icons and amounts
- [ ] Display cave items: Diggers (by type), Tradeable items
- [ ] Display units: SOLDIER count, total power contribution
- [ ] Category tabs: All, Resources, Items, Units, Diggers
- [ ] Filter by item type (Metal Digger, Energy Digger, etc.)
- [ ] Sort options: Name, Quantity, Rarity, Date Acquired
- [ ] Search bar for item name filtering
- [ ] Item details on click: Name, description, rarity, quantity
- [ ] Digger bonus display: "+45% Metal Gathering"
- [ ] Smooth slide-in animation from right side
- [ ] Close on ESC key or X button

**🏗️ Technical Approach:**

**Component Structure:**
```typescript
InventoryPanel
├─ Header
│  ├─ Title "Inventory"
│  ├─ Close button (X)
│  └─ Search bar
├─ Category Tabs
│  ├─ All
│  ├─ Resources (Metal, Energy)
│  ├─ Items (Cave items, tradeable)
│  ├─ Units (SOLDIER units)
│  └─ Diggers (bonus view)
├─ Filters & Sort
│  ├─ Filter dropdown (item type)
│  └─ Sort dropdown (name, qty, rarity, date)
├─ Item Grid
│  ├─ Item cards with icons
│  ├─ Quantity badges
│  └─ Rarity color coding
└─ Item Details Modal
   ├─ Full description
   ├─ Stats/bonuses
   └─ Actions (if applicable)
```

**Data Loading:**
```typescript
// Fetch inventory data
GET /api/inventory?username={username}
Returns:
{
  resources: { metal: number, energy: number },
  items: InventoryItem[],
  units: Unit[],
  diggers: {
    metalDiggers: number,
    energyDiggers: number,
    metalBonus: number,
    energyBonus: number
  }
}
```

**📁 Files Affected:**
- `/components/InventoryPanel.tsx` [MOD] - Expand with tabs, filters, search
- `/app/api/inventory/route.ts` [MOD] - Add units and digger bonus data
- `/components/ItemDetailsModal.tsx` [NEW] - Item detail popup
- `/app/globals.css` [MOD] - Add slide-in animations
- `/hooks/useKeyboard.ts` [NEW] - Keyboard shortcut manager

**🔗 Dependencies:**
- **Depends on:** [FID-20251017-003] Stabilization
- **Related:** Cave system (already implemented)

---

#### [FID-20251017-006] Factory Management Panel UI Component

**📊 Status:** PLANNED  
**🎯 Priority:** MEDIUM-HIGH  
**🔢 Complexity:** 4  
**⏱️ Estimate:** 10-12 hours  
**📅 Target:** Week 2 Days 3-5

**📝 Description:**
Create Factory Management Panel for controlling multiple owned factories. Display factory locations, defense stats, unit production status, slot usage, and production controls. Add keyboard shortcut (M key for "Manage"), factory selection, production queue, and upgrade preview (for future Phase 3).

**🎯 Acceptance Criteria:**
- [ ] M key toggles factory management panel
- [ ] List all player-owned factories with stats
- [ ] Display per factory: Location, Defense, Slots used/max, Production rate
- [ ] Show unit production status: "2 units ready", "Next unit in 45 min"
- [ ] Production controls: "Produce Unit" button per factory
- [ ] Real-time slot availability check (max 20)
- [ ] Resource cost display: 100 Metal + 50 Energy per unit
- [ ] Factory selection highlights location on map (future)
- [ ] Production history log: Last 10 units produced
- [ ] Sorting: By location, defense, slots available
- [ ] Empty state: "No factories owned. Capture one to get started!"
- [ ] Smooth slide-in animation from right side

**🏗️ Technical Approach:**

**Component Structure:**
```typescript
FactoryPanel
├─ Header
│  ├─ Title "Factory Management"
│  ├─ Close button (X)
│  └─ Total factories count
├─ Factory List
│  ├─ Factory Card (per owned factory)
│  │  ├─ Location badge (X, Y)
│  │  ├─ Defense: 750 🛡️
│  │  ├─ Slots: 12/20 ⚙️
│  │  ├─ Production: 1 unit/hour ⏱️
│  │  ├─ Status: "3 units ready" or "Next: 25 min"
│  │  └─ Actions
│  │     ├─ "Produce Unit" button (if resources available)
│  │     ├─ "Collect Units" button (if units ready)
│  │     └─ "Go to Factory" button (navigate map)
│  └─ Production Queue
│     └─ Visual progress bar per factory
├─ Resource Summary
│  ├─ Current: 5,000 Metal, 2,500 Energy
│  └─ Unit cost: 100 Metal + 50 Energy
└─ Production Log
   └─ Recent unit creations with timestamps
```

**Data Loading:**
```typescript
// Fetch player's factories
GET /api/factory/list?username={username}
Returns:
{
  factories: Factory[],
  totalUnits: number,
  slotsUsed: number,
  slotsAvailable: number
}

// Produce unit
POST /api/factory/produce
Body: { username, x, y }
Returns: { success, unit?, message }
```

**📁 Files Affected:**
- `/components/FactoryPanel.tsx` [NEW] - Main factory management component
- `/components/FactoryCard.tsx` [NEW] - Individual factory display
- `/components/ProductionQueue.tsx` [NEW] - Visual production progress
- `/app/api/factory/list/route.ts` [EXISTS] - Already created
- `/app/api/factory/produce/route.ts` [EXISTS] - Already created
- `/app/game/page.tsx` [MOD] - Add M key handler and panel toggle

**🔗 Dependencies:**
- **Depends on:** [FID-20251017-002] Factory System (90% complete)
- **Blocks:** Factory upgrade system (Phase 3)

---

#### [FID-20251017-007] Server Time Display Component

**📊 Status:** PLANNED  
**🎯 Priority:** MEDIUM  
**🔢 Complexity:** 2  
**⏱️ Estimate:** 4-6 hours  
**📅 Target:** Week 3 Day 1

**📝 Description:**
Add visible server time clock synced with backend. Display current server time in header, harvest reset countdowns, and event timers. Use WebSocket or polling for synchronization. Critical for resource reset mechanics (12 AM and 12 PM splits).

**🎯 Acceptance Criteria:**
- [ ] Server time displayed in header: "Server: 14:35:27 UTC"
- [ ] Clock updates every second with smooth animation
- [ ] Sync with server time on load and every 5 minutes
- [ ] Display next reset time: "Tiles 1-75 reset in: 9h 24m"
- [ ] Color-coded warnings: Green (>2h), Yellow (30min-2h), Red (<30min)
- [ ] Timezone display: UTC with optional local time
- [ ] Time zone toggle: UTC ↔ Local
- [ ] Offline mode: Uses browser time with warning indicator
- [ ] Connection status indicator: 🟢 Synced / 🟡 Syncing / 🔴 Offline

**🏗️ Technical Approach:**

**Time Synchronization:**
```typescript
// Server time endpoint
GET /api/time
Returns: {
  serverTime: ISO timestamp,
  nextReset1: ISO timestamp, // Midnight reset (tiles 1-75)
  nextReset2: ISO timestamp, // Noon reset (tiles 76-150)
  serverTimezone: 'UTC'
}

// Client sync strategy
1. Fetch server time on mount
2. Calculate offset: serverTime - clientTime
3. Apply offset to all time calculations
4. Re-sync every 5 minutes (300,000ms)
5. Display offset-corrected time
```

**Component Architecture:**
```typescript
ServerTimeClock
├─ Current Time Display
│  ├─ HH:MM:SS format
│  ├─ Timezone indicator
│  └─ Sync status icon
├─ Reset Countdown
│  ├─ Next reset in: Xh Ym
│  ├─ Color-coded urgency
│  └─ Reset type indicator
└─ Timezone Toggle
   └─ UTC ↔ Local button
```

**📁 Files Affected:**
- `/components/ServerTimeClock.tsx` [NEW] - Main time display component
- `/app/api/time/route.ts` [NEW] - Server time endpoint
- `/lib/timeSync.ts` [NEW] - Time synchronization utilities
- `/components/GameLayout.tsx` [MOD] - Add clock to header
- `/hooks/useServerTime.ts` [NEW] - Custom hook for time sync

**🔗 Dependencies:**
- **Depends on:** [FID-20251017-003] Stabilization
- **Related:** Harvest reset system (already implemented)

---

### 🟢 **MEDIUM PRIORITY** (Week 3-4)

#### [FID-20251017-008] Metal Bank Structure (25, 25)

**📊 Status:** PLANNED  
**🎯 Priority:** MEDIUM  
**🔢 Complexity:** 3  
**⏱️ Estimate:** 6-8 hours  
**📅 Target:** Week 3 Days 2-3

**📝 Description:**
Add Metal Bank interactive structure at coordinates (25, 25). Players can deposit a percentage of their metal resources for safekeeping. Bank charges 1% storage fee on deposit. Stored resources are immune to future PvP raids (Phase 3). Implements resource security and economic sink.

**🎯 Acceptance Criteria:**
- [ ] Bank tile at (25, 25) with unique terrain type "METAL_BANK"
- [ ] Special bank image/icon displays on tile
- [ ] B key opens bank interface when on bank tile
- [ ] Deposit UI: Slider to select percentage (0-100%)
- [ ] **Bank Fees: 5% storage fee and 5% exchange fee (APPROVED)**
- Deposit calculation: Amount = (metal * percentage) * 0.95 (5% fee)
- [ ] Withdraw UI: Slider to select amount (up to stored balance)
- [ ] Transaction confirmation modal with fee breakdown
- [ ] Balance display: Available Metal, Banked Metal, Total Metal
- [ ] Transaction history: Last 10 deposits/withdrawals
- [ ] Fee collection tracked for economy monitoring
- [ ] Cannot deposit if metal < 100 (minimum threshold)
- [ ] Smooth animations for UI transitions

**🏗️ Technical Approach:**

**Database Schema:**
```typescript
// Banks collection
interface Bank {
  type: 'METAL' | 'ENERGY';
  x: number;
  y: number;
  totalDeposits: number;
  totalWithdrawals: number;
  feesCollected: number;
  activeAccounts: number;
}

// PlayerBank collection (one per player)
interface PlayerBank {
  username: string;
  metalBanked: number;
  energyBanked: number;
  transactions: Transaction[];
}

interface Transaction {
  type: 'DEPOSIT' | 'WITHDRAW';
  resource: 'METAL' | 'ENERGY';
  amount: number;
  fee: number;
  timestamp: Date;
}
```

**API Endpoints:**
```typescript
GET /api/bank/balance?username={user}
Returns: { metalBanked, energyBanked, lastTransaction }

POST /api/bank/deposit
Body: { username, resource: 'METAL', amount }
Returns: { success, amountDeposited, feeCharged, newBalance }

POST /api/bank/withdraw
Body: { username, resource: 'METAL', amount }
Returns: { success, amountWithdrawn, newBalance }

GET /api/bank/history?username={user}
Returns: { transactions: Transaction[] }
```

**📁 Files Affected:**
- `/types/game.types.ts` [MOD] - Add TerrainType.METAL_BANK
- `/lib/mapGenerator.ts` [MOD] - Set tile (25,25) as METAL_BANK
- `/components/BankInterface.tsx` [NEW] - Deposit/withdraw UI
- `/components/TileRenderer.tsx` [MOD] - Show bank icon on bank tiles
- `/app/api/bank/balance/route.ts` [NEW] - Get balance
- `/app/api/bank/deposit/route.ts` [NEW] - Deposit resources
- `/app/api/bank/withdraw/route.ts` [NEW] - Withdraw resources
- `/app/api/bank/history/route.ts` [NEW] - Transaction history
- `/lib/bankService.ts` [NEW] - Bank business logic
- `/app/game/page.tsx` [MOD] - Add B key handler

**🔗 Dependencies:**
- **Depends on:** [FID-20251017-003] Stabilization
- **Related:** Energy Bank, Exchange Banks

**💡 Suggestions:**
- Consider interest system (earn 0.1% per day on banked resources)
- Add bank capacity limits to create scarcity
- Implement "bank run" event for gameplay drama

---

#### [FID-20251017-009] Energy Bank Structure (75, 75)

**📊 Status:** PLANNED  
**🎯 Priority:** MEDIUM  
**🔢 Complexity:** 3  
**⏱️ Estimate:** 4-6 hours  
**📅 Target:** Week 3 Days 4-5

**📝 Description:**
Add Energy Bank interactive structure at coordinates (75, 75). Identical functionality to Metal Bank but for energy resources. Players deposit energy with 1% fee for secure storage. Shared transaction history system with metal bank.

**🎯 Acceptance Criteria:**
- [ ] Bank tile at (75, 75) with unique terrain type "ENERGY_BANK"
- [ ] Special bank image/icon displays on tile
- [ ] B key opens bank interface when on bank tile
- [ ] Deposit UI: Slider to select percentage (0-100%)
- [ ] Deposit calculation: Amount = (energy * percentage) * 0.99 (1% fee)
- [ ] Withdraw UI: Slider to select amount (up to stored balance)
- [ ] Balance display: Available Energy, Banked Energy, Total Energy
- [ ] Transaction history shared with Metal Bank
- [ ] Cannot deposit if energy < 100 (minimum threshold)
- [ ] Same security and UI as Metal Bank

**🏗️ Technical Approach:**

**Reuse Metal Bank Infrastructure:**
- Same BankInterface component with resource prop
- Same API endpoints with resource parameter
- Shared bankService logic with resource type switch
- Unified transaction history

**Implementation:**
```typescript
// Reuse existing components:
<BankInterface 
  resource="ENERGY" 
  location={{ x: 75, y: 75 }}
/>

// API calls identical to Metal Bank:
POST /api/bank/deposit
Body: { username, resource: 'ENERGY', amount }
```

**📁 Files Affected:**
- `/types/game.types.ts` [MOD] - Add TerrainType.ENERGY_BANK
- `/lib/mapGenerator.ts` [MOD] - Set tile (75,75) as ENERGY_BANK
- `/components/BankInterface.tsx` [MOD] - Support resource="ENERGY"
- `/lib/bankService.ts` [MOD] - Add energy bank logic
- All bank APIs already support both resources

**🔗 Dependencies:**
- **Depends on:** [FID-20251017-008] Metal Bank (reuses infrastructure)

---

#### [FID-20251017-010] Exchange Bank Structures (50,50 & 100,100)

**📊 Status:** PLANNED  
**🎯 Priority:** MEDIUM  
**🔢 Complexity:** 4  
**⏱️ Estimate:** 8-10 hours  
**📅 Target:** Week 4 Days 1-3

**📝 Description:**
Add two Exchange Bank structures at (50,50) and (100,100). Players convert metal ↔ energy with transaction fees. Exchange rate: 1 Metal = 1 Energy (1:1 base rate). Transaction fee: 5% of converted amount. Creates resource liquidity and economy balancing.

**🎯 Acceptance Criteria:**
- [ ] Exchange bank tiles at (50,50) and (100,100)
- [ ] Unique terrain type "EXCHANGE_BANK"
- [ ] E key opens exchange interface when on exchange tile
- [ ] Conversion options: Metal → Energy OR Energy → Metal
- [ ] Exchange rate display: "1 Metal = 1 Energy (base rate)"
- [ ] Fee calculation: 5% of input amount deducted
- [ ] Input slider: Select amount to convert (0-100% of resource)
- [ ] Real-time calculation preview:
  - "Convert 1,000 Metal → Receive 950 Energy (50 fee)"
- [ ] Confirmation modal with conversion breakdown
- [ ] Transaction limits: Minimum 100 resources to convert
- [ ] Exchange history: Last 10 conversions
- [ ] Daily exchange stats: Volume, fees collected

**🏗️ Technical Approach:**

**Exchange Calculation:**
```typescript
// Metal to Energy conversion
const feeRate = 0.05; // 5% fee
const inputAmount = playerMetal * percentage;
const feeAmount = Math.floor(inputAmount * feeRate);
const receiveAmount = inputAmount - feeAmount;

// Example: Convert 1,000 Metal
// Fee: 1000 * 0.05 = 50
// Receive: 1000 - 50 = 950 Energy
// Player loses: 1000 Metal
// Player gains: 950 Energy
```

**Database Schema:**
```typescript
interface ExchangeBank {
  x: number;
  y: number;
  totalVolume: number;
  totalFees: number;
  metalToEnergyCount: number;
  energyToMetalCount: number;
}

interface ExchangeTransaction {
  username: string;
  fromResource: 'METAL' | 'ENERGY';
  toResource: 'METAL' | 'ENERGY';
  inputAmount: number;
  receiveAmount: number;
  feeAmount: number;
  exchangeLocation: { x: number, y: number };
  timestamp: Date;
}
```

**API Endpoints:**
```typescript
GET /api/exchange/rates
Returns: {
  baseRate: 1.0, // 1:1
  feePercent: 5,
  minimumAmount: 100
}

POST /api/exchange/convert
Body: {
  username,
  fromResource: 'METAL',
  toResource: 'ENERGY',
  amount: 1000
}
Returns: {
  success: true,
  inputAmount: 1000,
  receiveAmount: 950,
  feeAmount: 50,
  newBalances: { metal: 4000, energy: 3950 }
}

GET /api/exchange/history?username={user}
Returns: { transactions: ExchangeTransaction[] }
```

**📁 Files Affected:**
- `/types/game.types.ts` [MOD] - Add TerrainType.EXCHANGE_BANK
- `/lib/mapGenerator.ts` [MOD] - Set tiles (50,50) and (100,100)
- `/components/ExchangeInterface.tsx` [NEW] - Conversion UI
- `/components/ConversionPreview.tsx` [NEW] - Real-time calculation display
- `/app/api/exchange/rates/route.ts` [NEW] - Get exchange rates
- `/app/api/exchange/convert/route.ts` [NEW] - Perform conversion
- `/app/api/exchange/history/route.ts` [NEW] - Transaction history
- `/lib/exchangeService.ts` [NEW] - Exchange business logic
- `/app/game/page.tsx` [MOD] - Add E key handler

**🔗 Dependencies:**
- **Depends on:** [FID-20251017-003] Stabilization
- **Related:** Metal Bank, Energy Bank

**💡 Suggestions:**
- Consider dynamic exchange rates (supply/demand based)
- Add volume bonuses (reduce fee for large conversions)
- Implement "market maker" system (player-set exchange rates)

---

#### [FID-20251017-011] Boost Station Structure (1, 1)

**📊 Status:** PLANNED  
**🎯 Priority:** MEDIUM  
**🔢 Complexity:** 4  
**⏱️ Estimate:** 10-12 hours  
**📅 Target:** Week 4 Days 4-5

**📝 Description:**
Add Boost Station at (1,1) where players trade cave items for temporary gathering boosts. Trade 5 tradeable items for +10% gathering boost (1 hour duration). Trade 3 Diggers for +25% boost (30 minutes). Multiple boosts don't stack. Creates demand for cave items and economy sink.

**🎯 Acceptance Criteria:**
- [ ] Boost station tile at (1, 1)
- [ ] Unique terrain type "BOOST_STATION"
- [ ] T key opens boost interface ("Trade for boost")
- [ ] Boost options displayed with scaling duration:
  - "1-5 items → +10% for 1 hour"
  - "6-10 items → +15% for 2 hours"
  - "11-15 items → +20% for 3 hours"
  - "16+ items → +25% for 4 hours"
  - "Diggers give 1.5x duration bonus"
- [ ] Item selection UI: Choose which items to trade
- [ ] Confirmation modal with boost details
- [ ] Active boost display in stats panel: "+15% Gathering (1h 45min left)"
- [ ] Boost timer countdown in header
- [ ] Cannot activate boost if one already active
- [ ] Boost applies to both metal and energy gathering
- [ ] Transaction log: Last 10 boost activations
- [ ] Boost expiration notification (toast message)

**🏗️ Technical Approach:**

**Boost System:**
```typescript
interface ActiveBoost {
  username: string;
  boostType: 'MINOR' | 'MAJOR';
  boostPercent: number; // 10 or 25
  duration: number; // milliseconds
  startTime: Date;
  expiresAt: Date;
}

// Boost calculation during harvest
const baseAmount = 1000;
const diggerBonus = player.gatheringBonus.metalDiggers; // 45%
const activeBoost = player.activeBoost?.boostPercent || 0; // 10%
const finalAmount = Math.floor(
  baseAmount * (1 + diggerBonus/100 + activeBoost/100)
);
// Result: 1000 * (1 + 0.45 + 0.10) = 1550
```

**Boost Trading:**
```typescript
// Minor boost activation
POST /api/boost/activate
Body: {
  username,
  boostType: 'MINOR',
  itemsToTrade: [itemId1, itemId2, itemId3, itemId4, itemId5]
}
Validation:
- Check all 5 items are tradeable (not diggers)
- Check no active boost exists
- Remove items from inventory
- Create ActiveBoost record
- Return success with expiration time

// Major boost activation
Body: {
  username,
  boostType: 'MAJOR',
  itemsToTrade: [diggerId1, diggerId2, diggerId3]
}
Validation:
- Check all 3 items are diggers
- Check no active boost exists
- Remove diggers from inventory
- Create ActiveBoost record
- Return success with expiration time
```

**Background Job:**
```typescript
// Boost expiration checker (runs every minute)
async function checkBoostExpirations() {
  const expiredBoosts = await ActiveBoosts.find({
    expiresAt: { $lt: new Date() }
  });
  
  for (const boost of expiredBoosts) {
    // Remove boost from player
    await Players.updateOne(
      { username: boost.username },
      { $unset: { activeBoost: "" } }
    );
    
    // Notify player (if online)
    sendNotification(boost.username, "Gathering boost expired!");
  }
}
```

**📁 Files Affected:**
- `/types/game.types.ts` [MOD] - Add TerrainType.BOOST_STATION, ActiveBoost interface
- `/lib/mapGenerator.ts` [MOD] - Set tile (1,1) as BOOST_STATION
- `/components/BoostInterface.tsx` [NEW] - Boost trading UI
- `/components/ActiveBoostDisplay.tsx` [NEW] - Boost timer in header
- `/components/ItemSelector.tsx` [NEW] - Multi-select item picker
- `/app/api/boost/activate/route.ts` [NEW] - Activate boost
- `/app/api/boost/status/route.ts` [NEW] - Check active boost
- `/lib/boostService.ts` [NEW] - Boost business logic
- `/lib/harvestService.ts` [MOD] - Apply active boost to calculations
- `/lib/boostScheduler.ts` [NEW] - Expiration background job
- `/app/game/page.tsx` [MOD] - Add T key handler, boost display

**🔗 Dependencies:**
- **Depends on:** Cave item system (already implemented)
- **Related:** Harvest system (needs boost application)

**💡 Suggestions:**
- Add "Mega Boost" tier: 10 items for +50% (2 hours)
- Implement boost stacking with diminishing returns
- Create boost marketplace (players trade boosts)
- Add seasonal/event boosts with special effects

---

## 📊 DEVELOPMENT ROADMAP

### **Week 1: Foundation & Critical Systems**
**Days 1-2:** [FID-20251017-003] Stabilization (16h)  
**Days 3-5:** [FID-20251017-004] Authentication Persistence (12h)  
**Total:** 28 hours

**Milestones:**
- ✅ All critical errors resolved
- ✅ Codebase stable and tested
- ✅ Users stay logged in across sessions
- ✅ Security hardened with cookies

---

### **Week 2: UI Enhancement**
**Days 1-2:** [FID-20251017-005] Inventory Panel (10h)  
**Days 3-5:** [FID-20251017-006] Factory Panel (12h)  
**Total:** 22 hours

**Milestones:**
- ✅ I key opens comprehensive inventory
- ✅ M key opens factory management
- ✅ Players can view all assets
- ✅ Factory production controls functional

---

### **Week 3: Time Systems & Banks**
**Day 1:** [FID-20251017-007] Server Time Display (6h)  
**Days 2-3:** [FID-20251017-008] Metal Bank (8h)  
**Days 4-5:** [FID-20251017-009] Energy Bank (6h)  
**Total:** 20 hours

**Milestones:**
- ✅ Server time visible and synced
- ✅ Reset countdowns accurate
- ✅ Players can bank metal at (25,25)
- ✅ Players can bank energy at (75,75)
- ✅ Resource security implemented

---

### **Week 4: Exchange & Boost Systems**
**Days 1-3:** [FID-20251017-010] Exchange Banks (10h)  
**Days 4-5:** [FID-20251017-011] Boost Station (12h)  
**Total:** 22 hours

**Milestones:**
- ✅ Players convert metal ↔ energy at (50,50) and (100,100)
- ✅ Exchange fees create economy sink
- ✅ Players trade items for boosts at (1,1)
- ✅ Temporary gathering bonuses functional

---

### **Week 5-6: Testing & Polish**
**Integration Testing:** 16 hours  
**Bug Fixes:** 12 hours  
**Documentation:** 8 hours  
**Performance Optimization:** 8 hours  
**Total:** 44 hours

**Milestones:**
- ✅ All features tested end-to-end
- ✅ No critical bugs remaining
- ✅ Documentation complete
- ✅ Performance benchmarks met

---

## 📈 TOTAL PROJECT ESTIMATES

**Total Development Time:** 136 hours  
**With Testing/Polish:** 180 hours  
**Calendar Duration:** 4-6 weeks  
**Team Size:** 1 senior developer (ECHO v5.1)

**Complexity Breakdown:**
- Critical: 16 hours (12%)
- High: 22 hours (16%)
- Medium-High: 26 hours (19%)
- Medium: 72 hours (53%)

**Risk Assessment:**
- **Low Risk:** UI components, time display, banks
- **Medium Risk:** Authentication, exchange rates, boost system
- **High Risk:** General stabilization (unknown scope)

---

## 🎯 SUCCESS CRITERIA

**Phase 2 Complete When:**
- [ ] <50 TypeScript errors (down from 607)
- [ ] Users stay logged in across browser restarts
- [ ] All 5 UI panels functional (Inventory, Factory, Stats, Time, Boosts)
- [ ] All 5 resource structures interactive (Metal Bank, Energy Bank, 2 Exchanges, Boost Station)
- [ ] Resource deposit/withdraw system working
- [ ] Exchange conversion working with fees
- [ ] Boost trading and application working
- [ ] 100% test coverage on new features
- [ ] Documentation complete in `/dev` folder
- [ ] Performance: Page load <2s, API response <500ms

---

## 💡 FUTURE ENHANCEMENTS (Phase 3+)

**Post-Phase 2 Ideas:**
- PvP factory battles using units
- Territory control zones
- Guild/alliance system
- Factory upgrade tiers
- Dynamic exchange rates (supply/demand)
- Bank interest system
- Resource insurance products
- Player-run shops/markets
- Auction house for items
- Prestige system (reset for bonuses)

---

**Last Updated:** 2025-10-17  
**Status:** AWAITING APPROVAL  
**Next Step:** User reviews plan and approves features for implementation

