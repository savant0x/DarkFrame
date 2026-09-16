# 🏗️ DarkFrame - Technical Architecture

> System design, technology decisions, and implementation patterns.
> **Status (2026-09-15 audit):** header/stack/counts below are current.
> Deeper sections retain their October-2025 text and are pending re-audit
> where they describe pre-pivot (MongoDB-era) topology.

**Last Updated:** September 15, 2026
**System Status:** Live — Postgres-backed persistent world, all gates green
**Code Volume:** ~856 tests green; 180+ API routes; ~90 game services

---

## 📐 **System Architecture Overview**

DarkFrame follows a **three-tier architecture** with strict separation of concerns:

```
┌─────────────────────────────────────────┐
│     PRESENTATION LAYER (React/Next.js)   │
│  130+ Components + Context API State     │
└─────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│   APPLICATION LAYER (Next.js API Routes) │
│  180+ Endpoints + ~90 Service Modules    │
└─────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│   DATA LAYER (PostgreSQL via Drizzle)    │
│  60+ Tables + Migrations + Compat Seam   │
└─────────────────────────────────────────┘
```
(CUSTOM Node server hosts Next.js + Socket.io + scheduled jobs in one
process; Vercel serverless for routes. A Mongo-flavored compat shim bridges
legacy service call shapes and is being retired incrementally.)

---

## 🔧 **Technology Stack**

### Frontend Technologies
- **Framework:** Next.js 16 (App Router, webpack build)
- **Language:** TypeScript 5 (strict mode, 0 errors maintained)
- **UI Library:** React 19 (functional components only)
- **Styling:** Tailwind CSS 4 + NEON NOIR token system
- **State Management:** React Context API (GameContext)
- **Notifications:** Server-reason toasts (structured error envelopes)

### Backend Technologies
- **Runtime:** Custom Node server (Next + Socket.io + cron jobs)
- **API Framework:** Next.js API Routes
- **Database:** PostgreSQL (Supabase-managed; Drizzle ORM, migrated schema)
- **Authentication:** JWT with jose library (Edge-compatible)
- **Password Security:** bcrypt 6.0.0 (API routes only)
- **Logging:** Custom structured logger with ISO timestamps

### Development Tools
- **Package Manager:** npm
- **Code Quality:** ESLint with Next.js configuration
- **Type Checking:** TypeScript compiler (strict mode)
- **Version Control:** Git + GitHub
- **Development System:** ECHO v5.1 (Anti-Drift Expert Coder)
- **Project Management:** /dev folder ecosystem with FID tracking

---

## 📂 **Project Structure**

```
darkframe/
├── app/                         # Next.js App Router
│   ├── api/                    # 60+ API route handlers
│   │   ├── achievements/       # Achievement system
│   │   ├── auction/           # Auction house
│   │   ├── balance/           # Banking & exchanges
│   │   ├── battle/            # PVP combat
│   │   ├── cave/              # Cave exploration
│   │   ├── clan/              # Clan management
│   │   ├── discoveries/       # Technology unlocks
│   │   ├── factory/           # Factory management
│   │   ├── harvest/           # Resource gathering
│   │   ├── specialization/    # Progression trees
│   │   ├── vip/               # VIP system
│   │   └── wmd/               # WMD system (Phase 2)
│   ├── game/                  # Main game interface
│   ├── clan/                  # Clan pages
│   ├── wmd/                   # WMD interface
│   └── admin/                 # Admin panel
│
├── components/                 # 50+ React components
│   ├── GameLayout.tsx         # 3-panel game structure
│   ├── StatsPanel.tsx         # Left panel (player stats)
│   ├── TileRenderer.tsx       # Center panel (current tile)
│   ├── ControlsPanel.tsx      # Right panel (actions)
│   ├── *Panel.tsx             # Feature-specific panels
│   └── index.ts               # Barrel exports
│
├── lib/                        # Business logic layer
│   ├── services/              # 29+ service modules
│   │   ├── playerService.ts
│   │   ├── battleService.ts
│   │   ├── clanService.ts
│   │   └── ...
│   ├── wmd/                   # WMD system services
│   │   ├── researchService.ts (650 lines)
│   │   ├── spyService.ts     (1,716 lines)
│   │   ├── missileService.ts
│   │   ├── defenseService.ts
│   │   └── ...
│   ├── db/                    # Database schemas
│   │   ├── schemas/
│   │   │   └── wmd.schema.ts  (812 lines, 12 collections)
│   │   └── seeds/
│   ├── mongodb.ts             # MongoDB connection singleton
│   ├── logger.ts              # Structured logging
│   └── index.ts               # Barrel exports
│
├── types/                      # TypeScript definitions
│   ├── game.types.ts          # Core game types
│   ├── wmd/                   # WMD type system (3,683 lines)
│   │   ├── missile.types.ts   (638 lines)
│   │   ├── defense.types.ts   (724 lines)
│   │   ├── intelligence.types.ts (912 lines)
│   │   ├── research.types.ts  (921 lines)
│   │   └── notification.types.ts (635 lines)
│   └── index.ts
│
├── dev/                        # Development tracking
│   ├── roadmap.md             # Vision & milestones
│   ├── architecture.md        # Technical details (2,097 lines)
│   ├── planned.md             # Future features
│   ├── progress.md            # Active work
│   ├── completed.md           # Done features
│   ├── metrics.md             # Velocity analytics
│   └── lessons-learned.md     # Insights captured
│
└── scripts/                    # Utility scripts
    └── initializeMap.ts       # Map generation (22,500 tiles)
```

---

## 🗄️ **Database Architecture**

### MongoDB Collections (14+)

**Core Game Collections:**
- `tiles` - 22,500 map tiles (150×150 grid)
- `players` - Player accounts with credentials & stats
- `battleLogs` - Combat history with detailed results
- `achievements` - Player achievement tracking
- `discoveries` - Ancient technology unlocks

**Social & Economy Collections:**
- `clans` - Clan data with levels & buffs
- `clan_members` - Clan membership with roles
- `clan_territories` - Territory control grid
- `clan_wars` - Active and historical clan wars
- `auctions` - Auction listings with bidding

**Automation & Monetization:**
- `vip_purchases` - VIP transaction history
- `auto_farm_settings` - Player automation configs

**WMD System Collections (12 - Phase 1):**
- `wmd_research` - Player tech tree progress
- `wmd_missiles` - Active missile inventory
- `wmd_defense` - Defense battery deployments
- `wmd_spies` - Intelligence network
- `wmd_missions` - Active spy missions
- `wmd_votes` - Clan voting records
- `wmd_notifications` - Event notifications
- `wmd_launch_cooldowns` - Attack rate limiting
- `wmd_sabotage_logs` - Sabotage history
- `wmd_intel_reports` - Gathered intelligence
- `wmd_retaliation_windows` - Counter-attack timing
- `wmd_consequences` - Global event tracking

### Index Strategy
- **Compound indexes** on all query patterns
- **Unique indexes** on usernames, emails, coordinates
- **Performance target:** <50ms at 95th percentile
- **Query optimization:** All critical paths use indexes (verified via MCP scan)

---

## 🔌 **API Architecture**

### API Route Categories (60+ endpoints)

**Authentication & Players:**
- `POST /api/register` - Create new account
- `POST /api/login` - Authenticate user
- `GET /api/player` - Get player data
- `GET /api/player/stats` - Player statistics

**Core Gameplay:**
- `POST /api/move` - Move player (9 directions)
- `POST /api/harvest` - Gather resources
- `GET /api/tile` - Current tile information
- `POST /api/cave/loot` - Explore caves

**Combat & Factories:**
- `POST /api/battle/attack` - Initiate combat
- `GET /api/battle/logs` - Combat history
- `POST /api/factory/attack` - Capture factory
- `POST /api/factory/upgrade` - Upgrade factory
- `POST /api/factory/build-unit` - Produce units

**Progression:**
- `POST /api/specialization/choose` - Select class
- `GET /api/specialization/mastery` - Mastery status (earned server-side: +10 per doctrine-matching unit build, +25 per battle won; direct POST is admin-only)
- `GET /api/achievements` - List achievements
- `POST /api/achievements/claim` - Claim rewards
- `GET /api/discoveries` - Technology unlocks

**Economy:**
- `POST /api/balance/deposit` - Bank resources
- `POST /api/balance/withdraw` - Withdraw resources
- `POST /api/auction/listings` - Create/browse auctions
- `POST /api/auction/bid` - Place bid

**Social:**
- `POST /api/clan/create` - Create clan
- `POST /api/clan/join` - Join clan
- `POST /api/clan/war/declare` - Declare war
- `POST /api/clan/territory/capture` - Capture territory

**Automation:**
- `POST /api/auto-farm/toggle` - Enable/disable
- `GET /api/auto-farm/stats` - View performance

**Monetization:**
- `POST /api/vip/purchase` - Buy VIP package
- `GET /api/vip/status` - Check VIP status

**WMD System (Phase 2 - Planned):**
- Research: 4 endpoints
- Missiles: 6 endpoints
- Defense: 5 endpoints
- Intelligence: 6 endpoints
- Voting: 4 endpoints
- Notifications: 1 endpoint

### Authentication Flow
```
Request → middleware.ts (JWT validation) → API Route → Service Layer → Database
```

---

## 🏗️ **Key Architectural Decisions**

### 1. **Service Layer Pattern**
**Decision:** All business logic in dedicated service modules  
**Rationale:** Clear separation, testability, reusability  
**Implementation:** 29 service files in `/lib`

### 2. **TypeScript Strict Mode**
**Decision:** TypeScript with strict mode enabled  
**Rationale:** Maximum type safety, fewer runtime errors  
**Result:** 0 TypeScript errors maintained throughout development

### 3. **Context API for State**
**Decision:** React Context instead of Redux  
**Rationale:** Project complexity doesn't justify Redux overhead  
**Implementation:** Single `GameContext` for global state

### 4. **Edge Runtime Middleware**
**Decision:** JWT auth in Edge Runtime  
**Rationale:** Performance benefits, modern deployment patterns  
**Trade-off:** bcrypt not available in Edge (API routes only)

### 5. **Modular Exports**
**Decision:** `index.ts` barrel exports in every folder  
**Rationale:** Clean imports, better code organization  
**Pattern:** `import { service } from '@/lib'` instead of deep paths

### 6. **MongoDB Connection Singleton**
**Decision:** Single connection pool via singleton pattern  
**Rationale:** Connection reuse, resource efficiency  
**Implementation:** `/lib/mongodb.ts` with lazy initialization

### 7. **12-Hour Resource Resets**
**Decision:** Split 24-hour harvesting into two 12-hour periods  
**Rationale:** Player engagement, twice-daily login incentive  
**Implementation:** Background job checks every 15 minutes

### 8. **Feature ID (FID) Tracking**
**Decision:** Unique timestamp-based IDs for all features  
**Rationale:** Cross-reference dependencies, clear history  
**Pattern:** `FID-YYYYMMDD-XXX` (e.g., FID-20251022-001)

---

## 🔒 **Security Architecture**

### Authentication System
- **JWT tokens** with jose library (Edge-compatible)
- **bcrypt password hashing** (cost factor 10)
- **HTTP-only cookies** for token storage
- **Middleware protection** on all game routes

### OWASP Top 10 Compliance
- **Input validation** on all user inputs
- **SQL injection prevention** via MongoDB driver (no raw queries)
- **XSS prevention** via React's built-in escaping
- **CSRF protection** via SameSite cookie attributes
- **Sensitive data exposure** prevented in logs

### Resource Security
- **Rate limiting** on critical endpoints (planned)
- **Attack cooldowns** prevent abuse (5 minutes)
- **Harvest validation** server-side timing checks
- **Factory ownership** validated before unit production

---

## 🚀 **Performance Optimizations**

### Database Performance
- **Compound indexes** on all query patterns
- **Query performance monitoring** (<50ms target)
- **Connection pooling** via MongoDB driver
- **Lean queries** for read-only operations

### Frontend Performance
- **React.memo** on expensive components (planned)
- **Code splitting** via Next.js dynamic imports
- **Image optimization** via Next.js Image component
- **Lazy loading** for panels and modals

### API Performance
- **Serverless functions** auto-scale
- **Edge middleware** for auth (low latency)
- **Efficient queries** minimize database round-trips
- **Caching strategy** (planned for Phase 5+)

---

## 📊 **Code Quality Metrics**

### Current Status
- **TypeScript Errors:** 0 (maintained throughout)
- **Lines of Code:** ~45,000+ production code
- **Files Created:** 150+ files
- **Test Coverage:** Manual validation (automated suite planned)
- **Documentation:** JSDoc on all public functions

### ECHO v5.1 Standards
- **Complete implementations** (no pseudo-code)
- **Modern syntax** (const/let, arrow functions, async/await)
- **Comprehensive docs** (OVERVIEW sections, inline comments)
- **Type safety** with runtime validation
- **Error handling** with user-friendly messages

---

## 🔄 **Development Workflow**

### Feature Development Process
1. **Planning** - Create FID, define acceptance criteria
2. **Implementation** - Follow ECHO v5.1 standards
3. **Documentation** - JSDoc + inline comments
4. **Testing** - Manual validation + TypeScript checks
5. **Tracking** - Update /dev files with metrics

### Quality Gates
- **Pre-flight:** Compliance check, context load, dependency analysis
- **Mid-flight:** Real-time standards monitoring
- **Post-flight:** Audit, lessons capture, metrics update

---

## 🎯 **WMD System Architecture** (Phase 1 Complete)

### Type System (3,683 lines)
- **missile.types.ts** - 5 warhead types, assembly mechanics
- **defense.types.ts** - 5 battery tiers, interception logic
- **intelligence.types.ts** - 10 mission types, sabotage engine
- **research.types.ts** - 30 techs, 3 tracks, prerequisites
- **notification.types.ts** - 19 event types, WebSocket patterns

### Service Layer (5,096 lines)
- **researchService.ts** (650 lines) - Tech tree, RP spending
- **spyService.ts** (1,716 lines) - Intel operations, sabotage
- **missileService.ts** (309 lines) - Assembly, launch
- **defenseService.ts** (326 lines) - Batteries, interception
- **clanVotingService.ts** (496 lines) - Democratic voting
- **clanTreasuryWMDService.ts** (495 lines) - Treasury integration
- **clanConsequencesService.ts** (503 lines) - Attack consequences

### Database Schema (1,577 lines)
- **12 collections** with JSON validation
- **60+ optimized indexes** for query performance
- **Complete field validation** and type enforcement

---

## 📚 **Related Documentation**

- **[README.md](README.md)** - Project overview
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development log & metrics
- **[ROADMAP.md](ROADMAP.md)** - Feature roadmap
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

---

*Last Updated: October 23, 2025*
