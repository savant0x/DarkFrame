# DarkFrame — Technical Architecture

> System design, technology stack, database architecture, and implementation patterns

**Last Updated:** 2026-05-06
**Stack:** Next.js 16.3, Supabase PostgreSQL, TypeScript 5.7 (strict)
**Scale:** 610+ TypeScript files, 184 API routes, 144+ components, 0 TypeScript errors
**Status:** Economy Rebalance Planning Complete — 4-phase implementation ready

---

## System Architecture

DarkFrame follows a **three-tier architecture** with Supabase as the backend foundation:

```
┌──────────────────────────────────────────────┐
│     PRESENTATION LAYER (React 18 / Next.js)   │
│    144 Components + 3 Context Providers       │
│    GameContext, WebSocketContext, ChatPanel   │
└──────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│    APPLICATION LAYER (Next.js API Routes)     │
│    184 Endpoints + 30+ Service Modules        │
│    Zod validation, structured logging, rate   │
│    limiting                                    │
└──────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│      DATA LAYER (Supabase PostgreSQL)         │
│    52 Tables + 35 Enums + 80+ Indexes         │
│    Row-Level Security, Auth, Migrations       │
└──────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.3.0-canary.9 | App Router, API routes, SSR |
| React | 18.3.1 | Component library |
| TypeScript | 5.7 (strict) | Type safety, 0 errors |
| Tailwind CSS | 3.4.1 | Utility-first styling, dark theme |
| Lucide React | 0.546 | Icon library |
| Framer Motion | 12.23 | Animations |
| Recharts | 3.3 | Admin dashboard charts |
| Pixi.js | 8.14 | Map renderer (GridRenderer) |
| Tiptap | 3.7 | Rich text editor |
| DOM Purify | 3.3 | XSS sanitization |
| Sonner | 2.0 | Toast notifications |
| React Hot Toast | 2.6 | Toast service (WMD panels, referrals) |
| Canvas Confetti | 1.9 | Celebration animations |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Next.js API Routes | 16.3 | 184 REST endpoints |
| Supabase | PostgreSQL | Database, auth, RLS, migrations |
| `@supabase/ssr` | 0.10.2 | Cookie-based session management |
| `@supabase/supabase-js` | 2.105.3 | JavaScript client |
| Zod | 4.1 | Request validation |
| Stripe | 19.1 | VIP subscription payments |
| ioredis | 5.8 | Redis caching + rate limiting |
| Socket.io | 4.8 | WebSocket (background jobs) |
| Jose | 6.1 | JWT verification (WebSocket auth) |
| bad-words | 4.0 | Chat profanity filter |
| date-fns | 4.1 | Date manipulation |

### Development Tools

| Technology | Purpose |
|---|---|
| ESLint 8 + Next.js config | Code linting |
| Vitest 4.0 | Unit + component testing |
| Testing Library 16.3 | React component testing |
| tsx 4.21 | TypeScript script runner |
| dotenv 17.2 | Environment variable loading |

---

## Database Architecture

### Supabase PostgreSQL (52 tables)

**Core Game Tables:**
- `players` — Player accounts, resources, stats, progression (primary table)
- `tiles` — 22,500 map tiles (150×150 grid) with terrain, ownership, cooldowns
- `player_units` — Combat units per player
- `factories` — Factory buildings on the map
- `player_inventory` — Inventory items per player
- `player_shrine_boosts` — Active shrine buffs
- `player_level_history` — Level progression tracking

**Social & Clan Tables:**
- `clans` — Clan data, levels, tags
- `clan_members` — Membership with roles
- `clan_alliances` — Alliance relationships
- `friends` — Accepted friendships
- `friend_requests` — Pending requests
- `blocked_users` — Block lists
- `conversations` — DM conversations
- `messages` — Direct messages

**Combat & Warfare Tables:**
- `battle_logs` — Combat history
- `daily_bounties` — PvP contracts
- `flags` — Flag bearer state
- `bot_magnet_beacons` — Bot attraction zones
- `concentration_zones` — Bot spawn zones

**WMD System Tables:**
- `wmd_player_research` — Tech tree progress
- `wmd_missiles` — Missile inventory
- `wmd_defense_batteries` — Defense systems
- `wmd_spies` — Intelligence network
- `wmd_clan_votes` — Clan voting
- `wmd_notifications` — Event notifications

**Economy Tables:**
- `auction_listings` — Auction house
- `daily_harvest_progress` — Tile cooldowns

**Chat Tables:**
- `chat_messages` — Global/clan/trade chat
- `chat_channels` — Channel configuration

### Key Design Decisions

- **Snake_case columns** — All database columns use snake_case. TypeScript types use camelCase. Mapping happens at API boundary.
- **JSONB for complex data** — Player config, bot config, daily bounties, concentration zones use PostgreSQL JSONB. Parsed via type-safe `lib/supabase/jsonb.ts` accessors.
- **Row-Level Security** — Supabase RLS policies protect all tables.
- **Supabase Auth** — Email/password auth managed by Supabase. Session cookies via `@supabase/ssr`.
- **16 migrations** — All schema changes tracked in `supabase/migrations/`.

---

## Auth Architecture

### Cookie-Based Supabase SSR

```
Browser                      Next.js Server                 Supabase
   │                              │                              │
   │ POST /api/auth/login         │                              │
   │ { email, password }          │                              │
   │ ─────────────────────────▶   │                              │
   │                              │ supabase.auth.signInWithPassword()
   │                              │ ─────────────────────────────▶
   │                              │                              │
   │                              │ ◀─ session + access_token ───│
   │                              │                              │
   │ ◀── Set-Cookie: sb-xxx-token │                              │
   │                              │                              │
   │ GET /api/player/stats        │                              │
   │ Cookie: sb-xxx-token         │                              │
   │ ─────────────────────────▶   │                              │
   │                              │ createServerClient() reads   │
   │                              │ cookie → supabase.auth.getUser()
   │                              │ ─────────────────────────────▶
   │                              │                              │
   │                              │ ◀─ user confirmed ───────────│
   │                              │                              │
   │ ◀── { success, data } ────── │                              │
```

### Auth Middleware Files

| File | Function | Client Type |
|---|---|---|
| `lib/authMiddleware.ts` | `resolveAuth()`, `getAuthenticatedUser()`, `requireAuth()` | `createServerClient()` (reads cookies) |
| `lib/wmd/apiHelpers.ts` | `verifyAuth()`, `getAuthenticatedPlayer()` | `createServerClient()` (reads cookies) |

All auth middleware uses `createServerClient()` which reads Supabase SSR session cookies. The `createServiceClient()` bypasses auth and is only used for internal operations (flag updates, background jobs).

---

## API Architecture

### Convention

All 184 routes follow:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```

### Route Categories

| Category | Count | Example Routes |
|---|---|---|
| Auth | 4 | login, register, logout, session |
| Player | 10 | data, stats, inventory, profile, build-unit, upgrade-base |
| Movement & Map | 4 | move, tile, tile/nearby, tutorial |
| Harvest | 1 | harvest (metal/energy/cave/forest) |
| Combat | 6 | attack/unit, attack/base, attack/factory, battle-log, flag, bounty-board |
| Clan | 15 | create, join, leave, invite, kick, promote, alliance, chat, bank, warfare |
| Chat | 4 | channels, messages, typing, heartbeat |
| Friends | 6 | requests, accept, list, remove, block, search |
| Messages | 4 | conversations, messages, send, read |
| Economy | 8 | bank/deposit, bank/withdraw, bank/loan, auction/listings, auction/create, auction/bid, shrine, shop |
| WMD | 12 | status, research, missiles, defense, intelligence, spies, voting, notifications |
| Factory | 4 | build-unit, upgrade, status, management |
| Admin | 8 | users, ban, stats, hotkeys, moderation, clan-inspect |
| Stripe | 3 | checkout, webhook, prices |
| Bot | 4 | scanner, magnet, summon, concentration-zone |
| Leaderboard | 1 | rankings |
| Referral | 3 | link, validate, dashboard |
| Tutorial | 1 | progress tracking |

### Request Validation

All request bodies validated with Zod schemas:
```typescript
const MoveSchema = z.object({
  username: z.string().min(1).max(30),
  direction: z.enum(['N','NE','E','SE','S','SW','W','NW']),
});
```

### Rate Limiting

Per-endpoint rate limits configured in `lib/rateLimiter.ts`:
- Movement: 5 req/s
- Harvest: 2 req/s
- Chat: 3 req/s
- Standard: 10 req/s

---

## Frontend Architecture

### Context Providers

```
<RootLayout>
  ├── <WebSocketProvider>
  │   └── <GameProvider>
  │       └── <ChatPanelProvider>
  │           └── <GameLayout>
  │               ├── StatsPanel (left)
  │               ├── TileRenderer (center)
  │               ├── ControlsPanel (right)
  │               └── ChatPanel (bottom-left overlay)
```

### GameContext (`context/GameContext.tsx`)

Central state management for:
- `player` — Current player data (from `/api/player`)
- `currentTile` — Current map tile (from `/api/tile`)
- `movePlayer(direction)` — Movement via `/api/move`
- `refreshPlayer()` — Lightweight player refresh
- `loadPlayerData(username)` — Full player load with throttling
- `updateTileOnly(x, y)` — Tile-only update for autofarm

### WebSocket Context (`context/WebSocketContext.tsx`)

Socket.io client with:
- Max 1 retry attempt (prevents reconnection spam)
- Silent timeout/error handling
- Used for real-time event delivery (background jobs, chat polling already HTTP-based)

### Component Organization

```
components/
├── ui/                    # Design system primitives (Panel, Button, Input, Badge, ...)
├── chat/                  # ChatPanel, ChatMessage, DM system
├── clan/                  # Clan management panels
├── friends/               # Friends list, requests, modals
├── messaging/             # Message inbox, threads
├── tutorial/              # Interactive tutorial system
├── admin/                 # Admin dashboard components
├── GameLayout.tsx         # Three-panel game layout
├── StatsPanel.tsx         # Player info, military, harvest calculator
├── TileRenderer.tsx       # Map tile rendering
├── ControlsPanel.tsx      # Movement + action controls
└── TopNavBar.tsx          # Top navigation bar
```

---

## Service Layer

Service modules reside in `lib/` and handle all business logic:

### Core Services
- `playerService.ts` — Player CRUD, stats, progression
- `movementService.ts` — Map movement, edge wrapping, tile lookups
- `harvestService.ts` — Resource gathering, cooldowns, bonuses
- `factoryService.ts` — Factory creation, upgrade, unit production
- `battleService.ts` — Combat resolution, damage calculation
- `clanService.ts` — Clan creation, membership, roles

### WMD Services
- `lib/wmd/researchService.ts`
- `lib/wmd/missileService.ts`
- `lib/wmd/defenseService.ts`
- `lib/wmd/spyService.ts`
- `lib/wmd/votingService.ts`

### Supabase Integration
- `lib/supabase/client.ts` — Browser client (anon key)
- `lib/supabase/server.ts` — `createServiceClient()` + `createServerClient()`
- `lib/supabase/jsonb.ts` — Type-safe JSONB accessors:
  - `parseJsonRecord`, `parseJsonArray`, `parseJsonString`, `parseJsonNumber`, `parseJsonBoolean`
  - `parseBotMigrationConfig`, `parseFlagBotConfig`

### Utilities
- `lib/logger.ts` — Structured logging with ISO timestamps
- `lib/authMiddleware.ts` — Cookie-based Supabase SSR auth
- `lib/rateLimiter.ts` — Per-endpoint rate limiting
- `lib/toast.ts` — Toast notification wrapper
- `lib/antiCheatDetector.ts` — Speed hack detection
- `lib/sessionTracker.ts` — Player session tracking
- `lib/activityLogger.ts` — Player activity logging

---

## Game Mechanics Architecture

### Map System
- 150×150 grid = 22,500 tiles
- 5 terrain types with weighted distribution
- Edge wrap-around (position 151 → 1, 0 → 150)
- Special locations: Shrine (1,1), Metal Bank (25,25), Energy Bank (75,75), Exchange Banks (50,50)(100,100), Auction House (10,10)
- Tile cooldowns: 5 minutes after harvest (AM/PM reset based on X coordinate)

### Movement
- 9-directional (QWEASDZXC keyboard layout)
- Cardinal directions: N, NE, E, SE, S, SW, W, NW
- Edge wrap-around on all directions

### Combat
- Unit-based: attack/defense stats per unit type
- Base attacks: strategic warfare with defense systems
- Factory takeovers: capture opponent production
- Flag bearer PvP: attack the player holding the flag

### Progression
- XP from actions (harvest, combat, exploration)
- Level system with research point rewards
- Tech tree unlocks (bot-hunter, bot-magnet, concentration-zones)
- Specialization doctrines at Level 15 (Hoarder, Fortress, Raider, Balanced, Ghost)
- Achievements system (40+ achievements)

---

## File Statistics

| Metric | Count |
|---|---|
| TypeScript/TSX source files | 610 |
| API routes | 184 |
| React components | 144 |
| Service modules | 30+ |
| TypeScript lines (game.types.ts) | 2,356 |
| Supabase migrations | 16 |
| Supabase tables | 52 |
| Package dependencies | 49 prod + 13 dev = 62 |

---

## Key Design Decisions

1. **Supabase over MongoDB** — PostgreSQL with built-in auth, RLS, and migrations. Eliminates connection pooling overhead.
2. **`createServerClient()` for auth** — All middleware reads Supabase SSR cookies. `createServiceClient()` only for internal operations.
3. **`{ success, data }` response convention** — Consistent across all 184 API routes.
4. **JSONB accessor library** — Type-safe parsing eliminates inline `as any` casts.
5. **Snake_case → camelCase at boundary** — Database uses snake_case. TypeScript uses camelCase. Mapping at API response layer.
6. **0 `as any` in production** — 200+ instances eliminated. Remaining casts are documented framework limitations.
