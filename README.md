# DarkFrame

> A persistent multiplayer tile-based strategy game — real-time combat, clan warfare, and a player-driven economy on a hostile 150×150 map.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle%20ORM-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-333%20passing-brightgreen)

**Status:** under active development (post-migration recovery). Systems are playable in dev; expect rough edges. Honest, per-session progress is tracked in [`SCOPE.md`](SCOPE.md) — no marketing numbers.

---

## What it is

DarkFrame drops every player onto a shared 22,500-tile map (150×150) with nine terrain types — metal and energy fields, caves, forests, factories, banks, shrines, auction houses, and wasteland. You gather resources, build units, claim ground, and fight for it:

- **8-directional movement** on a wrap-around grid (`QWEASDZXC`)
- **Combat** — factories, bases, flag warfare, and WMDs, with server-enforced position checks (you must physically be at a target to attack it)
- **Beer Bases** — roaming high-reward targets whose strength, army, and loot must be discovered organically: walk to a base to scan it
- **Clans** — hierarchy, treasury, alliances, territory income
- **Economy** — banking, resource trading, and an auction house
- **Progression** — XP/levels, research points, specializations, mastery, achievements, VIP tiers
- **Admin tooling** — player inspection, activity/session tracking, moderation (flags/bans), hotkey management

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 18, TypeScript strict |
| Server | Custom Node server (`server.ts`): Next + Socket.io (`/api/socketio`) + background jobs |
| Database | PostgreSQL via Drizzle ORM |
| Realtime | Socket.io (movement, chat, world events) |
| Auth | JWT sessions (`jose`), bcrypt password hashing |
| Payments | Stripe (subscriptions, VIP tiers) |
| Cache/rate-limit | Redis (optional; Upstash REST supported) |
| Testing | Vitest — 333 passing |
| Errors | Sentry |

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- (optional) Redis, Stripe CLI

### 1. Install & configure

```bash
git clone https://github.com/savant0x/DarkFrame.git
cd DarkFrame
npm install
```

Create `.env.local` (git-ignored; never commit real credentials):

```env
# Required
DATABASE_URL=postgresql://user:password@host:5432/darkframe
JWT_SECRET=change-me-to-a-long-random-string

# Owner account created by `npm run db:setup`
OWNER_USERNAME=yourname
OWNER_EMAIL=you@example.com
OWNER_PASSWORD=change-me

# Optional
PORT=3000                     # unset = 3000; PORT=0 currently binds a random port
REDIS_URL=redis://localhost:6379
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
LOG_LEVEL=info
```

### 2. Initialize the database

```bash
npm run db:setup
```

One stop: generates the 22,500-tile map (idempotent) and creates the owner/admin account from your `OWNER_*` vars.

### 3. Run it

```bash
npm run dev:server    # full game server: Next + Socket.io + background jobs
```

Then open `http://localhost:3000` and log in with the owner account.

> `npm run dev` starts Next.js only — fine for UI work, but no realtime or world jobs.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev:server` | Full game server (Next + Socket.io + jobs) |
| `npm run dev` | Next.js dev server only |
| `npm run db:setup` | Generate map + owner account (idempotent) |
| `npm run map:rebuild` | **Destructive** — wipe & regenerate the map (`--yes` required) |
| `npm run create-indexes` | Create DB performance indexes |
| `npm run test:ci` | Full test suite (Vitest) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript check |
| `npm run stripe:listen` | Stripe webhook forwarding (expects `C:\stripe\stripe.exe`) |
| `npm run validate-referrals` | Referral validation cron |

## Controls

Movement owns `QWEASDZXC` outright — those keys are reserved and never trigger anything else. Every other action has exactly one binding; panel toggles use `Shift` + key.

| Key | Action |
| --- | --- |
| `Q W E / A S D / Z X C` | Move (8 directions; `S` also stops) |
| `G` | Harvest metal/energy |
| `Shift+V` | Harvest cave/forest |
| `R` | Attack factory (must be standing on it) |
| `Shift+E` | Beer Bases panel |
| `B` / `N` / `U` | Bank / Shrine / Unit build (tile-gated) |
| `Shift+C` / `L` | Clan view / Clan leaderboards |
| `Shift+X` / `Shift+D` | Bot scanner / Discovery log |
| `I` / `Shift+P` | Inventory / Progression |

Full list (and rebinding) in-game via the admin Hotkey Manager; the binding rules live in `lib/hotkeyRegistry.ts`.

## Project layout

```
app/                 Next.js App Router — pages, 180+ API routes
components/          UI (game canvas, panels, admin modals)
lib/                 Game services (~90), DB schema (Drizzle), jobs, websocket
lib/db/migrations/   SQL migrations
types/               Shared TypeScript contracts
scripts/             Setup & maintenance utilities
docs/                Historical design docs
dev/                 Working notes: sessions, architecture, FIDs, protocol
SCOPE.md             Authoritative scope & audit trail (what/why/when of every change)
```

## Development notes

- **Project docs live in `dev/`.** Start with `dev/QUICK_START.md` (current gates) and `SCOPE.md` (decision log). Session-by-session records are in `dev/session-summaries/`.
- **Database:** Postgres is authoritative. Legacy Mongo/MySQL client libs remain in `package.json` from earlier pivots; a Mongo-style API shim (`lib/mongodb.ts`) bridges older service code to Postgres and is being retired incrementally.
- **Known rough edges** are tracked openly in `SCOPE.md` under `[OPEN-OUT-OF-SCOPE]` — nothing is silently broken.

## License

All rights reserved. No license granted — reuse requires permission.
