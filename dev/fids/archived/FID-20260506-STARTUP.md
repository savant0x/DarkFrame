# FID-20260506-STARTUP: Fix Development Server Startup — Dead MongoDB Dependency

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260506-STARTUP |
| **Date Created** | 2026-05-06 |
| **Status** | OPEN |
| **Priority** | CRITICAL |
| **Phase** | Planning — Awaiting Approval |

---

## Context

The development server (`npm run dev`) fails to start due to a dead MongoDB dependency chain. The project was migrated from MongoDB to Supabase, but `server.ts` (custom Next.js server) still imports `lib/mongodb.ts` which requires the `mongodb` npm package that is no longer installed.

The startup chain is:
1. `npm run dev` → `scripts/dev-start.js` → `tsx server.js`
2. `server.ts` imports `connectToDatabase` from `lib/mongodb.ts`
3. `lib/mongodb.ts` imports from `mongodb` npm package → **MODULE_NOT_FOUND**

Additionally, `dev-start.js` was running Stripe listener via `concurrently` with an expired API key, causing the entire startup to crash.

---

## Issue: Development Server Won't Start

### Symptoms
```
Error: Cannot find module 'mongodb'
Require stack:
- C:\dev\DarkFrame\lib\mongodb.ts
- C:\dev\DarkFrame\lib\websocket\auth.ts
- C:\dev\DarkFrame\lib\websocket\server.ts
- C:\dev\DarkFrame\server.ts
```

Followed by Stripe authentication failure:
```
Authorization failed, status=401, body={ "error": { "message": "Expired API Key provided" } }
```

### Root Cause Analysis

1. **Dead MongoDB dependency**: `lib/mongodb.ts` imports `from 'mongodb'` but the package is not installed (project migrated to Supabase)
2. **Import chain**: `server.ts` → `lib/websocket/server.ts` → `lib/websocket/auth.ts` → `lib/mongodb.ts` → `mongodb` package
3. **Background jobs**: WMD jobs, flag bot job, factory slot regen job all use `connectToDatabase()` from `lib/mongodb.ts`
4. **Stripe**: Expired API key causes `concurrently` to kill all processes

### Files Involved

| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `scripts/dev-start.js` | Remove Stripe from concurrently, run server only | Startup script | LOW |
| 2 | `server.ts` | Remove dead imports (mongodb, websocket, background jobs) or replace with Supabase | Custom server | MEDIUM |
| 3 | `lib/mongodb.ts` | Replace with Supabase client or remove if unused | All DB operations | HIGH |
| 4 | `package.json` | Remove `mongodb` dependency if no longer needed | Dependencies | LOW |

---

## Fix Plan

### Option A: Minimal Fix (Get Server Running Fast)
1. Remove Stripe from `dev-start.js` concurrently command
2. Remove dead imports from `server.ts` (websocket, mongodb, background jobs)
3. Keep custom server architecture for future Socket.io integration
4. Server starts without background jobs (they can be re-added later with Supabase)

### Option B: Enterprise Fix (Proper Supabase Integration)
1. Remove Stripe from `dev-start.js`
2. Create `lib/supabase/server.ts` — Supabase server client singleton
3. Replace `connectToDatabase()` calls with Supabase client
4. Update all background jobs to use Supabase queries
5. Keep custom server architecture with proper graceful shutdown
6. Add proper error handling for Supabase connection failures

### Recommended: Option B

The custom server.ts is well-written with proper error handling, graceful shutdown, and typed configuration. It's worth keeping and properly integrating with Supabase. The background jobs (WMD, flag bot, factory slot regen) are important game mechanics that should work.

---

## Verification Checklist
- [ ] `npm run dev` starts without errors
- [ ] Server logs show successful startup
- [ ] HTTP server responds on http://localhost:3000
- [ ] No MODULE_NOT_FOUND errors
- [ ] No Stripe authentication errors
- [ ] Background jobs initialize (or gracefully skip if Supabase not configured)
- [ ] Graceful shutdown works (Ctrl+C)
- [ ] `npx tsc --noEmit` passes with 0 errors

---

## Notes
- The `server.ts` has proper error handling — each background job fails gracefully with a warning
- Socket.io is not wired up anyway (just imports), so removing it from server.ts is safe
- The `dev-start.js` was modified earlier to remove Stripe, but the merge overwrote it
- Need to decide: keep custom server (Option B) or switch to standard `next dev` (simpler but loses background jobs)
