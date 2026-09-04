<div align="center">

<img src="public/assets/banner.jpg" alt="DarkFrame" width="100%"/>

# ⚔️ DARKFRAME

### *A persistent multiplayer tile-based strategy game*

Real-time combat · Clan warfare · Player-driven economy · One hostile 150×150 world

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://orm.drizzle.team/)
[![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-white?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Tests](https://img.shields.io/badge/Vitest-333_passing-6DA55F?style=for-the-badge&logo=vitest&logoColor=white)](#-development)

[About](#-the-world) · [Quick Start](#-quick-start) · [Systems](#-core-systems) · [Controls](#-controls) · [Development](#-development) · [Status](#-status)

</div>

<br/>

---

## 🌍 The World

DarkFrame drops every player onto a shared **22,500-tile map** — nine terrain types, no instancing, no safe zones. Gather metal and energy by day, defend what you've built by night, and remember one rule of the wasteland: **if you can reach it, you can lose it.**

<div align="center">

| 🗺️ | 🎮 | ⚔️ | 🏰 |
|:---:|:---:|:---:|:---:|
| **150 × 150 persistent world** | **8-direction movement** | **Server-enforced combat** | **Clans & alliances** |
| 22,500 tiles · 9 terrain types · edge wrap-around | `QWEASDZXC` grid movement · reserved keys · zero misclicks | position-checked attacks · factories · flag warfare · WMDs | treasury · territory income · diplomacy |

</div>

---

## ✨ Core Systems

| | System | What it does |
|:---:|---|---|
| ⛏️ | **Gathering** | Harvest metal & energy fields; auto-farm with live telemetry |
| 🏭 | **Factories** | Produce units through sequential build slots |
| 🍺 | **Beer Bases** | Roaming high-reward targets. Their army, strength, and loot are **hidden until you walk up and scan them** — intel is earned, not given |
| 🚩 | **Flag Warfare** | Capture and move the flag; bots contest it around the clock |
| ☢️ | **WMDs** | Strategic weapons for clan-scale warfare |
| 🏦 | **Banking** | Deposits, loans, interest — the economy has a spine |
| 🔨 | **Auction House** | Player-to-player trading with fee economics |
| 🎓 | **Progression** | XP levels · research points · doctrine specializations · mastery · achievements · VIP tiers |
| 💬 | **Social** | Global & clan chat, friends, DMs, bounties, referrals |
| 🛡️ | **Moderation** | Player inspection, session/activity tracking, flags & bans |

---

## 🚀 Quick Start

### Prerequisites

`Node.js 20+` · `PostgreSQL 14+` · *(optional)* Redis, Stripe CLI

### 1 · Install

```bash
git clone https://github.com/savant0x/DarkFrame.git
cd DarkFrame
npm install
```

### 2 · Configure

Create **`.env.local`** (git-ignored — never commit real credentials):

```ini
# ── Required ────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/darkframe
JWT_SECRET=change-me-to-a-long-random-string

# ── Owner account (created by db:setup) ─────────────
OWNER_USERNAME=yourname
OWNER_EMAIL=you@example.com
OWNER_PASSWORD=change-me

# ── Optional ────────────────────────────────────────
PORT=3000
REDIS_URL=redis://localhost:6379
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
LOG_LEVEL=info
```

### 3 · Initialize

```bash
npm run db:setup
```

One stop — generates the 22,500-tile map (idempotent) and creates your owner account.

### 4 · Launch

```bash
npm run dev:server
```

Open **http://localhost:3000** and log in.

> `npm run dev` starts Next.js alone — fine for UI work, but no realtime or world jobs.

<details>
<summary><b>📄 Full command reference</b></summary>
<br/>

| Command | What it does |
| --- | --- |
| `npm run dev:server` | Full game server — Next + Socket.io + background jobs |
| `npm run dev` | Next.js dev server only |
| `npm run db:setup` | Generate map + owner account (idempotent) |
| `npm run map:rebuild` | ⚠️ **Destructive** — wipe & regenerate the map (`--yes` required) |
| `npm run create-indexes` | Create DB performance indexes |
| `npm run test:ci` | Full test suite (Vitest) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript check |
| `npm run stripe:listen` | Stripe webhook forwarding (expects `C:\stripe\stripe.exe`) |
| `npm run validate-referrals` | Referral validation cron |

</details>

---

## 🎮 Controls

> **One key, one action.** The movement keys are *reserved* — no panel or feature can ever fire when you press them. Every other action has exactly one binding; panel toggles use <kbd>Shift</kbd> + key. Rebind in-game via the admin Hotkey Manager.

<div align="center">

| | | |
|:---|:---:|:---|
| <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><br/><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><br/><kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd> | 🧭 | Move — 8 directions (<kbd>S</kbd> stops) |
| <kbd>G</kbd> / <kbd>⇧Shift+V</kbd> | ⛏️ | Harvest field / harvest cave & forest |
| <kbd>R</kbd> | ⚔️ | Attack factory *(you must stand on it)* |
| <kbd>⇧Shift+E</kbd> | 🍺 | Beer Bases panel |
| <kbd>B</kbd> · <kbd>N</kbd> · <kbd>U</kbd> | 🏛️ | Bank · Shrine · Unit build *(tile-gated)* |
| <kbd>⇧Shift+C</kbd> / <kbd>L</kbd> | 👥 | Clan view / leaderboards |
| <kbd>⇧Shift+X</kbd> / <kbd>⇧Shift+D</kbd> | 🤖 | Bot scanner / Discovery log |
| <kbd>I</kbd> / <kbd>⇧Shift+P</kbd> | 🎒 | Inventory / Progression |

</div>

---

## 🏗️ Architecture

```
DarkFrame/
├── app/                 Next.js App Router — pages & 180+ API routes
├── components/          Game canvas, panels, admin modals
├── lib/                 ~90 game services · Drizzle schema · jobs · websocket
│   └── db/migrations/   SQL migrations
├── types/               Shared TypeScript contracts
├── scripts/             Setup & maintenance utilities
├── docs/                Historical design docs
├── dev/                 Working notes — sessions, FIDs, protocol, architecture
└── SCOPE.md             Authoritative scope & audit trail
```

**Stack:** Next.js 16 (App Router) · React 18 · TypeScript strict · custom Node server hosting Next + Socket.io + scheduled jobs · PostgreSQL via Drizzle ORM · JWT auth (`jose`, bcrypt) · Stripe subscriptions · Redis rate-limiting · Sentry · Vitest

---

## 🔧 Development

```bash
# verify your change before pushing — all three gates must pass
npx tsc --noEmit        # types
npm run lint            # style
npm run test:ci         # behavior (333 tests)
```

**Project docs live in [`dev/`](dev/):**

| Doc | Read it for |
| --- | --- |
| [`dev/QUICK_START.md`](dev/QUICK_START.md) | Current build-gate status |
| [`SCOPE.md`](SCOPE.md) | Every change — what, why, when — plus the open decision queue |
| [`dev/session-summaries/`](dev/session-summaries/) | Per-session engineering records |
| [`dev/architecture.md`](dev/architecture.md) | System design |

> **Note on the DB layer:** Postgres is authoritative. A Mongo-style API shim (`lib/mongodb.ts`) bridges service code left over from earlier pivots and is being retired incrementally. Known rough edges are tracked openly in `SCOPE.md` — nothing is silently broken.

---

## 📊 Status

<div align="center">

**⚠️ UNDER ACTIVE DEVELOPMENT**

Playable in dev · systems landing weekly · expect rough edges.
Honest, per-session progress in [`SCOPE.md`](SCOPE.md) — no marketing numbers.

</div>

---

<div align="center">

**DarkFrame** — crafted by [@savant0x](https://github.com/savant0x)

All rights reserved · reuse requires permission

</div>
