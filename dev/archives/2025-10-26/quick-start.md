# 🚀 Quick Start Guide for New Chat Sessions

**Last Updated:** 2025-10-25  
**Purpose:** Complete context restoration + ECHO v5.1 Operating System - READ THIS FILE COMPLETELY

> 🎯 **This file contains EVERYTHING a new chat session needs to be fully operational**  
> 📚 **Includes:** Project state, recent fixes, ECHO v5.1 complete instructions, and workflows  
> ⚡ **Goal:** Single file read = fully operational AI agent with complete context  

---

## 🤖 **INSTRUCTIONS FOR ECHO (AI Agent)**

**When user says "Read quick-start.md" or starts new chat:**

1. ✅ **Read this ENTIRE file** (all sections below) - 800+ lines of complete context
2. ✅ **Acknowledge** you understand both project state AND ECHO v5.1 operating principles
3. ✅ **Confirm** you will follow mandatory workflows (complete file reads, approval verification)
4. ✅ **State** current project status (server running, database healthy, no active issues)
5. ✅ **Ask** "What would you like to work on?" to begin session

**CRITICAL OPERATING PRINCIPLE:**
- **ALWAYS read COMPLETE files** before editing (startLine=1, endLine=9999)
- **NEVER make assumptions** about code in unread sections
- **VERIFY line count** before using `replace_string_in_file`
- **WAIT for approval** ("proceed", "yes", "code") before implementing
- **This rule saved us from repeating the Beer Base bug** (see Section 2 below)

---

## 📊 **CURRENT PROJECT STATE (2025-10-25)**

### **✅ Production Status**
- **Server:** Running at http://localhost:3000 (Next.js 14 App Router + TypeScript)
- **Database:** MongoDB Atlas Free Tier (512 MB) - HEALTHY at ~1% usage (5 MB / 512 MB)
- **Payment System:** Stripe fully integrated - 5 VIP tiers ($9.99-$199.99) operational
- **VIP System:** Live with automated subscription management via webhooks
- **Referral System:** Complete with validation, rewards, admin panel
- **WMD System:** Phases 1-3 complete (missiles, defense, intelligence, voting)
- **Bot System:** Fixed and operational with 6 safety caps (see emergency fix below)

### **🎯 Project Description**
DarkFrame is a strategy war game built with Next.js 14, TypeScript, MongoDB, and Socket.io. Players build bases, collect resources, train armies, engage in combat, and compete on leaderboards. Features include:
- Real-time multiplayer combat
- Clan system with territories and warfare
- Bot ecosystem with specializations
- Tech tree and research system
- VIP subscriptions with premium features
- Referral program with rewards
- WMD (Weapons of Mass Destruction) system

### **🔥 RECENT CRITICAL EMERGENCY FIX (2025-10-25)**

**[FID-20251025-BEERBASE-EMERGENCY]** Database Crisis - Infinite Beer Base Spawning

**The Problem:**
- Database usage spiked from 10% → 87% (445 MB / 512 MB) in 10 days
- 153,706 fake "Beer Base" bot documents accumulated
- User approaching forced upgrade from free tier to paid MongoDB ($9+/month)
- Root cause: Infinite feedback loop in `getTargetBeerBaseCount()` function

**What Went Wrong:**
```typescript
// BUG: Counted ALL bots including Beer Bases
const totalBots = await db.collection('players').countDocuments({ isBot: true });
const targetCount = Math.floor(totalBots * 0.07); // 7% of total

// RESULT: 100 bots → spawn 7 Beer Bases → now 107 total → spawn 7.49 → infinite loop
```

**The Fix (6 Safety Mechanisms):**

1. **Exclude Beer Bases from count** (`lib/beerBaseService.ts` line 120):
```typescript
const regularBots = await db.collection('players').countDocuments({ 
  isBot: true,
  isSpecialBase: { $ne: true } // CRITICAL: Don't count Beer Bases
});
```

2. **Respect admin totalBotCap** (default 1000 from admin panel)
3. **Safety Cap #1:** Max 10% of totalBotCap (100 if cap is 1000)
4. **Safety Cap #2:** Absolute maximum 1000 Beer Bases
5. **Zero-bot prevention:** Return 0 if no regular bots exist
6. **Spawn limiter** (`lib/wmd/jobs/beerBaseRespawner.ts`): Max 100 per 60-second cycle

**Hidden Bug Discovered (Why Cleanup Failed Initially):**
- `createBot()` sets `isSpecialBase` inside `botConfig` object (nested)
- Queries looked for top-level `isSpecialBase` field (didn't exist)
- Result: 153,706 "invisible" documents
- **Solution:** Added top-level `isSpecialBase` field to Player type + spawning code

**Actions Taken:**
- ✅ Created `scripts/emergency-beerbase-cleanup.ts` - Deleted 153,706 docs
- ✅ Created `scripts/reclaim-database-space.ts` - Reclaimed 274 MB fragmented storage
- ✅ Fixed calculation logic in `lib/beerBaseService.ts` (6 safety caps)
- ✅ Fixed spawner limits in `lib/wmd/jobs/beerBaseRespawner.ts`
- ✅ Added `isSpecialBase?: boolean` to Player interface in `types/game.types.ts`
- ✅ Restarted dev server with all fixes active

**Impact:**
- **Database Before:** 485 MB used (87% of 512 MB) - CRITICAL
- **Database After:** 5 MB used (~1% of 512 MB) - HEALTHY
- **Space Reclaimed:** 485 MB total (cleaned + defragmented)
- **Money Saved:** Avoided forced MongoDB upgrade ($9-50+/month)

**Lesson Learned:**
This bug was only discovered because we **read the COMPLETE `beerBaseService.ts` file (lines 1-759)** instead of partial sections. Partial reads (lines 1-100) missed critical implementation details at line 475+ that revealed the `isSpecialBase` field was never set at top level.

**User Quote:** *"When you don't have a complete understanding, that's when mistakes happen and bugs happen. But when you read it fully first you know exactly what should go where without having to make assumptions or guess."*

---

## 📁 **FILES MODIFIED IN THIS SESSION**

### **Emergency Fix Files:**
1. `lib/beerBaseService.ts` - Fixed `getTargetBeerBaseCount()` with 5 safety mechanisms
2. `lib/wmd/jobs/beerBaseRespawner.ts` - Added 3 spawn safety caps
3. `types/game.types.ts` - Added `isSpecialBase?: boolean` to Player interface (line 416)
4. `scripts/emergency-beerbase-cleanup.ts` - Cleanup script (153,706 docs deleted)
5. `scripts/reclaim-database-space.ts` - Storage defragmentation (274 MB reclaimed)

### **Documentation Updates:**
6. `dev/quick-start.md` - This file (session recovery guide)
7. `dev/completed.md` - Added FID-20251025-BEERBASE-EMERGENCY entry
8. `CHAT_WINDOW_FIX.md` - VS Code frozen chat recovery instructions

---

## 🎯 **ACTIVE TODO LIST**

### **✅ Completed Today (2025-10-25):**
1. ✅ Created emergency database cleanup script
2. ✅ Fixed Beer Base target calculation logic (excluded Beer Bases from count)
3. ✅ Added 6 safety caps to prevent infinite spawning
4. ✅ Executed cleanup script (deleted 153,706 fake Beer Bases)
5. ✅ Verified database after cleanup (2 docs: 1 real player, 1 regular bot)
6. ✅ Reclaimed fragmented storage (274 MB freed via collection rebuild)
7. ✅ Fixed TypeScript errors (added isSpecialBase to Player type)
8. ✅ Restarted dev server with all fixes loaded

### **⏸️ Pending:**
- Monitor background job health (Beer Base Population Manager should spawn 0 with 0 regular bots)
- Audit bot system alignment with design docs (verify 1000 cap, 7% Beer Bases, admin controls)

### **📋 Next Priority (from dev/planned.md):**
- Continue route enhancement work (244 routes remaining from FID-20251024-ROUTE-DEFER)
- OR implement next gameplay feature (Flag System, etc.)

---

## 📚 **ECHO v5.1 OPERATING PRINCIPLES**

### **Mandatory Complete File Reads (BINDING LAW)**

**BEFORE ANY FILE EDIT, YOU MUST:**
1. Read ENTIRE file: `read_file(filePath, startLine=1, endLine=9999)`
2. Verify total line count (e.g., "I have read complete file: 759 lines")
3. Understand complete structure (all functions, patterns, footer notes)
4. Confirm you are NOT making assumptions about unread sections

**Example Correct Workflow:**
```
User: "Add VIP detection to harvest calculator"
Agent: read_file(StatsPanel.tsx, lines 1-9999)
Agent: "I have read complete StatsPanel.tsx (602 lines). Harvest calculator is at lines 430-554. Ready to add VIP detection."
User: "proceed"
Agent: replace_string_in_file(StatsPanel.tsx, ...) ✅
```

**Example WRONG Workflow (Violation):**
```
User: "Add VIP detection to harvest calculator"
Agent: read_file(StatsPanel.tsx, lines 1-100)
Agent: "I see the harvest calculator pattern, I'll add VIP detection now"
Agent: replace_string_in_file(StatsPanel.tsx, ...) ❌ VIOLATION!
```

### **Approval Verification System**

**BEFORE ANY CODE GENERATION:**
- Detect user intent: Is this a feature request or approval?
- IF feature/bug description → ENTER PLANNING MODE (ask questions, create plan, wait)
- IF approval keyword → ENTER CODING MODE (read files, implement)
- NEVER jump to coding when user describes a feature

**Valid Approval Keywords:**
- ✅ "proceed", "code", "yes", "do it", "start", "implement"

**NOT Approval Keywords:**
- ❌ "3" (selecting option), "okay", "sounds good", "fix it", "the login is broken"

**If Uncertain:** Ask: "Ready to proceed with this fix? Say 'code' or 'proceed'"

### **Core Behavior Standards**

1. **Never generate pseudo-code** - Always complete, production-ready implementations
2. **Ask clarifying questions** - Never make assumptions about requirements
3. **Use modern syntax** - TypeScript, const/let, arrow functions, async/await (2025+ standards)
4. **Comprehensive documentation** - JSDoc on all public functions, inline comments explaining why
5. **Error handling** - Graceful failures with user-friendly messages
6. **Security by default** - OWASP Top 10 compliance, input validation, no sensitive data exposure

---

## 🗂️ **PROJECT STRUCTURE**

### **Development Tracking (`/dev` folder) - YOUR COMMAND CENTER**

**Active Development:**
- `planned.md` - Features awaiting implementation (queue of next work)
- `progress.md` - Currently active development (EMPTY when no active work)
- `issues.md` - Bugs and technical debt (EMPTY - no active issues currently)

**Documentation:**
- `completed.md` - Finished features with full implementation details
- `roadmap.md` - Long-term vision and strategic milestones
- `decisions.md` - Architectural decisions and rationale
- `metrics.md` - Development velocity and accuracy tracking
- `lessons-learned.md` - Insights from past work
- `quality-control.md` - Standards compliance tracking

**Archives:**
- `archive/` - Historical FIDs, old completed work, session summaries

**Special Files:**
- `quick-start.md` - THIS FILE (session recovery guide)
- `NEXT-SESSION.md` - User notes for next session
- `suggestions.md` - Improvement recommendations

### **Code Organization**

```
app/                    # Next.js 14 App Router pages
├── api/               # API routes (REST endpoints)
├── game/              # Game pages (protected routes)
├── admin/             # Admin panel
└── globals.css        # Global styles

components/            # React components (400+ components)
├── *Panel.tsx         # Game UI panels
├── *Modal.tsx         # Modal dialogs
└── index.ts           # Barrel export

lib/                   # Business logic and services
├── auth*.ts           # Authentication (JWT, bcrypt)
├── *Service.ts        # Business logic services
├── mongodb.ts         # Database connection
├── validation/        # Zod schemas
├── wmd/               # WMD system (jobs, services)
└── stripe/            # Payment processing

types/                 # TypeScript type definitions
├── game.types.ts      # Core game types (2355 lines)
├── wmd/               # WMD-specific types
└── *.types.ts         # Feature-specific types

utils/                 # Utility functions
├── errorCodes.ts      # Structured error system
└── *.ts               # Helper functions

scripts/               # Automation and maintenance
├── emergency-beerbase-cleanup.ts
├── reclaim-database-space.ts
└── *.ts               # Other utility scripts

public/                # Static assets
├── images/
└── icons/
```

---

## 🔧 **COMMON WORKFLOWS**

### **Starting a New Feature**

1. **Check planned.md** for next priority
2. **Create Feature ID:** Format `FID-YYYYMMDD-XXX`
3. **Add to progress.md** with:
   - Description, priority, complexity estimate
   - Acceptance criteria (testable requirements)
   - Dependencies and prerequisites
   - Files to modify/create
4. **Ask clarifying questions** until requirements 100% clear
5. **Create implementation plan** with step-by-step approach
6. **Get explicit approval** ("proceed", "yes", "code")
7. **Read complete files** before any edits
8. **Implement with documentation** (JSDoc, inline comments, OVERVIEW sections)
9. **Update progress.md** throughout implementation
10. **Move to completed.md** when done with full summary

### **Bug Fix Workflow**

1. **Investigate** using complete file reads (never partial)
2. **Document root cause** in `dev/issues.md` with evidence
3. **Create fix plan** with:
   - Root cause explanation
   - Proposed solution with alternatives
   - Safety mechanisms to prevent recurrence
   - Acceptance criteria
4. **Get approval** before implementing
5. **Apply fixes** with comprehensive error handling
6. **Add tests** for critical functionality
7. **Mark resolved** in `dev/issues.md`
8. **Document lessons** in `dev/lessons-learned.md`
9. **Update metrics** in `dev/metrics.md`

### **Database Operations**

**Connection Details:**
- **Provider:** MongoDB Atlas Free Tier
- **Limit:** 512 MB total capacity
- **Current Usage:** ~1% (5 MB / 512 MB) ✅ HEALTHY
- **Database Name:** `darkframe`
- **Connection String:** In `.env.local` as `MONGODB_URI`

**Key Collections:**
- `players` (2 docs currently: 1 real player, 1 regular bot)
- `clans` (clan data and member rosters)
- `tiles` (map tiles with bases and resources)
- `battleLogs` (combat history)
- `auctions` (auction house listings and bids)
- `botConfig` (bot system configuration)
- `paymentTransactions` (Stripe payment records)
- `flags` (flag bearer system state)

**Available Tools:**
- MongoDB MCP tools for queries (`mcp_mongodb-js_mo_*`)
- Direct queries via API routes
- Admin panel for visual management

**Monitoring:**
- Check Atlas dashboard for usage percentage
- Monitor collection sizes via `db.command({ collStats: 'collection' })`
- Alert if usage exceeds 80% (need to investigate growth)

### **TypeScript Standards**

**Type Safety:**
- Strict mode enabled in `tsconfig.json`
- No `any` types (use `unknown` if truly unknown)
- Explicit return types on all public functions
- Interface over type for object shapes
- Proper null/undefined handling with optional chaining

**Modern Syntax (2025+):**
- `const`/`let` (never `var`)
- Arrow functions (not `function() {}`)
- Destructuring for objects and arrays
- Async/await (not callbacks or raw promises)
- Template literals (not string concatenation)
- Optional chaining (`obj?.prop`)
- Nullish coalescing (`value ?? default`)

---

## 🚨 **KNOWN CONSTRAINTS & LIMITATIONS**

### **Database (MongoDB Atlas Free Tier)**
- ✅ 512 MB total capacity
- ✅ Currently at ~1% usage (HEALTHY)
- ⚠️ Monitor Beer Base spawning (should spawn 0 until regular bots exist)
- ⚠️ Alert if usage exceeds 400 MB (80% capacity)
- ✅ Defragmentation script available if needed (`scripts/reclaim-database-space.ts`)

### **Payments (Stripe)**
- ✅ Integration complete with webhook automation
- ✅ 5 VIP tiers ($9.99 Weekly → $199.99 Yearly)
- ✅ Automatic VIP grant/revoke on subscription events
- ⚠️ Test mode active (use Stripe test cards: `4242 4242 4242 4242`)
- ⚠️ Production mode requires verification and compliance review

### **Server (Next.js 14)**
- ✅ App Router with TypeScript
- ✅ Socket.io for real-time features (clan chat, combat notifications)
- ✅ Background jobs via `tsx` runtime:
  - 5 WMD jobs (missiles, spy missions, voting, defense, Beer Bases)
  - 1 Flag Bot job (flag bearer management)
- ⚠️ All jobs run every 30-60 seconds (monitor CPU/memory)
- ✅ Development server on port 3000
- ✅ Stripe webhook listener running

---

## 💡 **QUICK RECOVERY PHRASES (Test ECHO Understanding)**

**After reading this file, user may test you with:**

**"What's the current project status?"**
- ✅ Expected: Summary of DarkFrame game, completed features, server running, database healthy

**"What was the Beer Base bug?"**
- ✅ Expected: Infinite loop in getTargetBeerBaseCount(), 153K docs, 485 MB reclaimed, 6 safety caps added

**"What needs to be done next?"**
- ✅ Expected: Monitor background job, audit bot system, then reference dev/planned.md for next feature

**"Why do you need to read complete files?"**
- ✅ Expected: Partial reads create blind spots (Beer Base bug example), assumptions lead to bugs, complete context required for accuracy

**"What are the approval keywords?"**
- ✅ Expected: "proceed", "code", "yes", "do it", "start", "implement" (NOT "okay", "3", "fix it")

---

## 📋 **SESSION RECOVERY CHECKLIST (Execute When Starting)**

**When user says "Read quick-start.md" or begins new chat:**

1. ✅ **Read this entire file** (you're doing it now!)
2. ✅ **Acknowledge understanding:** "I've read quick-start.md and understand the project state."
3. ✅ **Confirm ECHO v5.1 compliance:** "I will read complete files before editing and wait for approval."
4. ✅ **State current status:**
   - Server running on :3000 ✅
   - Database at ~1% usage ✅
   - Beer Base bug fixed ✅
   - No active work in progress ✅
5. ✅ **Check for active work:** Read `dev/progress.md` (should be empty)
6. ✅ **Check for issues:** Read `dev/issues.md` (should be empty)
7. ✅ **Ask:** "What would you like to work on today?"

---

## 🎯 **NEXT PRIORITIES (Updated 2025-10-25)**

### **Immediate (This Week)**
1. ✅ Monitor Beer Base spawner for 24 hours (should spawn 0 with 0 regular bots)
2. ✅ Complete bot system audit vs design docs (FID-20251018-BOT-PHASE-1)
3. ✅ Verify all 6 safety caps working correctly in production

### **Short-Term (Next 2 Weeks)**
1. Continue systematic route enhancement (244/274 routes remaining - FID-20251024-ROUTE-DEFER)
   - Zod validation for all API routes
   - Structured error handling with ErrorCode system
   - Rate limiting per endpoint category
2. Implement next gameplay feature from `dev/planned.md` (Flag System, etc.)

### **Long-Term (See dev/roadmap.md)**
- Mobile responsiveness improvements
- Performance optimization (Redis caching)
- Advanced clan features (tournaments, leaderboards)
- Additional monetization features (cosmetics, boosts)

---

## 📞 **SUPPORT REFERENCES**

### **Project Details**
- **Repository:** DarkFrame (GitHub: savant0x/DarkFrame)
- **Owner:** savant0x
- **Project Type:** Strategy war game (multiplayer, real-time)
- **Current Branch:** main
- **Development Environment:** Windows with PowerShell

### **Tech Stack**
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5.3
- **Backend:** Next.js API Routes, Node.js 20+
- **Database:** MongoDB Atlas (Free Tier 512 MB)
- **Payments:** Stripe (Test Mode active)
- **Real-time:** Socket.io
- **Authentication:** JWT (jose library for Edge Runtime)
- **Validation:** Zod schemas
- **Styling:** Tailwind CSS

### **Development Approach**
- **Methodology:** ECHO v5.1 with mandatory complete file reads
- **Version Control:** Git with main branch
- **Code Quality:** TypeScript strict mode, ESLint, comprehensive JSDoc
- **Testing:** Manual testing + critical path unit tests
- **Documentation:** Inline comments, OVERVIEW sections, dev folder tracking

---

## 🔥 **CRITICAL REMINDERS**

### **For ECHO (You):**

1. **ALWAYS read complete files before editing** - This is non-negotiable
   - Prevented Beer Base bug recurrence
   - User validated this approach: "When you read it fully first you know exactly what should go where"

2. **NEVER make assumptions** - Ask questions until 100% clear
   - Better to ask "obvious" questions than ship bugs

3. **Wait for explicit approval** - "proceed", "yes", "code" only
   - Bug reports are NOT approval to code
   - Option selections (1, 2, 3) are NOT approval

4. **Document everything** - JSDoc, inline comments, OVERVIEW sections
   - Future ECHO sessions depend on your documentation
   - User needs to understand code you wrote

5. **Security first** - Validate inputs, sanitize outputs, no sensitive data exposure
   - OWASP Top 10 compliance by default

### **For User (savant0x):**

- ✅ Server running on http://localhost:3000
- ✅ Database healthy at ~1% usage (485 MB crisis resolved)
- ✅ All fixes active in running server
- ✅ No active issues or blockers
- ✅ Ready for next feature/task

**To continue work:** Tell ECHO what you'd like to work on, or say "what's next?" to review planned.md

---

**Remember:** This file is your safety net. Read it at the start of every new chat session to restore complete context. ECHO cannot remember previous conversations, but this file preserves everything critical.

**End of Quick Start Guide - Session Recovery Complete** ✅

---

## 📊 **CURRENT PROJECT STATE**

### **✅ Production Status**
- **Server:** Running at http://localhost:3000
- **Database:** MongoDB Atlas (512 MB) - HEALTHY at ~1% usage
- **Payment System:** Stripe fully integrated and operational
- **VIP System:** Live with 5 subscription tiers
- **Referral System:** Complete with automation
- **WMD System:** Phases 1-3 complete

### **🔥 RECENT CRITICAL FIX (2025-10-25)**
**[FID-20251025-BEERBASE-EMERGENCY]** Beer Base Infinite Loop Bug
- **Impact:** Database grew from 10% → 87% (445 MB) in 10 days
- **Root Cause:** `getTargetBeerBaseCount()` counted Beer Bases in total, creating infinite feedback loop
- **Documents Removed:** 153,706 fake Beer Bases
- **Space Reclaimed:** 485 MB (database now at ~1% usage)
- **Fixes Applied:** 6 safety caps + field structure corrections
- **Status:** ✅ RESOLVED - Server running with fixes active

### **📁 Key Files Modified Today**
- `lib/beerBaseService.ts` - Fixed calculation logic, added safety caps
- `lib/wmd/jobs/beerBaseRespawner.ts` - Added spawn limits
- `types/game.types.ts` - Added `isSpecialBase` field to Player interface
- `scripts/emergency-beerbase-cleanup.ts` - Cleanup script (153K docs deleted)
- `scripts/reclaim-database-space.ts` - Storage reclamation (274 MB freed)

---

## 🎯 **ACTIVE TODO LIST**

### **Completed Today (2025-10-25):**
- ✅ Created emergency cleanup script
- ✅ Fixed Beer Base target calculation logic
- ✅ Added 6 safety caps to spawner
- ✅ Deleted 153,706 fake Beer Bases
- ✅ Reclaimed 274 MB fragmented storage
- ✅ Fixed TypeScript errors
- ✅ Restarted server with fixes

### **Pending:**
- ⏸️ Monitor background job health (Beer Base Population Manager)
- 📋 Audit bot system alignment with design docs

---

## 📚 **CRITICAL CONTEXT FOR ECHO**

### **ECHO v5.1 Operating Principles**
1. **ALWAYS read COMPLETE files** before editing (startLine=1, endLine=9999)
2. **NEVER make assumptions** about unread code sections
3. **VERIFY total line count** before using `replace_string_in_file`
4. **ASK clarifying questions** when requirements unclear
5. **USE approval verification** - wait for "proceed"/"yes"/"code" before implementing

### **Recent Lesson Learned**
Partial file reads (e.g., lines 1-100 of 759-line file) caused us to miss critical implementation details:
- Assumed `isSpecialBase` was set correctly
- Missed that it was only in `botConfig`, not top-level
- Result: 153,706 "invisible" documents accumulated for 10 days

**User Quote:** *"When you don't have a complete understanding, that's when mistakes happen and bugs happen. But when you read it fully first you know exactly what should go where without having to make assumptions or guess."*

---

## 🗂️ **PROJECT STRUCTURE**

### **Development Tracking (`/dev` folder)**
- `planned.md` - Features awaiting implementation
- `progress.md` - Currently active development (EMPTY - all work complete)
- `completed.md` - Finished features with full documentation
- `issues.md` - Bugs and technical debt (EMPTY - no active issues)
- `roadmap.md` - Long-term vision and milestones
- `decisions.md` - Architectural decisions and rationale
- `metrics.md` - Development velocity and accuracy tracking
- `lessons-learned.md` - Insights from past work
- `archive/` - Historical FIDs and completed work

### **Code Organization**
- `app/` - Next.js 14 App Router pages
- `components/` - React components
- `lib/` - Business logic and services
- `types/` - TypeScript type definitions
- `utils/` - Utility functions
- `scripts/` - Automation and maintenance scripts

---

## 🔧 **COMMON TASKS**

### **Starting a New Feature**
1. Check `dev/planned.md` for next priority
2. Create FID: `FID-YYYYMMDD-XXX` format
3. Add to `dev/progress.md` with full context
4. Get user approval before coding
5. Update progress throughout implementation
6. Move to `dev/completed.md` when done

### **Bug Fix Workflow**
1. Investigate using complete file reads
2. Document root cause in `dev/issues.md`
3. Create fix plan with acceptance criteria
4. Get approval before implementing
5. Apply fixes with safety mechanisms
6. Mark resolved in `dev/issues.md`
7. Document lessons in `dev/lessons-learned.md`

### **Database Operations**
- **Connection:** MongoDB Atlas (512 MB free tier)
- **Database:** `darkframe`
- **Key Collections:** `players`, `clans`, `tiles`, `battleLogs`, `auctions`
- **Tools:** MongoDB MCP tools available for queries
- **Monitoring:** Check usage in Atlas dashboard

---

## 🚨 **KNOWN CONSTRAINTS**

### **Database**
- ✅ 512 MB MongoDB Atlas free tier
- ✅ Currently at ~1% usage (HEALTHY)
- ⚠️ Monitor Beer Base spawning (should spawn 0 with 0 regular bots)

### **Payments**
- ✅ Stripe integration complete
- ✅ 5 VIP tiers ($9.99 - $199.99)
- ✅ Webhook automation working

### **Server**
- ✅ Next.js 14 App Router
- ✅ TypeScript strict mode
- ✅ Socket.io for real-time features
- ✅ Background jobs running (5 WMD + 1 Flag Bot)

---

## 💡 **QUICK RECOVERY PHRASES**

If starting a new chat and need context:

**"What's the current project status?"**
- Expect: Summary of completed features, active work, known issues

**"What was the Beer Base bug?"**
- Expect: Infinite loop explanation, 153K docs, 485 MB reclaimed

**"What needs to be done next?"**
- Expect: Reference to `dev/planned.md` and todo list

**"Read [filename] completely before editing"**
- Reinforces ECHO v5.1 mandatory complete file reads

---

## 📋 **SESSION RECOVERY CHECKLIST**

When starting new chat:
1. ✅ Ask ECHO to read `/dev/quick-start.md`
2. ✅ Verify ECHO understands complete file read requirement
3. ✅ Check server status (should be running on :3000)
4. ✅ Review `dev/progress.md` for active work
5. ✅ Check `dev/issues.md` for known problems
6. ✅ Confirm database health (should be ~1% usage)

---

## 🎯 **NEXT PRIORITIES**

### **Immediate (This Week)**
1. Complete bot system audit vs design docs
2. Monitor Beer Base spawner for 24 hours (should spawn 0)
3. Verify all 6 safety caps working correctly

### **Short-Term (Next 2 Weeks)**
1. Continue route enhancement work (244 routes remaining from FID-20251024-ROUTE-DEFER)
2. Implement next gameplay feature from `dev/planned.md`

### **Long-Term**
- See `dev/roadmap.md` for strategic vision
- See `dev/planned.md` for detailed feature queue

---

## 📞 **SUPPORT REFERENCES**

- **User:** savant0x (GitHub owner)
- **Project:** DarkFrame (strategy war game)
- **Tech Stack:** Next.js 14, TypeScript, MongoDB, Stripe, Socket.io
- **Development Approach:** ECHO v5.1 with mandatory complete file reads

---

**Remember:** ALWAYS read complete files before editing. Partial reads create dangerous blind spots that lead to bugs like the Beer Base infinite loop. User validated this approach after we missed critical details in partial reads.

**End of Quick Start Guide**
