# DarkFrame — Testing Guide

**Last Updated:** 2026-05-04
**Framework:** Vitest 4.0 + React Testing Library 16.3

---

## Prerequisites

1. **Supabase project** — Local or cloud. Configure in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

2. **Database** — Push migrations:
```bash
npx supabase db push
```

3. **Map** — Seed tiles:
```bash
npx tsx scripts/map/seed-tiles.ts
```

4. **Admin account** — Create for testing:
```bash
npx tsx scripts/admin/create-admin.ts
```

---

## Start Dev Server

```bash
npm run dev
# → http://localhost:3000
```

---

## Running Tests

```bash
# Run all tests
npm test

# Watch mode (TDD)
npm run test:watch

# Coverage report
npm run test:coverage

# CI mode
npm run test:ci
```

---

## Test Structure

```
__tests__/
├── api/                    # API endpoint tests
│   ├── player.test.ts
│   ├── clan.test.ts
│   └── auth.test.ts
└── components/             # React component tests
    ├── BankPanel.test.tsx
    ├── StatsPanel.test.tsx
    └── ClanChat.test.tsx
```

---

## API Testing

Test API endpoints with `fetch` or curl:

```bash
# Player data
curl http://localhost:3000/api/player?username=fame

# Player stats (requires auth cookie)
curl -b "sb-xxx-token=..." http://localhost:3000/api/player/stats
```

---

## Manual Testing Checklist

- [ ] **Auth** — Register, login, session persistence, logout
- [ ] **Movement** — 9 directions, edge wrapping, move API
- [ ] **Map** — Tile data, terrain, occupied_by_base, banks
- [ ] **Harvest** — Metal, energy, cave, forest; cooldowns
- [ ] **Banking** — Deposit, withdraw, loans
- [ ] **Factory** — Build, status, unit production
- [ ] **Combat** — Unit attacks, base attacks, battle logs
- [ ] **Clan** — Create, join, leave, roles, alliances
- [ ] **Chat** — Global, clan, trade channels
- [ ] **Friends** — Add, accept, remove, block
- [ ] **Messages** — DM send, receive, conversations
- [ ] **WMD** — Research, missiles, defense, spies
- [ ] **VIP** — Purchase flow, subscription tiers
- [ ] **Admin** — User management, bans, hotkeys
- [ ] **Tutorial** — Quest progression system

---

## TypeScript

```bash
# 0 errors must be maintained
npx tsc --noEmit
```
