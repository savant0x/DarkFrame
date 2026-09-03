# 🚀 Quick Start — DarkFrame Development

**Last Updated:** 2026-09-02 (audited reality refresh — see `dev/session-summaries/SESSION-2026-09-02-002.md`)
**Overall Progress:** Post-migration recovery phase — build currently broken, decision queue pending
**Active Work:** None — resume pointer at the bottom

---

## 📊 Current State (audited 2026-09-02)

| Gate | Status |
| ---- | ------ |
| `npx tsc --noEmit` | ❌ 2,039 errors (exit 1) — DB dialect split: Postgres connection layer vs 14 MySQL-dialect schema files |
| `npm run lint` | ⚠️ Functional (`eslint .`) — 1,836 findings (down from 2,010); burn-down in progress |
| `npm run test:ci` | ✅ Green — 333 passed + 1 env-gated skip, ~34s (fixed 2026-09-02, SESSION-2026-09-02-006) |
| Git | ⚠️ ~5 months uncommitted (284 files, +17,553/−30,761) — the working tree is the only copy |
| Secrets | ✅ Creds out of the repo (`.env.local`, git-ignored) · ⚠️ provider rotation still pending |
| Protocol | ✅ ECHO v0.1.2 single-agent sole authority (`dev/echo-v0.1.2-single-agent.md`) |

**Resume here:** read `dev/session-summaries/` (latest file), then `SCOPE.md` — the decision queue at the
bottom of `SCOPE.md` is the authoritative next-actions list.

---

## 🧭 Decision queue (from `SCOPE.md`)

1. **Rotate DB credentials** at SkySQL (security)
2. **DB direction** — finish Postgres/Supabase pivot vs revert to MariaDB (unblocks all 2,039 errors)
3. Lint-finding burn-down (test stabilization **done** 2026-09-02)
4. Commit strategy for the uncommitted work

---

## 🛠 Stack (verified against `package.json`, 2026-09-02)

- Next.js ^16.1.7 + React ^18.3.1, TypeScript (strict)
- Drizzle ORM ^0.45.2 — **both** `mysql2` ^3.20.0 and `pg` ^8.20.0 installed (the split)
- Socket.io ^4.8.1 (messaging; `ABLY_*` env vars prepared but no `ably` SDK installed)
- Stripe ^19.1.0 payments · jose ^6.1.0 (Edge-safe JWT) · `supabase` ^2.95.2 (CLI, devDependencies)
- DB config: `DB_*` env vars in git-ignored `.env.local`, loaded fail-fast by `drizzle.config.ts`

**Project:** tile-based persistent multiplayer strategy game · 150×150 map · 184 API routes ·
134 components · 90 top-level services in `lib/` (+25 WMD, 14 websocket)

---

## 🔧 Development Commands

```bash
# Start development (dev server)
npm run dev                 # node scripts/dev-start.js

# TypeScript check — currently FAILING (2,043 errors)
npx tsc --noEmit

# Lint — runs; 1,836 findings (1,833 errors / 3 warnings), down from 2,010
npm run lint

# Tests — GREEN (fixed 2026-09-02: full run 336 passed + 1 skipped in 33.6s)
npm test                    # vitest

# Initialize map (if needed)
npm run init-map            # node -r dotenv/config scripts/runInitMap.js
```

Do not trust the old "0 errors ✅" claims in historical docs — see the audit trail:
`dev/session-summaries/SESSION-2026-09-01-002.md` (exploration + health gates) and
`dev/session-summaries/SESSION-2026-09-02-002.md` (doc refresh).

---

## 📂 Key Files

- `SCOPE.md` — approved scope + decision queue (start here)
- `dev/progress.md` — FID-20260403-002 corrected status
- `dev/issues.md` — audited blocker list
- `MONGODB_TO_MARIADB_SCHEMA_MAPPING.md` — historical mapping reference (superseded banner inside;
  describes the abandoned intermediate MariaDB direction, not the current Postgres-flavored split)
- `dev/session-summaries/` — session audit trail
- `dev/completed.md`, `dev/archive/` — historical records (intentionally not rewritten)
