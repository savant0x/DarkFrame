# 🚀 Quick Start — DarkFrame Development

**Last Updated:** 2026-09-15 (all gates green; 0 open FIDs)
**Overall Progress:** Playable — combat rebalance + economy v2 shipped
**Active Work:** None — pick the next system from `SCOPE.md`

---

## 📊 Current State (2026-09-15)

| Gate | Status |
| ---- | ------ |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run test:ci` | ✅ Green — 865 passed + 1 skipped, ~18s |
| Git | ✅ `main`, pushed, tree clean — direct-push workflow (no PR flow) |
| Secrets | ✅ Creds out of the repo (`.env.local`, git-ignored) |
| Protocol | ✅ ECHO v0.1.2 single-agent sole authority (`dev/echo-v0.1.2-single-agent.md`) |

**Resume here:** read `dev/session-summaries/` (latest file), then `SCOPE.md`.

---

## 🛠 Stack (verified against `package.json`, 2026-09-15)

- Next.js 16 + React 19, TypeScript strict (0 errors)
- Drizzle ORM + PostgreSQL (`pg`); a Mongo-flavored compat shim (`lib/mongodb.ts`)
  bridges legacy call shapes and retires incrementally
- Socket.io realtime (endless bounded-backoff reconnect) · Stripe payments ·
  jose (Edge-safe JWT) · Redis-optional caching
- Custom Node server (`server.ts`): Next + Socket.io + hourly jobs
  (growth, factory raids, settlement, respawns)

**Project:** tile-based persistent multiplayer strategy game · 150×150 map ·
235 API routes · ~90 services in `lib/` · NEON NOIR token UI (operator-owned —
do not touch UI without an explicit order)

---

## 🔧 Development Commands

```bash
npm run dev:server        # full game server (Next + Socket.io + jobs)
npm run dev               # Next.js only (UI work, no realtime/jobs)
npx tsc --noEmit          # types — must be 0
npm run lint              # style — must be 0
npm run test:ci           # behavior — must be green (865 tests)
npm run db:setup          # generate map + owner account (idempotent)
```

A pre-commit hook runs the ladder-truth gate when game-math sources are
staged. Documented game-math tables are CI-pinned — comment drift fails tests.

---

## 📂 Key Files

- `SCOPE.md` — approved scope + decision queue (start here)
- `CHANGELOG.md` — what shipped, per session
- `dev/session-summaries/` — session audit trail
- `dev/fids/archive/` — closed FIDs with evidence (0 open)
- `docs/` — player + design docs (audited 2026-09-15)
