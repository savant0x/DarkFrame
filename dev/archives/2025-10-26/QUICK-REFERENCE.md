# 🎯 DarkFrame Development - Quick Reference Card

**Updated:** 2025-10-22 18:00  
**Status:** ✅ Production Ready (0 TypeScript errors)

---

## 📁 PROJECT STRUCTURE

```
/app                  - Next.js pages (admin, game, stats, map, wmd, etc.)
/components           - React components (65+ components)
/lib                  - Business logic, services, utilities
  /wmd               - WMD system services (13 files)
/types                - TypeScript type definitions
/dev                  - Development tracking & documentation
  ├── planned.md      - Future features queue
  ├── progress.md     - Active work
  ├── completed.md    - Finished features
  ├── lessons-learned.md - Best practices
  └── NEXT-SESSION.md - Quick start guide
```

---

## 🔑 CRITICAL PATTERNS

### Authentication (JWT)
```typescript
// JWT Payload Structure (3 fields)
{ username: string, email: string, isAdmin: boolean }

// ✅ CORRECT:
const username = payload.username as string;

// ❌ WRONG:
const userId = payload.userId; // DOES NOT EXIST
```

### GameLayout Pattern
```tsx
// ✅ CORRECT - Fill entire panel
<GameLayout
  statsPanel={<StatsPanel />}
  controlsPanel={<ControlsPanel />}
  tileView={
    <div className="h-full w-full overflow-auto bg-gradient-to-b from-gray-900 to-black">
      <main className="w-full px-6 py-8">
        {/* Content uses w-full */}
      </main>
    </div>
  }
/>

// ❌ WRONG - Creates gaps
<div className="max-w-7xl mx-auto"> {/* Don't use in GameLayout! */}
```

### Resource Colors
```tsx
Metal:  text-orange-400  // 🔩 Primary resource
Energy: text-cyan-400    // ⚡ Secondary resource
Gold:   DOES NOT EXIST   // ❌ Not in game
```

---

## 🚨 COMMON ISSUES & FIXES

| Issue | Cause | Fix |
|-------|-------|-----|
| WMD 401 errors | JWT field mismatch | Use `payload.username` (not `userId`) |
| Content doesn't fill | Using `max-w-7xl` | Use `w-full` in GameLayout |
| Undefined property | Missing default values | Add optional chaining `?.` |
| Gold references | Old economy system | Replace with metal/energy |

---

## ⚡ QUICK COMMANDS

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npx tsc --noEmit        # Check TypeScript errors
npm run build           # Production build test

# Git
git status              # Check changes
git add .               # Stage all
git commit -m "msg"     # Commit
git push                # Push to remote
```

---

## 📊 SYSTEM STATS

**Pages:** 15+ main routes  
**Components:** 65+ React components  
**Services:** 20+ business logic modules  
**Type Files:** 30+ TypeScript definitions  
**API Routes:** 40+ endpoints  

**Code Quality:**
- TypeScript: ✅ 0 errors
- Documentation: ✅ JSDoc on all functions
- Testing: ✅ Manual QA required

---

## 🎯 CURRENT PRIORITIES

1. **Manual Testing** - Verify recent fixes work
2. **WMD Phase 2** - API routes & database (next big feature)
3. **Bug Fixes** - Address any new issues
4. **Polish** - Improve UX based on feedback

---

## 📚 KEY DOCUMENTATION FILES

| File | Purpose |
|------|---------|
| `NEXT-SESSION.md` | Quick start for next session |
| `session-summary-2025-10-22.md` | Today's work details |
| `lessons-learned.md` | Best practices & patterns |
| `architecture.md` | System design decisions |
| `planned.md` | Future work queue |
| `completed.md` | Finished features |

---

## 🧠 REMEMBER

1. **Read before coding** - Check `/dev` docs for context
2. **JWT uses username** - Not userId (common mistake)
3. **GameLayout needs w-full** - Never max-w-7xl
4. **Metal + Energy only** - No gold in game
5. **0 TypeScript errors** - Always verify before commit

---

## ✅ PRE-SESSION CHECKLIST

- [ ] Read `NEXT-SESSION.md`
- [ ] Check `planned.md` for priorities
- [ ] Review last `session-summary-*.md`
- [ ] Run `npx tsc --noEmit` (verify 0 errors)
- [ ] Start dev server (`npm run dev`)
- [ ] Manual test recent changes

---

## 🎉 READY TO CODE!

**Everything is documented, organized, and ready.**  
**Pick a task from `planned.md` and ship it! 🚀**

---

*For detailed information, see full documentation in `/dev` folder*
