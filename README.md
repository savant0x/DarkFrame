# DarkFrame  v0.2.0

**Persist. Conquer. Dominate.**

A production-grade, full-stack persistent multiplayer strategy game — 150×150 tile-based map, real-time combat, clan warfare, WMD systems, and a comprehensive economic engine. Built with Next.js 16, Supabase, and TypeScript.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-%23000000?style=flat-square&logo=nextdotjs&logoColor=%2300fbff)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-%23000000?style=flat-square&logo=supabase&logoColor=%2300fbff)](https://supabase.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-%23000000?style=flat-square&logo=tailwindcss&logoColor=%2300fbff)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](./LICENSE)

**Production Pass:** 0 TypeScript errors. 200+ `as any` eliminated. 16 Supabase migrations. Full auth migration (MongoDB → Supabase SSR). 22,500 tiles seeded with terrain distribution.

---

## Overview

DarkFrame is a persistent multiplayer online strategy game combining deep tactical combat, resource economics, clan politics, and social features across a living 150×150 tile map.

- **Persistent World** — 22,500 tiles, 5 terrain types (Metal, Energy, Cave, Factory, Wasteland), with special locations (Shrine, Banks, Exchange, Auction House)
- **9-Directional Movement** — QWEASDZXC keyboard controls with edge wrap-around
- **Real-Time Combat** — Unit-based attacks, base sieges, factory takeovers, flag bearer PvP, bot ecosystem
- **Clan Warfare** — Hierarchical clans with alliances, shared treasury, WMD systems, and voting
- **Full Economy** — Banking (deposits, loans, interest), Auction House, Shrine trading, resource market
- **Social Layer** — Global/clan/trade chat, private messaging, friends system, referrals
- **Premium Features** — VIP subscriptions (Stripe), auto-farm engine, bot summoning, concentration zones
- **Admin Dashboard** — Player moderation, game monitoring, hotkey configuration

**610 TypeScript files. 184 API routes. 144 React components. 0 TypeScript errors.**

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Supabase** account (free tier works)
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/fame0528/DarkFrame.git
cd DarkFrame
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Initialize Database

```bash
# Push Supabase migrations (creates tables, indexes, RLS)
npx supabase db push

# Seed the map (22,500 tiles)
npx tsx scripts/map/seed-tiles.ts
```

### 4. Start Dev Server

```bash
npm run dev
# → http://localhost:3000
```

### 5. Create Admin Account

```bash
npx tsx scripts/admin/create-admin.ts
```

---

## Architecture

```
Browser (Client)
    │
    ├─ Next.js 16.3 App Router (Turbopack)
    │   ├─ React Context (GameState, WebSocket)
    │   ├─ Components (StatsPanel, TileRenderer, ChatPanel, ...)
    │   └─ Hooks (usePolling, useCountUp, useGameContext, ...)
    │
    ├─ API Routes (184 endpoints)
    │   ├─ Auth (Supabase SSR cookie-based)
    │   ├─ Player (movement, stats, inventory, ...)
    │   ├─ Clan (create, join, alliance, chat, ...)
    │   ├─ Combat (attack, battle logs, flag bearer, ...)
    │   ├─ Economy (bank, auction, harvest, shrine, ...)
    │   ├─ WMD (research, missiles, defense, spies, ...)
    │   ├─ Admin (users, bans, hotkeys, moderation)
    │   └─ Stripe (checkout, webhooks, subscriptions)
    │
    └─ Supabase Backend
        ├─ PostgreSQL (players, tiles, clans, messages, ...)
        ├─ Auth (email/password, SSR cookies)
        ├─ RLS (row-level security)
        └─ Migrations (16 schema files)
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16.3, React 19, Tailwind 4 | Game UI, routing, server components |
| **Language** | TypeScript 5.7 (strict) | Type safety, 0 errors |
| **Database** | Supabase (PostgreSQL) | Auth, data, RLS, migrations |
| **Auth** | Supabase SSR (`@supabase/ssr`) | Cookie-based session management |
| **Styling** | Tailwind CSS 4, Lucide Icons | Design system, dark theme |
| **Chat** | HTTP Polling (global/clan/trade) | Real-time messaging |
| **Payments** | Stripe | VIP subscriptions |
| **Validation** | Zod | Request body validation |
| **Testing** | Vitest, React Testing Library | Unit + component tests |
| **Linting** | ESLint 9, Prettier | Code quality |

---

## Project Structure

```
DarkFrame/
├── app/                          # Next.js App Router
│   ├── api/                      # 184 REST endpoints
│   │   ├── auth/                 # Login, register, session, logout
│   │   ├── move/                 # Player movement
│   │   ├── player/               # Data, stats, inventory, profile
│   │   ├── clan/                 # Create, join, alliance, chat
│   │   ├── combat/               # Attack, battle logs, flag
│   │   ├── wmd/                  # Research, missiles, defense, spies
│   │   ├── bank/                 # Deposits, withdrawals, loans
│   │   ├── auction/              # Listings, bids, settlements
│   │   ├── chat/                 # Global/clan/trade channels
│   │   ├── admin/                # Users, bans, hotkeys, moderation
│   │   └── stripe/               # Checkout, webhooks, prices
│   ├── game/                     # Main game page + sub-pages
│   ├── profile/                  # Player profile page
│   ├── admin/                    # Admin dashboard
│   └── layout.tsx                # Root layout
│
├── components/                   # 144 React components
│   ├── ui/                       # Design system primitives
│   ├── chat/                     # ChatPanel, ChatMessage, DM system
│   ├── clan/                     # Clan UI components
│   ├── friends/                  # Friends list, requests, modals
│   ├── messaging/                # Message inbox, threads
│   ├── tutorial/                 # Interactive tutorial system
│   └── StatsPanel.tsx            # Player info + military + harvest
│
├── lib/                          # Business logic & services
│   ├── supabase/                 # Supabase clients, JSONB helpers
│   ├── authMiddleware.ts         # Cookie-based auth (SSR)
│   ├── services/                 # 30+ service modules
│   ├── wmd/                      # WMD system logic + jobs
│   ├── errors/                   # Error codes, response helpers
│   └── logger.ts                 # Structured logging
│
├── context/                      # React Context providers
│   ├── GameContext.tsx            # Player, tile, movement state
│   ├── WebSocketContext.tsx       # WebSocket connection
│   └── ChatPanelContext.tsx       # Chat panel sizing
│
├── types/                        # TypeScript definitions
│   ├── game.types.ts             # 2,300+ lines of core types
│   ├── database.ts               # Supabase-generated types
│   ├── autoFarm.types.ts         # Auto-farm engine types
│   └── ...                       # Domain-specific types
│
├── hooks/                        # Custom React hooks
│   ├── usePolling.ts             # HTTP polling hook
│   ├── useCountUp.ts             # Animated counter
│   └── useIsMobile.ts            # Responsive detection
│
├── supabase/                     # Supabase configuration
│   └── migrations/               # 16 migration files
│
├── scripts/                      # Utility scripts (organized by domain)
│   ├── admin/                    # create-admin, check-user, etc.
│   ├── db/                       # DB cleanup, indexes, validation
│   ├── map/                      # Map generation and seeding
│   ├── migration/                # Data migration scripts
│   ├── dev/                      # Dev server, setup, archiving
│   ├── test/                     # Verification and test scripts
│   └── archive/                  # Archived one-off scripts
│
├── docs/                         # 10 essential reference docs
│   ├── ARCHITECTURE.md           # System architecture
│   ├── DEVELOPMENT.md            # Development guide
│   ├── TESTING.md                # Testing guidelines
│   ├── archive/                  # 35 archived historical docs
│   └── ...
│
├── dev/                          # Development tracking (ECHO)
│   ├── QUICK_START.md            # Session recovery
│   ├── completed.md              # Completed features
│   ├── planned.md                # Feature backlog
│   ├── fids/                     # FID design documents
│   └── archive/                  # Historical session records
│
├── public/                       # Static assets
│   └── assets/                   # Tile images, bases, factories, units
│
├── proxy.ts                      # Next.js 16.3+ middleware replacement
├── kilo.json                     # Kilo configuration
├── package.json                  # 66 dependencies
└── tsconfig.json                 # TypeScript strict mode
```

---

## Features

### Core Gameplay
- 150×150 persistent tile map with edge wrap-around
- 5 terrain types: Metal (20%), Energy (20%), Cave (10%), Factory (10%), Wasteland (40%)
- 9-directional movement (QWEASDZXC) with keyboard controls
- Resource gathering, banking (deposit/withdraw/loans), and trading
- Upgradeable player bases with 10 rank tiers
- Factory system with sequential slot production
- Auto-farm engine for automated resource harvesting

### Combat & Strategy
- Unit combat with attack/defense stats
- Base attacks, sieges, and factory takeovers
- Flag bearer PvP system
- WMD systems: research, missiles, defense batteries, spy missions
- Bot ecosystem: scanning, magnet beacons, concentration zones, summoning
- Battle logs with comprehensive combat history
- Bounty board: player-vs-player contracts

### Clans & Social
- Clan creation with hierarchical roles (Leader, Co-Leader, Officer, Member)
- Clan alliances and diplomacy
- Shared clan treasury and resource pooling
- Clan chat with real-time messaging
- Friends system with online status and private messaging
- Global/trade/help/newbie/VIP chat channels

### Economy
- Banking with deposits, withdrawals, and interest-bearing loans
- Auction house with listings, bidding, and settlement
- Shrine boost system with tiered buffs
- Resource trading and market exchange
- Premium currency (diamonds) and VIP subscriptions

### Progression
- XP/level system with research points
- 40+ achievements with resource rewards
- Tech tree unlocks and specialization doctrines (Level 15+)
- Leaderboards by score, resources, and clan power
- Referral system with milestone rewards

---

## Development

```bash
# Start dev server
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Database
npx supabase db push          # Push migrations
npx supabase migration new    # Create migration

# Scripts
npx tsx scripts/map/seed-tiles.ts          # Seed map
npx tsx scripts/admin/create-admin.ts       # Create admin
npx tsx scripts/db/createIndexes.ts         # Create indexes
```

---

## API Convention

All API routes follow the `{ success, data }` response convention:

```json
{
  "success": true,
  "data": {
    "player": { "username": "fame", "level": 1, "currentPosition": { "x": 50, "y": 150 } },
    "currentTile": { "x": 50, "y": 150, "terrain": "Energy" }
  }
}
```

Errors return `{ success: false, error: "message" }` with appropriate HTTP status codes.

---

## Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — System architecture and design patterns
- **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** — Development workflow and guidelines
- **[TESTING.md](./docs/TESTING.md)** — Testing strategy and guidelines
- **[MESSAGING_SYSTEM.md](./docs/MESSAGING_SYSTEM.md)** — Messaging architecture
- **[REFERRAL_SYSTEM_GUIDE.md](./docs/REFERRAL_SYSTEM_GUIDE.md)** — Referral system implementation
- **[TUTORIAL_SYSTEM.md](./docs/TUTORIAL_SYSTEM.md)** — Tutorial framework
- **[ASSET_STORAGE_GUIDE.md](./docs/ASSET_STORAGE_GUIDE.md)** — Asset management
- **[REDIS_SETUP.md](./docs/REDIS_SETUP.md)** — Redis configuration
- **[STRIPE_LOCAL_TESTING.md](./docs/STRIPE_LOCAL_TESTING.md)** — Stripe test setup
- **[QUICK_IMAGE_GUIDE.md](./docs/QUICK_IMAGE_GUIDE.md)** — Image optimization

---

## Key Decisions

- **Supabase over MongoDB** — PostgreSQL with built-in auth, RLS, and migrations. Eliminates connection pooling overhead and NextAuth complexity.
- **Supabase SSR (`@supabase/ssr`)** — Cookie-based session management. All auth middleware uses `createServerClient()` (reads cookies), not `createServiceClient()` (bypasses auth).
- **`{ success, data }` convention** — Consistent across all 184 API routes. Client code uses meaningful variable names (`moveResult.data.player`) not `data.data`.
- **JSONB accessor library** — `lib/supabase/jsonb.ts` provides type-safe parsers for all PostgreSQL JSONB columns. Zero inline `as any` casts.
- **Snake_case database, camelCase TypeScript** — Map generation outputs snake_case directly. API routes map to camelCase at the boundary.
- **0 `as any` in production** — 200+ instances eliminated. Remaining casts are documented framework limitations.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/name`
3. Make changes following code quality standards
4. Run `npx tsc --noEmit` (must be 0 errors)
5. Run `npm test` (all tests pass)
6. Commit with conventional commits
7. Push and open a Pull Request

### Code Quality Standards

- **TypeScript strict mode**, 0 compilation errors
- **No `as any`** in production code
- **JSDoc** on all exported functions
- **API convention**: `{ success, data }` or `{ success: false, error }`
- **Structured logging** via `lib/logger.ts`
- **Zod validation** for all request bodies

---

## License

MIT License — See [LICENSE](./LICENSE) for details.

---

<div align="center">

**Built with TypeScript, Next.js 16, Supabase, and Tailwind CSS**

[Report Bug](https://github.com/fame0528/DarkFrame/issues) · [Request Feature](https://github.com/fame0528/DarkFrame/issues) · [Documentation](./docs)

</div>

**DarkFrame** • 2026
