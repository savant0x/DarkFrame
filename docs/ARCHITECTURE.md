# 🏗️ DarkFrame - Technical Architecture

> System design, technology decisions, and implementation patterns.
> **Status (2026-09-16 audit):** current — Postgres/Drizzle throughout.

**Last Updated:** September 16, 2026
**System Status:** Live — Postgres-backed persistent world, all gates green
**Code Volume:** 865 tests passing; 235 API routes; 116 lib modules

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
│   DATA LAYER (PostgreSQL via Drizzle)     │
│  60+ Tables + Migrations                  │
└─────────────────────────────────────────┘
```
(CUSTOM Node server hosts Next.js + Socket.io + scheduled jobs in one
process; Vercel serverless for routes. The Mongo era is fully retired —
2026-09-19 — and a pre-push gate blocks any reintroduction.)

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
- **Development System:** ECHO protocol (FID-tracked, gated changes)
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
├── lib/                        # Business logic layer (~116 modules)
│   ├── battleService.ts, clanService.ts, ...  # Flat service modules
│   ├── wmd/                   # WMD system services (research, missile,
│   │                          # defense, spy, sabotage, treasury, …)
│   ├── db/                    # Drizzle schema (17 table modules) + connection
│   ├── logger.ts              # Structured logging
│   └── index.ts               # Barrel exports
│
├── types/                      # TypeScript definitions
│   ├── game.types.ts          # Core game types
│   ├── wmd/                   # WMD types (research single-track, missile,
│   │                          # defense, intelligence, notification)
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

### Postgres Tables (60+, Drizzle ORM)

Schema lives in `lib/db/schema/` (one module per domain: `players`,
`tiles`, `factories`, `clans`, `messages`, `referrals`, `tutorial`, `wmd`,
…). Connection in `lib/db/connection.ts` (Drizzle over `pg` Pool,
fail-fast on missing `DATABASE_URL`). Migrations under `drizzle/`.

**Core domains:**
- World & players: tiles (22,500 map tiles, 150×150 grid), players,
  factories, battle logs, achievements
- Social & economy: clans (+ members, territories, wars, bank, chat),
  auctions, referrals, messages/conversations
- Systems: tutorial progress/action tracking, WMD research/missiles/
  defense/spies, VIP/subscriptions, moderation, notifications

### Index Strategy
- **Compound indexes** on all query patterns (declared in migrations)
- **Unique indexes** on usernames, emails, coordinates
- **Performance target:** <50ms at 95th percentile

---

## 🔌 **API Architecture**

### API Route Categories (235 routes — category prefixes, not an
exhaustive list; see `app/api/` for the full tree)

**Authentication & Players:**
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Authenticate user
- `GET /api/player` - Get player data

**Core Gameplay:**
- `POST /api/move` - Move player (9 directions)
- `POST /api/harvest` - Gather resources
- `GET /api/tile` - Current tile information

**Combat & Factories:**
- `POST /api/battle/attack` - Initiate combat
- `POST /api/factory/build-unit` - Produce units

**Progression:**
- `POST /api/specialization/choose` - Select class
- `GET /api/specialization/mastery` - Mastery status (earned server-side: +10 per doctrine-matching unit build, +25 per battle won; direct POST is admin-only)

**Social & Economy:**
- `POST /api/clan/create` - Create clan
- `POST /api/clan/join` - Join clan
- Auction, bank, referral, messaging, and tutorial routes follow the same
  `app/api/<domain>/...` layout (see the category directories in `app/api/`)

**WMD System (live):**
- 7 route files under `app/api/wmd/` covering research, missiles, defense,
  and intelligence (single-track W1 system, not the old 3-track plan)

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

### 6. **Postgres Connection via Drizzle**
**Decision:** Single shared `pg` Pool behind the Drizzle client  
**Rationale:** Connection reuse, resource efficiency  
**Implementation:** `lib/db/connection.ts` (lazy Pool, fail-fast without
`DATABASE_URL`). The former Mongo compat shim was removed 2026-09-19 —
direct drizzle/pg access everywhere.

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
- **SQL injection prevention** via Drizzle parameterized queries (no raw
  string-interpolated SQL in routes)
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
- **Connection pooling** via shared `pg` Pool (`lib/db/connection.ts`)

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
- **TypeScript Errors:** 0 (`npx tsc --noEmit`)
- **Lint:** 0 (`npm run lint`)
- **Tests:** 865 passing, 1 skipped (`npx vitest run`)
- **Build:** clean (`npm run build`)
- **Documentation:** JSDoc on all public functions

### ECHO Standards
- **Complete implementations** (no pseudo-code)
- **Modern syntax** (const/let, arrow functions, async/await)
- **Comprehensive docs** (OVERVIEW sections, inline comments)
- **Type safety** with runtime validation
- **Error handling** with user-friendly messages

---

## 🔄 **Development Workflow**

### Feature Development Process
1. **Plan** - Open a FID in `dev/fids/`, define acceptance criteria
2. **Implement** - Follow the repo's coding standards
3. **Document** - JSDoc + inline comments
4. **Verify** - `npx tsc --noEmit`, `npm run lint`, `npx vitest run`
   (plus `npm run build` for build-affecting changes)
5. **Track** - Update SCOPE.md and CHANGELOG.md

### Quality Gates
- **Pre-commit:** hook runs the gate suite (see `.githooks/`)
- **No broken builds:** zero errors, zero warnings before push

---

## 🎯 **WMD System Architecture** (W1 single track, live)

### Research Track (600k RP total, 10 tiers)
- **Definition:** `types/wmd/research.types.ts` — `WMD_RESEARCH_TRACK`,
  `TOTAL_RP_REQUIRED` (sums the tier `rpCost` values), missile / defense /
  intelligence domains as categories of the one track
- **Service:** `lib/wmd/researchService.ts` — tech unlocks, RP spending via
  `spendResearchPoints`

### Service Layer
- **missileService.ts** — assembly, launch
- **defenseService.ts** — batteries, interception
- **spyService.ts** — intel operations, sabotage
- **sabotageEngine.ts, damageCalculator.ts, targetingValidator.ts** —
  combat math and eligibility
- **clanVotingService.ts, clanTreasuryWMDService.ts,
  clanConsequencesService.ts** — clan integration

### Database Schema
- WMD tables in `lib/db/schema/wmd.ts`, migrated under `drizzle/`

---

## 📚 **Related Documentation**

- **[README.md](../README.md)** - Project overview
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history
- **[SCOPE.md](../SCOPE.md)** - Scope ledger
- **[RP_ECONOMY_GUIDE.md](RP_ECONOMY_GUIDE.md)** - RP economy v2

---

*Last Updated: September 16, 2026*
