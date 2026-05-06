# DarkFrame - Issues & Technical Debt

> Bugs, blockers, and technical debt tracking

**Last Updated:** 2026-05-06
**Active Issues:** 1 (Economy — by design, being addressed via balance FIDs)
**Status:** 📋 PLANNED — Economy rebalance FIDs written, implementation pending

---

## 🐛 Active Issues

### [ISS-001] Economy Hyperinflation (PLANNED — Being Addressed)
**Severity:** CRITICAL
**Status:** 📋 PLANNED
**FIDs:** FID-20260506-BALANCE-MASTER through P4

**Symptoms:**
- Player reached level 36 in one session
- 4M metal / 3M energy accumulated in single session
- 710K STR / 830K DEF army built in one session
- +973% gathering bonus from diggers
- All tier unlocks completed in one session
- All tech tree unlocks completed in 1-2 sessions

**Root Causes:**
1. Multiplicative stacking (VIP 2x × Flag 2x × Shrine 2x × Diggers 10x+)
2. Digger drop rate 10-15x too high (30% × 60% = ~400 diggers/reset)
3. XP curve too flat (1,000 XP/level linear)
4. No resource sinks exist
5. Auto-farm has no decay or cost

**Fix:** See balance FIDs. Implementation starts with Phase 1.

---

## ✅ Resolved Issues

### [RESOLVED] Edge Runtime Middleware Compatibility (FID-20251017-005)
**Date:** 2025-10-17  
**Severity:** 🔴 Critical - Server startup failure  

**Problem:**
- Next.js middleware crashed on startup with `Cannot read properties of undefined (reading 'modules')`
- Error caused by `jsonwebtoken` library importing native Node.js modules (bcrypt via node-gyp-build)
- Edge Runtime does not support native modules, only pure JavaScript
- Blocked all authentication and access to protected `/game` route

**Root Cause:**
- `lib/authMiddleware.ts` used `jsonwebtoken` for JWT verification
- `jsonwebtoken` has transitive dependency on `node-gyp-build` which requires native modules
- Next.js middleware runs in Edge Runtime by default (lightweight, no Node.js internals)

**Solution:**
- Migrated `lib/authMiddleware.ts` from `jsonwebtoken` to `jose` library
- `jose` is pure JavaScript, built specifically for Edge Runtime and Web Crypto API
- Updated `verifyToken()` function from synchronous to async (jose requirement)
- Kept `lib/authService.ts` unchanged (API routes use Node.js runtime)

**Files Changed:**
- `lib/authMiddleware.ts` - Replaced jsonwebtoken with jose
- `package.json` - Added jose dependency

**Testing:**
- ✅ Server starts without Edge Runtime errors
- ✅ No compilation errors in TypeScript
- ✅ Middleware compiles successfully
- ✅ Authentication working in production

**Lessons Learned:**
- Always use Edge Runtime-compatible libraries for Next.js middleware
- `jose` is the recommended JWT library for Edge environments
- Native Node.js modules (bcrypt, crypto, fs) cannot be used in middleware
- API routes run in Node.js runtime and can use any library

---

## ⚠️ Known Limitations

### Current System Constraints
- No automated testing suite (manual testing only)
- Basic analytics (no APM integration yet)
- Local development requires MongoDB connection
- No CI/CD pipeline configured

**Note:** These are intentional deferrals, not blockers. Can be addressed as needed.

---

## 🔧 Technical Debt

### Low Priority Items
- Consider implementing automated testing (Jest, Playwright)
- Add APM monitoring (Sentry, DataDog) for production
- Set up CI/CD pipeline (GitHub Actions)
- Implement advanced caching strategies (Redis)

**Status:** All items are optional enhancements, not critical

---

## 💡 Future Improvements

- Add comprehensive test coverage (unit, integration, E2E)
- Implement advanced analytics and monitoring
- Set up CI/CD for automated deployment
- Add Redis caching for high-traffic endpoints
- Implement rate limiting on all public APIs
- Add email notification system
- Create admin dashboard for system monitoring

**Note:** See `dev/planned.md` for prioritized feature roadmap

---

**Last Updated:** 2025-10-25
