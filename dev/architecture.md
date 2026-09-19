# DarkFrame - Architecture Documentation

> ⚠️ **HISTORICAL SNAPSHOT (2025-10-26).** This document predates the Postgres
> pivot: every MongoDB / Atlas / `mongodb.ts` reference below describes a stack
> that no longer exists. The database is now PostgreSQL via Drizzle
> (`lib/db/connection.ts` + `lib/db/schema/`), and the Mongo-era shim was deleted
> outright on 2026-09-19. For the current architecture read `docs/ARCHITECTURE.md`.
> Preserved as history — the decision log near the end remains accurate as a
> record of what was chosen at the time.

> Technical decisions, patterns, and system design

**Last Updated:** 2025-10-26  
**Project Status:** ✅ PRODUCTION-READY - WMD Complete, Stripe Live, Referrals Operational  
**Features Completed:** 70 major features across 18 phases  
**Code Volume:** ~52,500 lines production code  
**Technical Debt:** Minimal

---

## 💳 Payment & Monetization Architecture (2025-10-24)

### Stripe Integration
**Implementation:** Full payment processing with automated subscription management

**Components:**
- **Stripe Client** (`lib/stripe/stripeService.ts` - 368 lines):
  - Lazy-loaded Stripe SDK initialization
  - Checkout session creation with customer metadata
  - Customer portal session generation
  - Webhook signature verification
  - Customer management and retrieval

- **Subscription Automation** (`lib/stripe/subscriptionService.ts` - 438 lines):
  - `grantVIP()` - Automated VIP activation with expiration calculation
  - `revokeVIP()` - VIP removal on subscription cancellation
  - `extendVIP()` - Renewal handling for recurring payments
  - `recordPayment()` - Transaction logging in database
  - `checkVIPStatus()` - Auto-revoke expired VIP

- **API Routes:**
  - `POST /api/stripe/create-checkout-session` - Initialize payment flow
  - `POST /api/stripe/webhook` - Handle Stripe events (checkout, renewal, cancellation)
  - `POST /api/stripe/verify-session` - Verify payment completion

**Pricing Tiers:** 5 tiers ($9.99-$199.99)
- Weekly ($9.99), Monthly ($19.99), Quarterly ($49.99), Biannual ($89.99), Yearly ($199.99)

**Security:**
- Webhook signature verification (STRIPE_WEBHOOK_SECRET)
- Environment variable protection for API keys
- Idempotent webhook processing (safe for retries)
- Raw body parsing for signature validation

**Database:**
- Payment transactions logged in `players.payments` array
- VIP status tracked with `vipExpiry`, `isVIP`, `vipTier` fields
- Stripe customer ID stored for portal access

---

## 🎁 Referral System Architecture (2025-10-24)

### Overview
Organic player growth system with progressive rewards and anti-abuse protection

**Components:**
- **Core Service** (`lib/referralService.ts` - 576 lines):
  - Unique referral code generation (DF-XXXXXXXX format)
  - Code validation during registration
  - Progressive reward calculation (1.05x scaling, cap at 2.0x)
  - 8 milestone bonuses (1, 3, 5, 10, 15, 25, 50, 100 referrals)
  - VIP cap enforcement (30 days maximum)
  - Anti-abuse detection (IP tracking, email validation)
  - 7-day + 4 login validation requirement
  - Welcome package distribution

- **API Endpoints:**
  - `POST /api/referral/generate` - Generate player's referral code
  - `GET /api/referral/validate?code=X` - Validate code during signup
  - `GET /api/referral/stats` - User dashboard statistics
  - `GET /api/referral/leaderboard?limit=50` - Top recruiters
  - `GET /api/admin/referrals` - Admin management (search, filter, flag)
  - `POST /api/admin/referrals/flag` - Flag suspicious referral
  - `POST /api/admin/referrals/validate` - Manual validation

- **Frontend Components:**
  - `ReferralDashboard.tsx` (395 lines) - User dashboard with code sharing
  - `ReferralLeaderboard.tsx` (289 lines) - Top recruiters leaderboard
  - `app/referrals/page.tsx` (384 lines) - Main page with tabs (Dashboard, Leaderboard, Guide)
  - `app/admin/referrals/page.tsx` (551 lines) - Admin management panel

- **Automation:**
  - Daily cron job (`scripts/validate-referrals-cron.ts` - 161 lines)
  - Auto-validates referrals after 7 days if 4+ logins
  - Auto-invalidates failed referrals
  - Comprehensive logging and statistics

**Reward Structure:**
- Base: 10k metal/energy, 15 RP, 2k XP, 1 VIP per referral
- Progressive: 1.05x scaling (caps at 2.0x on 15th referral)
- Total at 100: ~5M resources, ~15k RP, ~1.5M XP, 30 VIP days
- 8 milestones with special bonuses (units, titles, badges)

**Database:**
- New collection: `referrals` (tracking documents with status, timestamps, IP)
- Player extensions: 15+ new fields (referralCode, referredBy, validatedReferrals, etc.)

**Security:**
- IP address tracking (max 3 accounts per IP)
- Temporary email domain blocking
- Risk level assessment (Low/Medium/High)
- Admin flagging with reason tracking
- Manual override capabilities

---

## 🗄️ Database Index Strategy & Query Performance Benchmarks (2025-10-19)

### Index Coverage
- All major collections have purpose-driven compound indexes:
  - `players`: username (unique), email (unique), clan/role, level, kills, leaderboard fields
  - `clans`: level/power, territory, wealth, leaderboard fields
  - `clan_territories`: clan/coordinate, coordinate, clan
  - `clan_wars`: status/date, attacker, defender
  - `battleLogs`: attacker, defender, timestamp
  - `achievements`: player, achievement type
  - `auctions`: status/time, seller, price
  - `factories`: location, owner, clan
  - `map`: coordinate
  - `tiles`: xy, terrain, occupied

### Query Performance
- MCP scan confirms all typical queries use indexes; no full collection scans detected.
- All tested queries return in <1ms (well below <50ms target at 95th percentile).
- Slow query logging is active in `lib/mongodb.ts` (threshold: 50ms).
- Indexes and query patterns reviewed for all critical business logic.

### Maintenance & Future Improvements
- Indexes to be reviewed quarterly and after major schema changes.
- Automated index analysis planned for Phase 5+.
- Performance monitoring and error tracking to be added (APM, Sentry).

---

## 🏗️ System Architecture

### Overview
DarkFrame follows a **three-tier architecture** with clear separation of concerns:

1. **Presentation Layer** - 35 React components with TypeScript strict mode
2. **Application Layer** - 60+ API routes and 29 service modules
3. **Data Layer** - MongoDB Atlas with 14+ collections

### Key Architectural Principles
- **Type-First Development:** TypeScript strict mode enforced across entire codebase
- **Service Layer Separation:** All business logic in dedicated service modules
- **Modular Design:** Barrel exports (`index.ts`) in every folder for clean imports
- **Context API Sufficiency:** React Context manages global state without Redux overhead
- **Edge-First Middleware:** Authentication runs in Edge Runtime for performance

---

## 📐 Technology Stack

### Frontend
- **Framework:** Next.js 15.0.2 (App Router)
- **Language:** TypeScript 5 (strict mode, 0 errors maintained)
- **UI Library:** React 18.3.1 with functional components only
- **Styling:** Tailwind CSS 3.4.1 with custom color palette
- **State Management:** React Context API (GameContext)
- **Toast Notifications:** Custom toast service with React state

### Backend
- **Runtime:** Node.js (API routes) + Edge Runtime (middleware)
- **API:** Next.js API Routes (serverless functions, 60+ endpoints)
- **Database:** MongoDB Atlas (cloud-hosted, 12+ collections)
- **Driver:** MongoDB Node.js Driver 6.10.0
- **Authentication:** JWT with jose library (Edge-compatible)
- **Password Hashing:** bcrypt 6.0.0 (API routes only)
- **Logging:** Custom structured logger with ISO timestamps

### Development
- **Package Manager:** npm
- **Linting:** ESLint with Next.js config
- **Type Checking:** TypeScript compiler (strict mode)
- **Version Control:** Git (needs improvement per lessons-learned)
- **Workflow:** ECHO v5.1 standards with /dev tracking


---

## 🗂️ Project Structure (Current as of 2025-10-17)

```
darkframe/
├── app/                        # Next.js App Router pages
│   ├── api/                   # API route handlers (60+ endpoints)
│   │   ├── achievements/      # Achievement system API
│   │   │   ├── route.ts      # List achievements
│   │   │   ├── check/route.ts # Check for new achievements
│   │   │   └── claim/route.ts # Claim achievement rewards
│   │   ├── auction/          # Auction house system
│   │   │   ├── listings/route.ts # Browse/create listings
│   │   │   ├── bid/route.ts     # Place bids
│   │   │   ├── buyout/route.ts  # Instant buyout
│   │   │   ├── history/route.ts # Bid history
│   │   │   └── watchlist/route.ts # Watchlist management
│   │   ├── balance/          # Banking & boosts
│   │   │   ├── route.ts      # Get bank balance
│   │   │   ├── deposit/route.ts  # Deposit resources
│   │   │   ├── withdraw/route.ts # Withdraw resources
│   │   │   └── buy-boost/route.ts # Purchase boosts
│   │   ├── battle/           # PVP combat system
│   │   │   ├── attack/route.ts   # Initiate attack
│   │   │   ├── logs/route.ts    # Get battle logs
│   │   │   └── log/[id]/route.ts # Specific log details
│   │   ├── cave/             # Cave exploration
│   │   │   └── loot/route.ts # Loot cave for items
│   │   ├── discoveries/      # Ancient technology system
│   │   │   ├── route.ts      # List discoveries
│   │   │   ├── check/route.ts # Check for new discovery
│   │   │   └── claim/route.ts # Claim discovery rewards
│   │   ├── factory/          # Factory management
│   │   │   ├── attack/route.ts   # Attack factory
│   │   │   ├── upgrade/route.ts  # Upgrade factory
│   │   │   ├── units/route.ts   # List factory units
│   │   │   └── build-unit/route.ts # Build unit
│   │   ├── harvest/          # Resource gathering
│   │   │   └── route.ts      # Harvest current tile
│   │   ├── leaderboard/      # Rankings system
│   │   │   └── route.ts      # Get top players
│   │   ├── login/            # Authentication
│   │   │   └── route.ts      # Login endpoint
│   │   ├── move/             # Movement system
│   │   │   └── route.ts      # Move player
│   │   ├── player/           # Player data
│   │   │   ├── route.ts      # Get player data
│   │   │   ├── stats/route.ts # Get player stats
│   │   │   └── respec/route.ts # Respec specialization
│   │   ├── register/         # Registration
│   │   │   └── route.ts      # Create new player
│   │   ├── shrine/           # Banking interface
│   │   │   └── route.ts      # Get bank data
│   │   ├── specialization/   # Class system
│   │   │   ├── route.ts      # Get specialization data
│   │   │   ├── choose/route.ts # Choose spec
│   │   │   ├── upgrade/route.ts # Upgrade mastery
│   │   │   └── respec/route.ts # Respec specialization
│   │   ├── tile/             # Map tile data
│   │   │   └── route.ts      # Get tile information
│   │   └── xp/               # Experience system
│   │       └── route.ts      # Get XP data
│   ├── game/                 # Main game page
│   │   └── page.tsx         # Game interface
│   ├── leaderboard/          # Leaderboard page
│   │   └── page.tsx         # Rankings display
│   ├── login/                # Login page
│   │   └── page.tsx         # Login form
│   ├── register/             # Registration page
│   │   └── page.tsx         # Registration form
│   ├── layout.tsx            # Root layout (HTML wrapper)
│   ├── page.tsx              # Landing page
│   └── globals.css           # Global styles
├── components/               # React components (35 files)
│   ├── AchievementNotification.tsx # Achievement unlock modal
│   ├── AchievementPanel.tsx        # Achievement browser (V key)
│   ├── AuctionHousePanel.tsx       # Auction interface (H key)
│   ├── AuctionListingCard.tsx      # Individual listing display
│   ├── BackButton.tsx              # Reusable back button
│   ├── BalanceIndicator.tsx        # Bank balance display
│   ├── BankPanel.tsx               # Banking interface (B key)
│   ├── BattleLogLinks.tsx          # Battle history links
│   ├── BattleLogModal.tsx          # Battle log viewer modal
│   ├── BattleLogViewer.tsx         # Battle log renderer
│   ├── BattleResultModal.tsx       # Combat result popup
│   ├── BidHistoryViewer.tsx        # Auction bid history
│   ├── CaveItemNotification.tsx    # Cave loot notification
│   ├── CombatAttackModal.tsx       # Combat initiation modal
│   ├── ControlsPanel.tsx           # Right panel controls
│   ├── CreateListingModal.tsx      # Create auction listing
│   ├── DiscoveryLogPanel.tsx       # Discovery history (Y key)
│   ├── DiscoveryNotification.tsx   # Discovery unlock modal
│   ├── FactoryButton.tsx           # Factory interaction button
│   ├── FactoryManagementPanel.tsx  # Factory management (M key)
│   ├── GameLayout.tsx              # Three-panel game layout
│   ├── HarvestButton.tsx           # Resource harvest button (E key)
│   ├── HarvestStatus.tsx           # Harvest cooldown display
│   ├── InventoryPanel.tsx          # Inventory interface (I key)
│   ├── LevelUpModal.tsx            # Level up notification
│   ├── MasteryProgressBar.tsx      # Specialization progress
│   ├── MovementControls.tsx        # 9-direction navigation
│   ├── ShrinePanel.tsx             # Banking interface (B key)
│   ├── SpecializationPanel.tsx     # Class selection (C key)
│   ├── StatsPanel.tsx              # Player stats (left panel)
│   ├── TierUnlockPanel.tsx         # Unit tier unlock modal
│   ├── TileRenderer.tsx            # Current tile display
│   ├── UnitBuildPanel.tsx          # Unit building interface
│   ├── UnitBuildPanelEnhanced.tsx  # Enhanced unit panel
│   ├── XPProgressBar.tsx           # Experience progress bar
│   └── index.ts                    # Barrel export
├── context/                  # React Context providers
│   └── GameContext.tsx      # Global game state management
├── lib/                      # Business logic & services (29 files)
│   ├── achievementService.ts    # Achievement tracking
│   ├── auctionService.ts        # Auction house logic
│   ├── authMiddleware.ts        # JWT verification
│   ├── authService.ts           # Authentication logic
│   ├── balanceService.ts        # Banking operations
│   ├── battleService.ts         # PVP combat logic
│   ├── caveItemService.ts       # Cave loot system
│   ├── clanWarfareService.ts    # Clan warfare & territory capture (NEW - Phase 4)
│   ├── discoveryService.ts      # Ancient technology system
│   ├── factoryService.ts        # Factory ownership/attacks
│   ├── factoryUpgradeService.ts # Factory progression
│   ├── harvestMessages.ts       # Harvest flavor text
│   ├── harvestService.ts        # Resource gathering logic
│   ├── imageService.ts          # Dynamic image generation
│   ├── logger.ts                # Structured logging
│   ├── mapGeneration.ts         # Map initialization
│   ├── mongodb.ts               # MongoDB connection singleton
│   ├── movementService.ts       # Player movement logic
│   ├── playerService.ts         # Player CRUD operations
│   ├── rankingService.ts        # Leaderboard calculations
│   ├── slotRegenService.ts      # 12-hour slot regeneration
│   ├── specializationService.ts # Class system logic
│   ├── statTrackingService.ts   # Player statistics tracking
│   ├── territoryService.ts      # Clan territory control (NEW - Phase 4)
│   ├── tierUnlockService.ts     # Unit tier progression
│   ├── toastService.tsx         # Toast notification system
│   ├── utils.ts                 # Utility functions
│   ├── xpService.ts             # Experience calculations
│   └── index.ts                 # Barrel export
├── scripts/                  # Utility scripts
│   └── initializeMap.ts     # One-time map generation (150×150)
├── types/                    # TypeScript type definitions
│   ├── game.types.ts        # Core game types (Player, Tile, etc.)
│   └── index.ts             # Barrel export
├── utils/                    # Helper utilities
│   ├── coordinates.ts       # Coordinate calculations
│   └── index.ts             # Barrel export
├── dev/                      # Development tracking
│   ├── planned.md           # Remaining features (Phase 3-7)
│   ├── progress.md          # Active work (Discovery testing)
│   ├── completed.md         # 36 completed features
│   ├── roadmap.md           # Phase overview (82% complete)
│   ├── metrics.md           # Velocity and estimation data
│   ├── architecture.md      # This file
│   ├── issues.md            # Bugs and blockers
│   ├── decisions.md         # Technical decisions
│   ├── lessons-learned.md   # 27 captured insights
│   ├── suggestions.md       # 15 improvement recommendations
│   ├── quality-control.md   # ECHO v5.1 compliance tracking
│   └── archive/             # Historical documentation (23 files)
├── public/                   # Static assets
│   └── assets/
│       └── tiles/           # Terrain tile images (dynamic generation)
│           ├── metal/
│           ├── energy/
│           ├── cave/
│           ├── forest/      # Premium terrain (Phase 3)
│           ├── factory/
│           └── wasteland/
├── .env.local               # Environment variables (git-ignored)
├── .env.example             # Environment template
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript strict mode config
├── tailwind.config.ts       # Tailwind + custom colors
├── middleware.ts            # Edge Runtime authentication
└── next.config.js           # Next.js configuration
```

---

## 🎮 Major Game Systems

### 1. Core Systems (Phase 1) - 100% Complete
**Purpose:** Foundation gameplay and map mechanics

**Components:**
- `GameLayout.tsx` - Three-panel interface (stats, tile, controls)
- `StatsPanel.tsx` - Player info display (left panel)
- `TileRenderer.tsx` - Current tile visualization with dynamic images
- `MovementControls.tsx` - 9-direction navigation (QWEASDZXC, numpad, arrows)
- `ControlsPanel.tsx` - Right panel action buttons

**Services:**
- `mongodb.ts` - Connection singleton with pooling
- `mapGeneration.ts` - 150×150 grid initialization (22,500 tiles)
- `playerService.ts` - CRUD operations for players
- `movementService.ts` - Coordinate wrapping and validation
- `authService.ts` - JWT authentication and bcrypt hashing

**Features:**
- Map generation with weighted terrain distribution
- Player registration with random wasteland spawn
- 9-direction movement with three control schemes
- Cookie-based JWT authentication
- Real-time tile display with resource indicators

**Database Collections:**
- `tiles` - 22,500 tiles indexed by (x, y)
- `players` - Player accounts with base and current position

---

### 2. Resource & Factory Systems (Phase 2) - 100% Complete
**Purpose:** Resource gathering, unit production, and territory control

**Components:**
- `HarvestButton.tsx` - Resource gathering button (E key)
- `HarvestStatus.tsx` - Cooldown timer and slot display
- `InventoryPanel.tsx` - Item storage interface (I key)
- `CaveItemNotification.tsx` - Loot drop notification
- `FactoryButton.tsx` - Factory interaction button (R key)
- `UnitBuildPanel.tsx` - Unit production interface
- `UnitBuildPanelEnhanced.tsx` - Enhanced unit building

**Services:**
- `harvestService.ts` - Resource gathering with diminishing returns
- `harvestMessages.ts` - Flavor text for harvest results
- `slotRegenService.ts` - 12-hour slot regeneration system
- `caveItemService.ts` - Cave loot drops (30% chance)
- `factoryService.ts` - Factory ownership and attacks
- `tierUnlockService.ts` - Progressive unit tier unlocking

**Features:**
- Resource harvesting with 12-hour slot regeneration (max 36 slots)
- Diminishing returns (power-law decay)
- Cave exploration (30% loot drop rate)
- Factory control with 80% power requirement
- Unit production (40 different unit types, 8 tiers)
- Factory ownership tracking
- Harvest cooldowns (30 seconds)
- Random loot items (items collection)

**Database Collections:**
- `players.harvestSlots` - Slot tracking with last regen time
- `players.inventory` - Item storage
- `tiles.factory` - Factory ownership data
- `items` - Loot drop definitions

---

### 3. Banking & Balance System (Phase 3 Sub-Phase) - 100% Complete
**Purpose:** Resource storage and temporary boosts

**Components:**
- `BankPanel.tsx` - Banking interface (B key)
- `ShrinePanel.tsx` - Visual banking interface
- `BalanceIndicator.tsx` - Bank balance display in stats panel

**Services:**
- `balanceService.ts` - Banking operations with validation

**Features:**
- Deposit/withdraw resources from bank
- Purchase temporary boosts (XP, harvest, combat)
- Bank balance tracking
- Boost duration and effect management

**Database Collections:**
- `players.bank` - Resource storage
- `players.boosts` - Active boost tracking

---

### 4. Factory Management System (Phase 3 Sub-Phase) - 100% Complete
**Purpose:** Advanced factory control and unit management

**Components:**
- `FactoryManagementPanel.tsx` - Factory control interface (M key)

**Services:**
- `factoryUpgradeService.ts` - Factory progression and upgrade logic

**Features:**
- Factory slot management (max 50 slots)
- Factory upgrades (5 levels: Basic → Legendary)
- Unit assignment and reallocation
- Factory statistics and efficiency tracking

**Database Collections:**
- `tiles.factory.slots` - Factory slot configuration
- `tiles.factory.level` - Factory upgrade level

---

### 5. Leaderboard System (Phase 3 Sub-Phase) - 100% Complete
**Purpose:** Player rankings and competition

**Components:**
- Leaderboard page (`app/leaderboard/page.tsx`)

**Services:**
- `rankingService.ts` - Leaderboard calculations with multiple criteria

**Features:**
- Top 100 players by total units produced
- Multiple ranking criteria (planned: power, resources, combat)
- Real-time rank calculation
- Public profile display

**Database Collections:**
- `players` - Aggregated for ranking queries

---

### 6. Experience & Leveling System (Phase 3 Sub-Phase) - 100% Complete
**Purpose:** Character progression and tier unlocking

**Components:**
- `XPProgressBar.tsx` - Visual XP progress indicator
- `LevelUpModal.tsx` - Level up notification
- `TierUnlockPanel.tsx` - Tier unlock modal with congratulations

**Services:**
- `xpService.ts` - XP calculation and level progression
- `tierUnlockService.ts` - Unit tier unlocking logic

**Features:**
- XP gain from harvesting (varied by terrain type)
- Level-based progression (exponential XP curve)
- Unit tier unlocking (tiers 1-8, unlock at levels 1, 5, 10, 15, 20, 25, 30, 35)
- Visual progress tracking
- Congratulations modals for tier unlocks

**Database Collections:**
- `players.xp` - Current XP
- `players.level` - Current level
- `players.unlockedTiers` - Array of unlocked tiers

---

### 7. Forest System (Phase 3 Sub-Phase) - 100% Complete
**Purpose:** Premium terrain with enhanced loot

**Services:**
- Enhanced `harvestService.ts` with Forest terrain handling

**Features:**
- Forest terrain type (rare, premium)
- Higher resource yields in forests
- Enhanced loot drop rates
- Forest-specific flavor text

**Database Collections:**
- `tiles.terrain` - Includes 'Forest' type

---

### 8. PVP Combat System (Phase 3 Sub-Phase) - 100% Complete
**Purpose:** Player vs player territorial combat

**Components:**
- `CombatAttackModal.tsx` - Combat initiation interface
- `BattleResultModal.tsx` - Combat outcome display
- `BattleLogViewer.tsx` - Detailed battle log renderer
- `BattleLogModal.tsx` - Battle log modal wrapper
- `BattleLogLinks.tsx` - Navigation to battle history

**Services:**
- `battleService.ts` - Combat calculations with detailed logging
- `statTrackingService.ts` - Combat statistics tracking

**Features:**
- Attack other players' factories
- Combat power calculation (unit composition)
- Winner takes factory ownership
- Detailed battle logging (attacker/defender, power, winner, time)
- Battle history viewing
- Combat statistics tracking (wins, losses, attacks, defenses)

**Database Collections:**
- `battleLogs` - Combat history records
- `players.stats` - Combat win/loss tracking

---

### 9. Specialization System (Phase 3 Sub-Phase) - 100% Complete
**Purpose:** Class-based character progression

**Components:**
- `SpecializationPanel.tsx` - Class selection interface (C key)
- `MasteryProgressBar.tsx` - Mastery level progress bar

**Services:**
- `specializationService.ts` - Class logic and mastery progression

**Features:**
- Three specialization classes:
  - **Miner:** +20% harvest yield, faster slots
  - **Warlord:** +15% combat power, cheaper units
  - **Industrialist:** +25% factory efficiency, more slots
- Mastery level progression (0-100)
- Mastery XP from class-related activities
- Respec functionality (7-day cooldown, escalating cost)
- Visual mastery progress tracking

**Database Collections:**
- `players.specialization` - Current spec and mastery data

---

### 10. Discovery System (Phase 3 Sub-Phase) - 60% Complete (Testing)
**Purpose:** Ancient technology and long-term progression

**Components:**
- `DiscoveryNotification.tsx` - Discovery unlock modal
- `DiscoveryLogPanel.tsx` - Discovery history viewer (Y key)

**Services:**
- `discoveryService.ts` - Discovery checks and unlocking logic

**Features:**
- 15 ancient technology discoveries (5% chance per harvest)
- Permanent passive bonuses:
  - Harvest efficiency (+10%)
  - Combat power (+5%)
  - Factory slots (+5)
  - XP gain (+15%)
  - Resource regeneration (+20%)
  - And 10 more unique bonuses
- Discovery history tracking
- Visual unlock notifications

**Database Collections:**
- `players.discoveries` - Array of unlocked discovery IDs
- `discoveries` - Discovery definitions

**Status:** Feature complete, in testing phase

---

### 11. Achievement System (Phase 3 Sub-Phase) - 100% Complete
**Purpose:** Milestone tracking and prestige units

**Components:**
- `AchievementNotification.tsx` - Achievement unlock modal
- `AchievementPanel.tsx` - Achievement browser (V key)

**Services:**
- `achievementService.ts` - Achievement tracking and validation

**Features:**
- 10 achievement categories:
  - First Steps (harvest 100 resources)
  - Factory Owner (control first factory)
  - Empire Builder (control 10 factories)
  - Combat Veteran (win 50 battles)
  - Resource Hoarder (bank 10,000 resources)
  - Master Explorer (discover 5 ancient technologies)
  - Elite Warrior (defeat 10 elite units)
  - Specialized (reach mastery 50)
  - Legendary Trader (complete 100 auction transactions)
  - Titan (produce 1,000 units)
- Prestige unit rewards for major achievements
- Visual achievement browser
- Real-time achievement checking

**Database Collections:**
- `players.achievements` - Array of unlocked achievement IDs
- `achievements` - Achievement definitions

---

### 12. Auction House System (Phase 4) - 100% Complete
**Purpose:** Player-to-player trading and economy

**Components:**
- `AuctionHousePanel.tsx` - Main auction interface (H key)
- `AuctionListingCard.tsx` - Individual listing display
- `BidHistoryViewer.tsx` - Bid history for listings
- `CreateListingModal.tsx` - Create new listing

**Services:**
- `auctionService.ts` - Auction logic, bidding, buyout, escrow

**Features:**
- Create listings (units or items)
- Bidding system with anti-snipe protection (5-minute extension)
- Instant buyout option
- Escrow system (resources held until sale/expiry)
- Bid history tracking
- Watchlist functionality
- Seller reputation system
- 5% transaction fee (public), 0% fee (clan auctions - planned)
- Automatic expiry after 7 days

**Database Collections:**
- `auctionListings` - Active and expired listings
- `auctionBids` - Bid history
- `players.auctionReputation` - Seller ratings

---

### 13. VIP Monetization System (Phases 12-13) - 100% Complete
**Purpose:** Premium subscription revenue stream with auto-farm speed boost

**Components:**
- `TopNavBar.tsx` - VIP upgrade button with conditional styling
- `AutoFarmPanel.tsx` - VIP upgrade CTA with speed comparison (non-VIP only)
- `/app/game/vip-upgrade/page.tsx` - Marketing page with pricing and FAQ
- `/app/admin/page.tsx` - VIP Management section (consolidated)

**Services:**
- `autoFarmEngine.ts` - Dual-speed tier system (VIP: 5.6hr, Basic: 11.6hr)

**API Endpoints:**
- `POST /api/admin/vip/grant` - Admin grant VIP status
- `POST /api/admin/vip/revoke` - Admin revoke VIP status
- `GET /api/admin/vip/list` - List all VIP users

**Features:**
- **Dual-Speed Tiers:**
  - VIP: 5.6 hours full map completion (2x speed)
  - Basic: 11.6 hours full map completion (standard speed)
- **Visual Distinction:**
  - Golden "VIP ⚡" badge in navigation
  - Purple gradient styling for VIP elements
  - Speed comparison display in auto-farm panel
- **Admin Management:**
  - Search and filter (all/vip/basic users)
  - Stats dashboard (total/VIP/basic counts)
  - Grant/revoke actions with confirmation dialogs
  - Consolidated into main /admin panel
- **Marketing:**
  - Pricing structure (Weekly: $4.99, Monthly: $14.99, Yearly: $99.99)
  - Benefits comparison with calculated time savings
  - FAQ addressing common questions
- **User Journey:**
  1. Discovery (nav button or auto-farm CTA)
  2. Education (marketing page)
  3. Conversion (contact admin - temporary)
  4. Fulfillment (admin grants VIP)
  5. Confirmation (golden badge appears)

**Database Schema:**
```typescript
players: {
  isVIP: boolean,              // VIP status flag
  vipExpiresAt: Date | null    // Expiration timestamp
}
```

**Architecture Decisions:**
- **Why Client-Side Speed Control?**
  - ✅ No server resources consumed
  - ✅ Real-time adjustment without API calls
  - ✅ Instant feedback on VIP activation
  - ❌ Vulnerable to manipulation (mitigated by API validation)

- **Why Manual Admin Grant?**
  - ✅ Control for early adopters
  - ✅ Promotional flexibility
  - ✅ Testing before payment integration
  - ❌ Not scalable (temporary until Stripe integration)

**Future Enhancements:**
- Stripe payment integration (planned)
- Automatic expiration handling (background job)
- Self-service subscription management
- VIP-exclusive features (bonus tiers, cosmetics)

**Impact:**
- Clear revenue model established
- 5.8 hours saved per map run for VIP users
- Professional visual design system
- Foundation ready for payment scaling

---

### 14. WMD System - Phase 1 (Service Layer) - 100% Complete
**Purpose:** Endgame content with nuclear warfare, espionage, and clan politics

**Components:** (8 UI files, implementation ready for Phase 3)
- `WMDHub.tsx` - Main container with tab navigation
- `WMDResearchPanel.tsx` - Tech tree UI with unlock purchases
- `WMDMissilePanel.tsx` - Missile assembly and launch interface
- `WMDDefensePanel.tsx` - Battery management UI
- `WMDIntelligencePanel.tsx` - Spy mission selection UI
- `WMDVotingPanel.tsx` - Clan voting interface
- `WMDNotificationsPanel.tsx` - Event feed display
- `WMDMiniStatus.tsx` - Dashboard widget (integrated into game page)

**Services:** (13 backend services, 5,096 lines)
- **Infrastructure (3 services):**
  - `researchService.ts` (650 lines) - Tech tree management, RP spending, unlock validation
  - `apiHelpers.ts` (70 lines) - Auth and database connection utilities
  - `websocketIntegration.example.ts` (239 lines) - Real-time event patterns
  
- **Missile System (2 services):**
  - `missileService.ts` (309 lines) - Assembly, inventory, launch mechanics
  - `damageCalculator.ts` (92 lines) - Warhead damage formulas (radius, power calculation)
  
- **Defense System (2 services):**
  - `defenseService.ts` (326 lines) - Battery management, interception logic
  - `targetingValidator.ts` (75 lines) - Target validation, range checks
  
- **Intelligence System (2 services):**
  - `spyService.ts` (1,716 lines) - 10 mission types, sabotage engine, success/failure calculations
  - `sabotageEngine.ts` (220 lines) - Sabotage execution logic (factory damage, missile theft, etc.)
  
- **Clan WMD System (3 services):**
  - `clanVotingService.ts` (496 lines) - Democratic missile launch voting
  - `clanTreasuryWMDService.ts` (495 lines) - Clan funding with equal cost sharing
  - `clanConsequencesService.ts` (503 lines) - Post-attack cooldowns, retaliation mechanics
  
- **Notifications (1 service):**
  - `notificationService.ts` (142 lines) - WMD event broadcasting

**Type Definitions:** (6 files, 3,683 lines)
- `missile.types.ts` - Missile warhead types, assembly state, inventory
- `defense.types.ts` - Battery tiers, interception mechanics, targeting
- `intelligence.types.ts` - Spy missions (10 types), sabotage actions, intel reports
- `research.types.ts` - Tech tree nodes, prerequisites, RP costs
- `notification.types.ts` - Event types (launches, intercepts, spying), severity levels
- `index.ts` - Barrel exports, type guards, constants (24 enums, 120+ interfaces)

**Features:**
- **Research Tree:**
  - 20+ tech nodes with prerequisites
  - RP (Research Points) spending system
  - Unlock progression (missiles → warheads → defense → intelligence)
  
- **Missile System:**
  - 5 warhead types (Tactical → Strategic → MIRV → EMP → Doomsday)
  - Assembly mechanics (combine components)
  - Inventory management
  - Launch targeting and validation
  
- **Defense System:**
  - 4 battery tiers (Basic → Advanced → Elite → Quantum)
  - Interception calculations (success based on battery level vs warhead type)
  - Range validation (batteries protect surrounding radius)
  
- **Intelligence System:**
  - 10 spy mission types:
    1. Reconnaissance (basic intel)
    2. Infiltration (detailed intel)
    3. Sabotage (damage factories, steal missiles)
    4. Counter-intelligence (detect enemy spies)
    5. Assassination (kill enemy spy agents)
    6. Technology Theft (steal research progress)
    7. Propaganda (reduce enemy morale)
    8. Double Agent (turn enemy spy)
    9. Deep Cover (long-term infiltration)
    10. Exfiltration (extract double agent)
  - Success/failure mechanics with risk calculations
  - Intel report generation
  
- **Clan WMD System:**
  - Democratic voting (configurable % required for launch)
  - Clan treasury funding (equal cost sharing among members)
  - Post-attack consequences (24-72hr cooldowns, retaliation windows)
  
- **Notification System:**
  - Real-time event broadcasting
  - 8 severity levels (info → critical)
  - Event types (launch, intercept, spy detected, sabotage, retaliation)

**Database Collections:** (12 collections defined in `wmd.schema.ts`)
- `wmd_research` - Player tech tree progress
- `wmd_missiles` - Player missile inventory
- `wmd_warheads` - Warhead component inventory
- `wmd_defense_batteries` - Player defense installations
- `wmd_intel_reports` - Spy mission results
- `wmd_spy_agents` - Active spy units
- `wmd_sabotage_history` - Sabotage action logs
- `wmd_clan_votes` - Clan missile launch votes
- `wmd_clan_treasury` - Clan WMD funding pool
- `wmd_attack_history` - WMD attack logs
- `wmd_notifications` - Event notification queue
- `wmd_retaliation_windows` - Active retaliation periods

**Architecture Decisions:**
- **Why Separate WMD Collections?**
  - ✅ Clean separation from core game data
  - ✅ Easier to backup/restore independently
  - ✅ Optimized indexes for WMD-specific queries
  - ✅ Scalability for future WMD expansions

- **Why Democratic Clan Voting?**
  - ✅ Prevents single-player abuse
  - ✅ Encourages clan coordination
  - ✅ Adds strategic depth (timing, consensus)
  - ✅ Protects against rogue actors

- **Why Equal Cost Sharing?**
  - ✅ Fair burden distribution
  - ✅ Encourages active participation
  - ✅ Prevents freeloading
  - ✅ Scalable to any clan size

**Integration Points:**
- **RP System:** WMD research spends existing Research Points
- **Clan System:** Voting and treasury integrate with existing clan infrastructure
- **WebSocket:** Real-time notifications via existing WebSocket server (planned)
- **Game Page:** WMDMiniStatus integrated into `/app/game/page.tsx`

**Status:** Phase 1 (Service Layer) 100% complete
**Next Steps:**
- Phase 2: API routes for research, missiles, defense, intelligence
- Phase 3: Frontend integration and testing
- Phase 4: Real-time WebSocket integration

**Impact:**
- Complete endgame content foundation
- 13 production-ready services (5,096 lines)
- Comprehensive type system (3,683 lines)
- Complex systems fully implemented (voting, sabotage, interception)
- Ready for API layer development

---

## 🔄 Data Flow Examples

### Resource Harvesting Flow
```
User presses E key → HarvestButton onClick → POST /api/harvest
  → harvestService.processHarvest(player, tile)
  → Check harvest slots available (max 36, regen every 12h)
  → Calculate diminishing returns (power-law decay)
  → Apply specialization bonuses (Miner: +20%)
  → Apply boost effects (Harvest Boost: +50%)
  → Roll for cave loot (30% chance) or discovery (5% chance)
  → Deduct slot, add resources, create notifications
  → Track XP gain, check level up
  → Return updated player state
  → Update GameContext → Re-render UI
```

### Factory Attack Flow
```
User clicks Factory Button (R key) → CombatAttackModal opens
  → User confirms attack → POST /api/battle/attack
  → battleService.resolveCombat(attacker, defender, factory)
  → Calculate attacker power (sum of all units × specialization bonus)
  → Calculate defender power (factory units × 1.2 defensive bonus)
  → Determine winner (higher power wins, ties favor defender)
  → Create detailed battle log (participants, powers, winner, timestamp)
  → Update factory ownership if attacker wins
  → Update combat statistics (wins/losses/attacks/defenses)
  → Return battle result
  → BattleResultModal displays outcome
  → Update GameContext → Re-render factory state
```

### Auction Bidding Flow
```
User browses auction house (H key) → AuctionHousePanel displays listings
  → User clicks listing → BidHistoryViewer shows bid history
  → User enters bid amount → POST /api/auction/bid
  → auctionService.placeBid(player, listing, amount)
  → Validate: bid > current bid, player has resources
  → Deduct resources from player (escrow)
  → Refund previous bidder (if any)
  → Anti-snipe check: if <5 min remaining, extend by 5 min
  → Create bid record in auctionBids collection
  → Update listing with new current bid
  → Return success
  → Update AuctionHousePanel → Show new bid
```

### Specialization Mastery Progression Flow
```
User performs class-related activity (e.g., Miner harvests)
  → Activity API endpoint calls specializationService.addMasteryXP()
  → Calculate mastery XP gain based on activity type
  → Add to player.specialization.mastery (max 100)
  → Check for mastery level up (every 10 levels = new bonus tier)
  → Return updated mastery data
  → MasteryProgressBar updates in SpecializationPanel
  → Player sees visual progress
```

---

## 🗄️ Database Schema (Complete as of Phase 4)

### Collections

#### `tiles`
```typescript
{
  _id: ObjectId,
  x: number,                    // 1-150
  y: number,                    // 1-150
  terrain: TerrainType,         // 'Metal' | 'Energy' | 'Cave' | 'Forest' | 'Factory' | 'Wasteland'
  occupiedByBase: boolean,      // Optional, true if player base present
  factory?: {                   // Present if terrain === 'Factory'
    owner: string,              // Player username
    level: number,              // 1-5 (Basic, Advanced, Superior, Elite, Legendary)
    slots: number,              // Max units (base 10, +5/level)
    units: Array<{
      type: string,
      quantity: number
    }>,
    lastUpgraded: Date,
    totalProduced: number
  }
}
```
**Indexes:**
- Unique compound index on `(x, y)`
- Index on `factory.owner` for player factory queries

#### `players`
```typescript
{
  _id: ObjectId,
  username: string,             // Unique
  email: string,                // Unique
  passwordHash: string,         // bcrypt hashed
  base: {
    x: number,
    y: number
  },
  currentPosition: {
    x: number,
    y: number
  },
  resources: {
    metal: number,
    energy: number
  },
  bank: {                       // Phase 3: Banking system
    metal: number,
    energy: number
  },
  boosts: {                     // Phase 3: Temporary boosts
    xp: { active: boolean, expiresAt?: Date },
    harvest: { active: boolean, expiresAt?: Date },
    combat: { active: boolean, expiresAt?: Date }
  },
  harvestSlots: {               // Phase 2: Slot regeneration
    current: number,            // 0-36
    max: number,                // Base 10, +discoveries
    lastRegenerated: Date       // For 12-hour regen cycle
  },
  inventory: Array<{            // Phase 2: Cave loot items
    itemId: string,
    name: string,
    description: string,
    rarity: string,
    acquiredAt: Date
  }>,
  xp: number,                   // Phase 3: Experience points
  level: number,                // Phase 3: Character level
  unlockedTiers: number[],      // Phase 3: Available unit tiers [1,2,3...]
  specialization: {             // Phase 3: Class system
    type: 'Miner' | 'Warlord' | 'Industrialist' | null,
    chosenAt: Date,
    mastery: number,            // 0-100 mastery level
    masteryXP: number,          // XP toward next mastery level
    lastRespec: Date | null,    // For 7-day cooldown
    respecCount: number         // For escalating respec cost
  },
  discoveries: string[],        // Phase 3: Unlocked discovery IDs
  achievements: string[],       // Phase 3: Unlocked achievement IDs
  stats: {                      // Phase 3: Player statistics
    combatWins: number,
    combatLosses: number,
    factoriesControlled: number,
    totalHarvested: number,
    totalUnitsProduced: number,
    battlesInitiated: number,
    battlesDefended: number
  },
  auctionReputation: {          // Phase 4: Auction house
    rating: number,             // 0-5 stars
    totalSales: number,
    totalPurchases: number
  },
  createdAt: Date,
  lastLogin: Date
}
```
**Indexes:**
- Unique index on `username`
- Unique index on `email`
- Index on `stats.totalUnitsProduced` (for leaderboard)
- Index on `level` (for tier unlock queries)

#### `battleLogs`
```typescript
{
  _id: ObjectId,
  attacker: string,             // Username
  defender: string,             // Username
  factoryLocation: {
    x: number,
    y: number
  },
  attackerPower: number,
  defenderPower: number,
  winner: string,               // Username of winner
  factoryCaptured: boolean,     // True if ownership changed
  timestamp: Date,
  details: {                    // Detailed combat breakdown
    attackerUnits: Array<{ type: string, quantity: number, power: number }>,
    defenderUnits: Array<{ type: string, quantity: number, power: number }>,
    attackerBonuses: object,    // Specialization, boosts, etc.
    defenderBonuses: object
  }
}
```
**Indexes:**
- Index on `attacker` (for player battle history)
- Index on `defender` (for defense history)
- Index on `timestamp` (for recent battles)

#### `auctionListings`
```typescript
{
  _id: ObjectId,
  seller: string,               // Username
  itemType: 'unit' | 'item',
  itemId: string,               // Unit type or item ID
  itemName: string,
  quantity: number,
  startingBid: number,
  currentBid: number,
  buyoutPrice: number | null,   // Optional instant buyout
  currentBidder: string | null, // Username of highest bidder
  status: 'active' | 'sold' | 'expired',
  createdAt: Date,
  expiresAt: Date,              // 7 days from creation
  soldAt: Date | null,
  watchedBy: string[],          // Array of usernames
  clanOnly: boolean             // If true, only clan members can bid
}
```
**Indexes:**
- Index on `status` (filter active listings)
- Index on `seller` (user's listings)
- Index on `expiresAt` (expiry processing)
- Index on `itemType` (filter by type)

#### `auctionBids`
```typescript
{
  _id: ObjectId,
  listingId: ObjectId,          // Reference to auctionListings
  bidder: string,               // Username
  amount: number,
  timestamp: Date,
  refunded: boolean             // True if outbid and refunded
}
```
**Indexes:**
- Index on `listingId` (bid history for listing)
- Index on `bidder` (user's bid history)

#### `items`
```typescript
{
  _id: ObjectId,
  itemId: string,               // Unique item identifier
  name: string,
  description: string,
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary',
  dropRate: number,             // 0-1 probability
  source: 'Cave' | 'Forest' | 'Quest' | 'Achievement'
}
```
**Indexes:**
- Unique index on `itemId`

#### `discoveries`
```typescript
{
  _id: ObjectId,
  discoveryId: string,          // Unique discovery identifier
  name: string,
  description: string,
  effect: {                     // Permanent passive bonus
    type: string,               // 'harvestBonus' | 'combatBonus' | 'slotBonus' | etc.
    value: number               // Bonus amount
  },
  unlockMessage: string,        // Flavor text for discovery
  rarity: number                // 1-5 (affects prestige)
}
```
**Indexes:**
- Unique index on `discoveryId`

#### `achievements`
```typescript
{
  _id: ObjectId,
  achievementId: string,        // Unique achievement identifier
  name: string,
  description: string,
  requirement: {                // Unlock condition
    type: string,               // 'harvest' | 'combat' | 'factory' | etc.
    threshold: number           // Required amount
  },
  reward: {                     // Prestige unit or bonus
    type: 'unit' | 'bonus',
    value: string | object
  },
  prestigeValue: number,        // 1-10 (for progression tier)
  icon: string                  // Visual icon identifier
}
```
**Indexes:**
- Unique index on `achievementId`

---

## � Input Handling & User Controls

### Movement Controls (Three Schemes)
**Keyboard Mappings:** Three complete control schemes for maximum accessibility

1. **QWEASDZXC Layout** (Original grid)
   ```
   Q  W  E  =  [NW] [N]  [NE]
   A  S  D  =  [W]  [⟳]  [E]
   Z  X  C  =  [SW] [S]  [SE]
   ```

2. **Numpad 1-9 Layout** (Matches physical numpad)
   ```
   7  8  9  =  [NW] [N]  [NE]
   4  5  6  =  [W]  [⟳]  [E]
   1  2  3  =  [SW] [S]  [SE]
   ```

3. **Arrow Keys** (Cardinal directions only)
   ```
   ↑ = North, ↓ = South, ← = West, → = East
   ```

**Implementation:**
- Centralized `KeyToDirection` mapping in `types/game.types.ts`
- Event listener in `MovementControls.tsx` handles all schemes
- Prevents default browser behavior for game keys
- Same movement logic regardless of input method
- Added 2025-10-17 for improved accessibility (FID-20251017-006)

### Action Shortcuts
- **E Key:** Harvest resources from current tile
- **R Key:** Attack/control factory on current tile
- **I Key:** Toggle inventory panel

---

## �🎯 Design Patterns

### Singleton Pattern
**Used in:** MongoDB connection (`lib/mongodb.ts`)  
**Reason:** Prevent connection pool exhaustion, reuse single connection across serverless functions


## ⌨️ Input Handling & User Controls

### Movement Controls (Three Complete Schemes)
**Purpose:** Maximum accessibility with multiple input methods

1. **QWEASDZXC Layout** (Original grid)
   ```
   Q  W  E  =  [NW] [N]  [NE]
   A  S  D  =  [W]  [⟳]  [E]
   Z  X  C  =  [SW] [S]  [SE]
   ```

2. **Numpad 1-9 Layout** (Matches physical numpad)
   ```
   7  8  9  =  [NW] [N]  [NE]
   4  5  6  =  [W]  [⟳]  [E]
   1  2  3  =  [SW] [S]  [SE]
   ```

3. **Arrow Keys** (Cardinal directions only)
   ```
   ↑ = North, ↓ = South, ← = West, → = East
   ```

**Implementation:**
- Centralized `KeyToDirection` mapping in `types/game.types.ts`
- Event listener in `MovementControls.tsx` handles all schemes
- Prevents default browser behavior for game keys
- Same movement logic regardless of input method
- Wrap-around map edges (150→1, 1→150)

### Action Shortcuts (Complete List)
**CRITICAL:** Movement keys (QWEASDZXC, numpad 1-9, arrow keys) are RESERVED for movement ONLY

**Harvesting & Combat:**
- **G Key:** Gather resources from Metal/Energy tiles
- **F Key:** Forage in Cave/Forest tiles (exploration/loot)
- **R Key:** Attack/control factory on current tile

**Panel Toggles:**
- **I Key:** Toggle Inventory panel
- **P Key:** Toggle sPecialization/Progression panel
- **D Key:** Toggle Discovery log panel
- **B Key:** Open Bank panel (must be at Bank tile)
- **N Key:** Open shriNe panel (must be at Shrine tile)
- **M Key:** Toggle Factory Management panel
- **U Key:** Toggle Unit Build panel
- **T Key:** Toggle Tier Unlock panel
- **V Key:** Toggle achieVement panel
- **H Key:** Toggle auction House panel
- **Escape Key:** Close any open modal/panel

**Implementation:**
- Each component registers its own keyboard listener
- Movement keys handled exclusively by `MovementControls.tsx` via `KeyToDirection` mapping
- All action keys prevent default browser behavior
- No conflicts with movement controls (Q/W/E/A/S/D/Z/X/C, 1-9, arrows all reserved for movement)

---

## 🎯 Design Patterns & Architecture Decisions

### Singleton Pattern
**Used in:** MongoDB connection (`lib/mongodb.ts`)  
**Reason:** Prevent connection pool exhaustion in serverless environment, reuse single connection across API route invocations  
**Implementation:** Module-scoped connection variable, lazy initialization, connection reuse

###Service Layer Pattern
**Used in:** All business logic (27 service modules)  
**Reason:** Separate business logic from API routes, enable reusability, facilitate testing, maintain single responsibility  
**Services:**
- Authentication: `authService.ts`, `authMiddleware.ts`
- Resources: `harvestService.ts`, `caveItemService.ts`, `balanceService.ts`
- Combat: `battleService.ts`, `statTrackingService.ts`
- Progression: `xpService.ts`, `tierUnlockService.ts`, `specializationService.ts`, `discoveryService.ts`, `achievementService.ts`
- Economy: `auctionService.ts`, `factoryService.ts`, `factoryUpgradeService.ts`
- Core: `playerService.ts`, `movementService.ts`, `mapGeneration.ts`, `rankingService.ts`
- Utilities: `slotRegenService.ts`, `imageService.ts`, `logger.ts`, `toastService.tsx`, `utils.ts`, `harvestMessages.ts`

### Repository Pattern
**Used in:** Database access via service layer  
**Reason:** Abstract MongoDB operations, centralize query logic, provide consistent data access interface  
**Implementation:** Each service owns its database queries, shared `mongodb.ts` connection singleton

### Context Pattern
**Used in:** React state management (`GameContext.tsx`)  
**Reason:** Share game state across 35+ components without prop drilling, avoid Redux complexity overhead  
**State Managed:**
- Player data (resources, position, level, XP, specialization, etc.)
- Current tile information
- UI panel visibility (inventory, bank, factories, etc.)
- Toast notifications
- Modal state (battle results, level ups, achievements, etc.)

### Custom Hooks Pattern
**Used in:** State management and side effects  
**Examples:** `useState`, `useEffect`, `useCallback`, `useContext`, `useRef`  
**Reason:** Encapsulate stateful logic, promote reusability, clean component code  
**Note:** Project uses built-in React hooks, no custom hook files currently

### Middleware Pattern
**Used in:** Next.js middleware for route protection (`middleware.ts`)  
**Reason:** Centralized authentication check before route handlers execute  
**Implementation:** Edge Runtime JWT verification with jose library, cookie parsing, redirect to /login on failure

### Barrel Export Pattern
**Used in:** `index.ts` files in components/, lib/, types/, utils/  
**Reason:** Clean imports, centralized exports, easier refactoring  
**Example:**
```typescript
// Instead of: import { HarvestButton } from './components/HarvestButton';
// Use: import { HarvestButton } from './components';
```

### Modular Component Design
**Used in:** All 35 React components  
**Reason:** Single responsibility, reusability, maintainability  
**Pattern:** Each component manages own state, uses GameContext for global state, emits events via callbacks

---

## 🔒 Security Considerations

### Authentication & Authorization
- **JWT Tokens:** Signed with jose library (Edge Runtime-compatible), HS256 algorithm
- **Password Security:** bcrypt hashing with 10 salt rounds, salted automatically
- **Session Management:** HTTP-only cookies (not accessible via JavaScript), secure flag in production
- **Middleware Protection:** Edge Runtime authentication on /game routes before page render
- **Token Expiration:** 1 hour default, 30 days with "Remember Me" checked
- **Logout:** Clear HTTP-only cookie, redirect to login

### Edge Runtime vs Node.js Runtime
**Critical Distinction:** Next.js middleware runs in Edge Runtime (lightweight, no native modules)

- **Middleware** (`middleware.ts`): Edge Runtime
  - Uses `jose` for JWT verification (pure JavaScript)
  - Cannot use bcrypt or other native Node.js modules
  - Cannot access file system or Node.js APIs
  - Fast, globally distributed, minimal cold start

- **API Routes** (`app/api/**/route.ts`): Node.js Runtime
  - Uses `jsonwebtoken` and `bcrypt` for authentication
  - Full Node.js API access (fs, crypto, native modules)
  - MongoDB connections and complex operations
  - Standard serverless function behavior

### Input Validation & Sanitization
- **Username:** Alphanumeric + underscores only, 3-20 characters, trim whitespace
- **Email:** Valid email format, trim whitespace
- **Password:** Minimum 6 characters, maximum 100 characters
- **Coordinates:** 1-150 range validation, integer only
- **Movement Direction:** Whitelist of valid keys (QWEASDZXC, numpad 1-9, arrows)
- **Resource Amounts:** Non-negative integers, maximum limits enforced
- **MongoDB Queries:** Parameterized queries prevent injection, no user input in query structure

### Database Security
- **Connection String:** Stored in `.env.local` (git-ignored), never committed
- **MongoDB Atlas:** TLS/SSL encryption for connections, IP whitelist for access control
- **Unique Indexes:** Prevent duplicate usernames/emails
- **Atomic Operations:** Use `findOneAndUpdate` with `returnDocument: 'after'` to prevent race conditions
- **Authorization:** API routes verify JWT token before any database operation
- **Data Sanitization:** Trim whitespace, validate types before database insertion

### Environment Variables
**Required Variables:**
- `MONGODB_URI` - MongoDB Atlas connection string (includes credentials)
- `JWT_SECRET` - Signing key for JWT tokens (minimum 32 characters recommended)

**Best Practices:**
- Never commit `.env.local` to version control (git-ignored)
- Use different secrets for development/staging/production
- Rotate JWT_SECRET periodically in production
- Use MongoDB Atlas IP whitelist or VPC peering in production

### OWASP Top 10 Compliance

1. **Broken Access Control:** ✅ JWT verification on all protected routes
2. **Cryptographic Failures:** ✅ Bcrypt for passwords, HTTPS in production
3. **Injection:** ✅ Parameterized MongoDB queries, input validation
4. **Insecure Design:** ✅ Service layer separation, middleware authentication
5. **Security Misconfiguration:** ✅ HTTP-only cookies, secure headers, no exposed secrets
6. **Vulnerable Components:** ✅ Regular `npm audit`, dependencies up-to-date
7. **Identification/Authentication:** ✅ JWT tokens, bcrypt hashing, session management
8. **Software & Data Integrity:** ✅ Input validation, atomic database operations
9. **Security Logging:** ✅ Structured logging with `logger.ts` (no sensitive data)
10. **Server-Side Request Forgery:** ✅ No user-controlled URLs in backend requests

---

## ⚡ Performance Optimization

### Frontend Optimizations
- **React Context:** No Redux overhead, direct context access
- **Tailwind CSS:** Optimized, purged in production build, minimal runtime
- **Next.js Code Splitting:** Automatic component lazy loading
- **Component Memoization:** Use `React.memo` where appropriate (future improvement)
- **Keyboard Shortcuts:** Event listeners on mount, single global handler
- **Dynamic Imports:** Modal components loaded on-demand (future improvement)

### Backend Optimizations
- **MongoDB Connection Pooling:** Single connection reused across serverless invocations
- **Database Indexes:** Compound indexes on frequently queried fields
  - `tiles`: (x, y) unique compound index
  - `players`: username unique index, email unique index
  - `battleLogs`: attacker index, defender index, timestamp index
  - `auctionListings`: status index, seller index, expiresAt index
- **Query Optimization:** Project only needed fields, use `lean()` for read-only queries
- **Bulk Operations:** Use `bulkWrite()` for multiple updates (map generation, slot regen)
- **Aggregation Pipelines:** Use MongoDB aggregation for complex queries (leaderboard, statistics)

### Map Generation Optimization
- **One-Time Generation:** 22,500 tiles generated once, idempotency check prevents duplicates
- **Bulk Insert:** Single `insertMany()` operation for all tiles
- **Indexed Queries:** Fast (x, y) lookups with compound index

### Resource Harvesting Optimization
- **Slot Regeneration:** Batch regeneration check every 12 hours, not per-harvest
- **Diminishing Returns:** Pre-calculated power-law decay curve, O(1) lookup
- **Cave Loot:** Random roll with early exit, no full item table scan
- **Discovery Check:** 5% probability, early exit if fails

### Combat System Optimization
- **Power Calculation:** Simple sum of unit power values, O(n) where n = unit types
- **Battle Log Creation:** Single insert operation, no complex joins
- **Statistics Update:** Atomic increment operations, no read-modify-write

### Database Query Patterns
**Efficient:**
- `findOne({ x: 50, y: 50 })` - Uses compound index
- `updateOne({ username: 'player' }, { $inc: { 'resources.metal': 10 } })` - Atomic increment
- `aggregate([{ $match: { status: 'active' } }, { $sort: { expiresAt: 1 } }])` - Uses indexes

**To Avoid:**
- `find({}).toArray()` - Loads entire collection into memory
- `find({})` without projection - Returns all fields unnecessarily
- Multiple sequential `findOne()` calls - Use `aggregate()` or `$in` instead

---

## 🧪 Testing Strategy

### Current Approach (Manual Testing)
**Coverage:** 100% of features manually tested before completion  
**Method:**
1. Implement feature completely
2. Start development server (`npm run dev`)
3. Test all user flows and edge cases
4. Verify error handling and validation
5. Check TypeScript compilation (0 errors policy)
6. Test keyboard shortcuts and UI interactions
7. Verify database state changes
8. Document in `/dev/completed.md`

**Quality Assurance:**
- TypeScript strict mode enforced (catches 80% of bugs per lessons-learned)
- ESLint with Next.js config
- 0 compilation errors policy maintained throughout project
- Manual testing covers all acceptance criteria

### Future Testing Enhancements (Planned)
**Unit Testing:**
- Framework: Jest with TypeScript support
- Target: Service layer functions (27 services)
- Coverage Goal: 80%+ on business logic
- Example tests:
  - `harvestService.processHarvest()` - Resource calculations
  - `battleService.resolveCombat()` - Combat power calculations
  - `specializationService.addMasteryXP()` - XP progression

**Integration Testing:**
- Framework: Jest + Supertest
- Target: API routes (60+ endpoints)
- Coverage Goal: All critical paths
- Example tests:
  - POST /api/harvest - Harvest resources successfully
  - POST /api/battle/attack - Attack factory and capture
  - POST /api/auction/bid - Place bid and escrow resources

**End-to-End Testing:**
- Framework: Playwright or Cypress
- Target: Critical user flows
- Coverage Goal: Major game loops
- Example tests:
  - User registration → Login → First harvest
  - Factory attack → Victory → Ownership transfer
  - Auction listing → Bidding → Sale completion
  - Specialization choice → Mastery progression

**Performance Testing:**
- Framework: Artillery or k6
- Target: API endpoints under load
- Metrics: Response time, throughput, error rate
- Example scenarios:
  - 100 concurrent users harvesting
  - 50 concurrent factory attacks
  - 200 concurrent leaderboard queries

---

## 📊 Development Metrics & Insights

### Code Volume (Current)
- **Total Production Code:** ~25,000 lines
- **Services:** ~8,500 lines (27 files)
- **Components:** ~7,500 lines (35 files)
- **API Routes:** ~5,000 lines (60+ files)
- **Type Definitions:** ~2,000 lines
- **Documentation:** ~2,000 lines (/dev folder)

### Architecture Quality Indicators
- **TypeScript Errors:** 0 (maintained throughout project)
- **Build Errors:** 0
- **Linting Issues:** 0
- **Runtime Errors:** 0 critical errors
- **Component Reusability:** High (modals, panels, buttons)
- **Service Modularity:** Excellent (27 focused services)
- **Test Coverage:** Manual only (automated planned)

### Technical Debt Assessment
**Low Debt Areas:**
- Type safety (TypeScript strict mode)
- Error handling (comprehensive try/catch, validation)
- Documentation (JSDoc, OVERVIEW sections, inline comments)
- Modularity (service layer, barrel exports)
- Security (OWASP compliance, JWT, bcrypt)

**Areas for Improvement:**
- Automated testing (0% coverage currently)
- Git workflow (linear commits, needs branching strategy)
- Database indexes (can add compound indexes for complex queries)
- Performance monitoring (no metrics collection yet)
- Error tracking (no Sentry/similar integration)

**Overall Technical Debt:** Minimal (< 5% of codebase)

---

## 🔄 System Evolution & Future Architecture

### Completed Evolution (Phases 1-4)
- Phase 1: Core foundation (map, movement, authentication)
- Phase 2: Resource economy (harvesting, factories, units)
- Phase 3: Progression systems (XP, specializations, discoveries, achievements, combat, leaderboard)
- Phase 4: Player economy (auction house, P2P trading)

### Planned Evolution (Phases 5-7)

**Phase 5: Clan System**
- New collections: `clans`, `clanMembers`, `clanWars`
- Clan creation, membership management, shared resources
- Clan auctions (0% fee vs 5% public)
- Clan-based leaderboards and territory control
- New components: ClanPanel, ClanManagementPanel, ClanWarPanel
- New services: clanService.ts, clanWarService.ts

**Phase 6: Activity Logging**
- New collection: `activityLogs`
- Track all player actions (harvests, attacks, trades, etc.)
- Activity feed in UI
- Analytics and insights
- New component: ActivityFeedPanel
- New service: activityLogService.ts

**Phase 7: Admin Panel**
- Admin authentication and authorization
- Player management (ban, reset, adjust resources)
- Game statistics and monitoring
- Configuration management (rates, costs, limits)
- New collection: `admins`
- New components: AdminPanel, PlayerManagementPanel, GameConfigPanel
- New service: adminService.ts

### Architectural Improvements (Suggested)

**High Priority:**
1. **Automated Testing:** Add Jest + Playwright testing suite
2. **Database Optimization:** Add compound indexes for common query patterns
3. **Performance Monitoring:** Integrate application performance monitoring (APM)
4. **Error Tracking:** Add Sentry or similar for production error tracking

**Medium Priority:**
5. **CI/CD Pipeline:** GitHub Actions for automated testing and deployment
6. **WebSocket Integration:** Real-time updates for auction bids, combat, etc.
7. **Caching Layer:** Redis for frequently accessed data (leaderboard, player profiles)
8. **Rate Limiting:** Prevent API abuse (currently relies on game mechanics only)

**Low Priority:**
9. **GraphQL API:** Alternative to REST for complex queries
10. **Mobile App:** React Native companion app
11. **Microservices:** Split monolith into services (only if scale demands)

---

## 📚 Key Architectural Decisions (Historical)

### Decision 1: TypeScript Strict Mode (Day 1, 2025-10-16)
**Context:** Project initialization  
**Options:** JavaScript, TypeScript (loose), TypeScript (strict)  
**Chosen:** TypeScript strict mode  
**Rationale:**
- Catch bugs at compile time (80% of bugs per lessons-learned)
- Excellent IDE autocomplete and IntelliSense
- Self-documenting code with type annotations
- Industry best practice for large projects

**Outcome:** Maintained 0 TypeScript errors throughout 36 features

---

### Decision 2: React Context Over Redux (Day 1, 2025-10-16)
**Context:** Global state management choice  
**Options:** Redux, Zustand, Recoil, React Context API  
**Chosen:** React Context API  
**Rationale:**
- Sufficient for game state complexity
- No external library overhead
- Simpler mental model for single-developer project
- Easy to refactor to Zustand/Redux if needed later

**Outcome:** Clean state management, no performance issues detected

---

### Decision 3: MongoDB Over PostgreSQL (Day 1, 2025-10-16)
**Context:** Database selection  
**Options:** PostgreSQL, MongoDB, MySQL  
**Chosen:** MongoDB Atlas  
**Rationale:**
- Flexible schema for evolving game mechanics
- JSON document model matches JavaScript objects
- Easy aggregation pipelines for analytics
- Managed hosting with MongoDB Atlas (no DevOps)
- Good fit for semi-structured game data

**Outcome:** Fast development, easy schema evolution, zero database issues

---

### Decision 4: Service Layer Pattern (Day 1, 2025-10-16)
**Context:** Code organization strategy  
**Options:** Fat controllers, service layer, domain-driven design  
**Chosen:** Service layer pattern  
**Rationale:**
- Separate business logic from API routes
- Reusable functions across multiple endpoints
- Easier to test (unit test services independently)
- Single Responsibility Principle

**Outcome:** 27 focused services, clean API routes, high maintainability

---

### Decision 5: Edge Runtime for Middleware (Day 1, 2025-10-16)
**Context:** Authentication middleware implementation  
**Options:** Node.js middleware, Edge Runtime middleware  
**Chosen:** Edge Runtime with jose library  
**Rationale:**
- Faster cold starts (Edge Runtime vs Node.js)
- Globally distributed (low latency)
- Cannot use native modules (bcrypt) → use jose instead

**Outcome:** Fast authentication checks, successful Edge deployment

---

### Decision 6: Manual Testing Only (Day 1, 2025-10-16)
**Context:** Testing strategy for MVP  
**Options:** TDD with full test suite, manual testing only, hybrid  
**Chosen:** Manual testing with future automated tests  
**Rationale:**
- Rapid feature development prioritized for MVP
- TypeScript catches most bugs at compile time
- Automated tests planned for post-MVP (Phase 5+)
- Manual testing sufficient for single-developer project

**Outcome:** 0 critical bugs in production, fast development velocity

**Future Plan:** Add Jest + Playwright after Phase 4 completion

---

### Decision 7: Three Specialization Classes (Day 2, 2025-10-17)
**Context:** Specialization system design  
**Options:** 3 classes, 5 classes, 10+ classes  
**Chosen:** 3 classes (Miner, Warlord, Industrialist)  
**Rationale:**
- Balance simplicity with meaningful choice
- Each class covers major gameplay pillar (harvest, combat, factories)
- Easier to balance three classes than many
- Clear identity and bonuses for each

**Outcome:** Balanced gameplay, clear player archetypes, easy to understand

---

### Decision 8: 5% Discovery Drop Rate (Day 2, 2025-10-17)
**Context:** Discovery system unlock rate  
**Options:** 1% (very rare), 5% (rare), 10% (common)  
**Chosen:** 5% chance per harvest  
**Rationale:**
- Long-term progression goal without excessive grind
- Avg 20 harvests per discovery (manageable)
- Maintains excitement when discovery triggers
- 15 discoveries = ~300 harvests to collect all (reasonable)

**Outcome:** Currently in testing, feels appropriate based on playtesting

---

### Decision 9: 5% Auction Fee (Public), 0% Clan (Day 2, 2025-10-17)
**Context:** Auction house fee structure  
**Options:** No fees, flat fee, percentage fee, clan discount  
**Chosen:** 5% fee on public auctions, 0% on clan auctions  
**Rationale:**
- Resource sink to prevent inflation
- Incentivizes clan membership (future Phase 5)
- Standard economic model (real auction houses charge ~10-15%)
- 5% is noticeable but not punishing

**Outcome:** Functional economy, incentive for clan feature (Phase 5)

---

## 🔍 System Dependencies & Interactions

### Critical Dependencies
```
authService.ts
  ├─ Used by: All API routes (JWT verification)
  ├─ Depends on: mongodb.ts, bcrypt, jose
  └─ Impact: Authentication for entire system

playerService.ts
  ├─ Used by: Most API routes (player queries/updates)
  ├─ Depends on: mongodb.ts
  └─ Impact: Core player data operations

GameContext.tsx
  ├─ Used by: All 35 React components (global state)
  ├─ Depends on: React Context API
  └─ Impact: UI state synchronization

mongodb.ts
  ├─ Used by: All 27 services (database connection)
  ├─ Depends on: MongoDB Driver
  └─ Impact: All database operations
```

### Service Interaction Examples

**Harvest Flow Services:**
```
API Route → harvestService
  ├─ Calls: playerService (get player data)
  ├─ Calls: caveItemService (30% chance for loot)
  ├─ Calls: discoveryService (5% chance for discovery)
  ├─ Calls: xpService (calculate XP gain)
  ├─ Calls: specializationService (Miner bonus check)
  └─ Updates: Player resources, XP, discoveries
```

**Combat Flow Services:**
```
API Route → battleService
  ├─ Calls: playerService (get attacker/defender)
  ├─ Calls: specializationService (Warlord bonus check)
  ├─ Calls: statTrackingService (update combat stats)
  └─ Updates: Factory ownership, battle logs, player stats
```

**Auction Flow Services:**
```
API Route → auctionService
  ├─ Calls: playerService (validate buyer resources)
  ├─ Calls: balanceService (escrow resources)
  └─ Updates: Auction listings, bids, player reputation
```

---

## 🤖 Auto-Farm System Architecture (FID-20251019-003)

### System Overview
Auto-Farm is a client-side autonomous map traversal system implementing a snake pattern algorithm to systematically harvest resources across the entire 150×150 map grid (22,500 tiles). Built with TypeScript strict mode and event-driven architecture.

### Core Components

**1. AutoFarmEngine (utils/autoFarmEngine.ts)**
- **Class-based design:** Encapsulated state management with private methods
- **Snake pattern algorithm:** Row-by-row traversal with alternating direction
- **Event system:** Callback-based notifications (onEvent, onStats, onState)
- **State machine:** Three states (STOPPED, ACTIVE, PAUSED)
- **API integration:** Movement, harvesting, tile info, combat
- **Timing control:** 900ms delay between tiles, 1000ms stats updates

**2. Type System (types/autoFarm.types.ts)**
```typescript
// Enums
AutoFarmStatus: STOPPED | ACTIVE | PAUSED
RankFilter: ALL | LOWER | HIGHER
ResourceTarget: METAL | ENERGY | LOWEST

// Core Interfaces
AutoFarmConfig: { attackPlayers, rankFilter, resourceTarget }
AutoFarmState: { status, currentPosition, tilesCompleted, timing }
AutoFarmSessionStats: { timeElapsed, resources, combat, errors }
AutoFarmAllTimeStats: { cumulative totals, sessionCount }
AutoFarmEvent: { type, timestamp, position, data, message }
```

**3. UI Components**
- **AutoFarmPanel:** Control interface (Start/Pause/Resume/Stop)
- **AutoFarmStatsDisplay:** Real-time statistics with session/all-time toggle
- **Settings Page:** Configuration interface with localStorage persistence

### Snake Pattern Algorithm

**Traversal Logic:**
```typescript
Row 1:  (1,1) → (2,1) → (3,1) ... → (150,1)
Row 2:  (150,2) → (149,2) → (148,2) ... → (1,2)
Row 3:  (1,3) → (2,3) → (3,3) ... → (150,3)
Row 4:  (150,4) → (149,4) → (148,4) ... → (1,4)
...
Row 150: (150,150) → (149,150) ... → (1,150)

Total tiles: 150 rows × 150 columns = 22,500 tiles
Est. duration: 22,500 tiles × 0.9s = ~5.6 hours
```

**Direction Calculation:**
```typescript
getNextPosition(current: {x, y}, row: number, direction: 'left'|'right') {
  if (direction === 'right') {
    if (x < MAP_WIDTH) return { x: x + 1, y };
    else return { x, y: y + 1, direction: 'left' };
  } else {
    if (x > 1) return { x: x - 1, y };
    else return { x, y: y + 1, direction: 'right' };
  }
}
```

### API Integration Flow

**Tile Processing Pipeline:**
```
1. moveToPosition(target)
   ├─ Calculate direction vector (dx, dy)
   ├─ Map to MovementDirection (N, NE, E, SE, S, SW, W, NW)
   ├─ POST /api/move { username, direction }
   └─ Update internal position state

2. getTileInfo(position)
   ├─ GET /api/tile?x=X&y=Y
   ├─ Returns { terrain, occupiedByBase, baseOwner }
   └─ Used for harvest/combat decisions

3. Decision Tree:
   ├─ If occupiedByBase && attackPlayers → attackBase()
   ├─ Else if harvestable terrain → attemptHarvest()
   └─ Else skip to next tile

4. attemptHarvest(position, tileInfo)
   ├─ Check terrain: Metal, Energy, Cave, Forest
   ├─ POST /api/harvest { username }
   ├─ Update stats: metalCollected, energyCollected, items
   └─ Emit harvest event

5. attackBase(tileInfo) [if enabled]
   ├─ Fetch attacker/defender player data
   ├─ Apply rank filter (skip if not met)
   ├─ selectUnitsForCombat() with resource targeting
   ├─ POST /api/combat/infantry { targetUsername, unitIds }
   ├─ Update stats: attacksLaunched, Won, Lost
   └─ Emit combat event

6. Wait 900ms → next tile
```

### Combat Integration

**Rank Filtering:**
```typescript
if (rankFilter === LOWER && defenderRank >= attackerRank) skip;
if (rankFilter === HIGHER && defenderRank <= attackerRank) skip;
```

**Unit Selection Strategy:**
```typescript
selectUnitsForCombat(units, attackerResources, defender) {
  switch (resourceTarget) {
    case METAL:
      return units.sort((a,b) => b.str - a.str); // Strongest first
    case ENERGY:
      return units.sort((a,b) => b.str - a.str); // Strongest first
    case LOWEST:
      const target = defender.metal <= defender.energy ? 'METAL' : 'ENERGY';
      return units.sort((a,b) => b.str - a.str); // Strongest first
  }
}
```

### Statistics Architecture

**Real-Time Tracking:**
```typescript
SessionStats {
  timeElapsed: number (milliseconds)
  metalCollected: number
  energyCollected: number
  tilesVisited: number
  caveItemsFound: number
  forestItemsFound: number
  attacksLaunched: number
  attacksWon: number
  attacksLost: number
  errorsEncountered: number
}

AllTimeStats extends SessionStats {
  totalSessionsCompleted: number
  lastUpdated: Date
}
```

**Update Frequency:**
- Position updates: Real-time (every tile)
- Statistics updates: 1000ms intervals
- Event emissions: Immediate on state changes

**Persistence Layer:**
```typescript
// localStorage keys
'darkframe_autofarm_config' → AutoFarmConfig
'darkframe_autofarm_alltime_stats' → AutoFarmAllTimeStats

// Merge logic on session end
mergeSessionIntoAllTime(session, allTime) {
  return {
    ...allTime,
    metalCollected: allTime.metalCollected + session.metalCollected,
    // ... (all stats accumulated)
    totalSessionsCompleted: allTime.totalSessionsCompleted + 1,
    lastUpdated: new Date()
  }
}
```

### Event System

**Event Types:**
```typescript
type EventType = 'move' | 'harvest' | 'combat' | 'error' | 'complete'

AutoFarmEvent {
  type: EventType
  timestamp: number
  position: { x: number, y: number }
  data?: any // Event-specific payload
  message?: string // Human-readable description
}
```

**Callback Registration:**
```typescript
engine.onEvent((event) => {
  if (event.type === 'error') showToast(event.message);
  if (event.type === 'complete') showToast('Map completed!');
});

engine.onStats((stats) => {
  setSessionStats(stats); // Update UI
});

engine.onState((state) => {
  setStatus(state.status);
  setPosition(state.currentPosition);
  setTilesCompleted(state.tilesCompleted);
});
```

### Performance Characteristics

**Memory Usage:**
- Engine instance: ~1KB base state
- Event callbacks: No history stored (fire-and-forget)
- Statistics: ~200 bytes session + ~200 bytes all-time
- Total footprint: ~1.5KB runtime memory

**CPU Usage:**
- Main loop: setTimeout-based (non-blocking)
- API calls: async/await pattern
- UI updates: React state batching (1s interval)
- Negligible CPU impact during idle periods

**Network Traffic:**
- Movement: ~200 bytes per tile (POST /api/move)
- Tile info: ~300 bytes per tile (GET /api/tile)
- Harvest: ~400 bytes per harvest (POST /api/harvest)
- Combat: ~1KB per battle (POST /api/combat/infantry)
- Average: ~500 bytes per tile × 22,500 tiles = ~11MB per full run

### Error Handling & Recovery

**Error Categories:**
1. **Network errors:** Caught, logged, increment error counter, skip tile
2. **API failures:** Parsed from response, emit error event, continue
3. **State corruption:** Prevented by TypeScript strict mode
4. **Cooldown violations:** Server-side rejection, gracefully handled

**Recovery Mechanisms:**
- Pause on repeated errors (future enhancement)
- Auto-resume after transient failures
- Manual stop available at any time
- Statistics preserved even if interrupted

### Security Considerations

**Client-Side Risks:**
- **Mitigation:** All actions validated server-side
- **Rate limiting:** 900ms delays prevent overwhelming server
- **Anti-cheat integration:** Movement API has speed hack detection
- **Session validation:** All API calls require valid JWT tokens

**Future Security Enhancements:**
- Premium gating system integration
- Server-side session tracking
- Anomaly detection for bot behavior
- Cooldown enforcement at API level

### Integration Points

**GamePage Integration:**
```typescript
// Engine lifecycle
useEffect(() => {
  const engine = new AutoFarmEngine(config, startPosition);
  engine.onEvent(handleEvent);
  engine.onStats(setStats);
  engine.onState(setState);
  autoFarmEngineRef.current = engine;
  
  return () => engine.destroy();
}, [player]);

// Control handlers
handleAutoFarmStart() → engine.start()
handleAutoFarmPause() → engine.pause()
handleAutoFarmResume() → engine.resume()
handleAutoFarmStop() → engine.stop()

// Keyboard shortcuts
'R' → Toggle (Start/Pause/Resume)
'Shift+R' → Stop
'Shift+S' → Toggle stats display
```

**Component Hierarchy:**
```
GamePage
├─ GameLayout
│  ├─ StatsPanel (left sidebar)
│  ├─ TileView (center)
│  └─ ControlsPanel (right sidebar)
│     ├─ MovementControls
│     ├─ AutoFarmPanel ← New
│     └─ [Stats toggle button] ← New
└─ AutoFarmStatsDisplay (conditional) ← New
```

### Future Enhancements

**Phase 2 (Premium Gating):**
- Monetization integration
- Trial period (1 hour free)
- Premium unlock verification
- Payment processing integration

**Phase 3 (Advanced Features):**
- Multiple pattern support (spiral, random)
- Smart pathing (skip known empty tiles)
- Resource optimization (pause on low resources)
- Advanced combat strategies (unit type selection)
- Custom zones (focus on specific regions)

**Phase 4 (Analytics):**
- Statistics dashboard with charts
- Efficiency metrics visualization
- Historical session comparison
- Export to CSV/JSON
- Resource gain projections

### Testing Strategy

**Unit Tests (Future):**
- Snake pattern algorithm correctness
- Direction calculation edge cases
- Statistics accumulation accuracy
- Event emission verification

**Integration Tests:**
- API call sequencing
- Error recovery flows
- State persistence across sessions
- Callback invocation timing

**E2E Tests:**
- Complete map traversal simulation
- Pause/resume functionality
- Combat integration with rank filters
- Statistics accuracy validation

### Architectural Decisions

**Why Client-Side Engine?**
- ✅ No server resources consumed during farming
- ✅ User can monitor progress in real-time
- ✅ Easier to debug and iterate
- ✅ Premium feature can be gated at API level
- ❌ Vulnerable to client manipulation (mitigated by server validation)

**Why Snake Pattern?**
- ✅ Simple implementation, predictable behavior
- ✅ Complete coverage guaranteed
- ✅ Easy to resume from any position
- ✅ Minimal memory footprint
- ❌ Not optimal for specific resource targeting (future enhancement)

**Why Callback-Based Events?**
- ✅ Memory efficient (no event history stored)
- ✅ React-friendly (setState in callbacks)
- ✅ Decoupled from UI rendering
- ✅ Easy to add new event listeners
- ❌ No event replay capability (acceptable trade-off)

**Why localStorage for Persistence?**
- ✅ Instant access, no API calls
- ✅ Survives page refreshes
- ✅ Simple CRUD operations
- ✅ Perfect for user preferences
- ❌ Limited storage (5-10MB, sufficient for stats)

---

