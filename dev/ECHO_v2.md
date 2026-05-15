# 🧠 ECHO v2.0: Unified Development System

> **Purpose:** Single, comprehensive development protocol. Merges the FID system, Perfection Loop, GUARDIAN self-monitoring, autonomous workflow, Flawless Implementation Protocol, and coding standards into one unified system.
> **Stack:** Next.js 16 + TypeScript 5.7 + Supabase (PostgreSQL) + Tailwind CSS
> **Instruction:** Read this first at every session start. Check `dev/fids/` for the active FID. Follow precisely. **The Push Gate is absolute.**

---

# 📑 NAVIGATION

| Section | Content |
|---------|---------|
| 1 | Core Philosophy & Three Laws |
| 2 | The Push Gate (Absolute Rule) |
| 3 | FID System & Lifecycle |
| 4 | The 7-Phase Execution Workflow |
| 5 | The Perfection Loop (Sub-Routine) |
| 6 | Flawless Implementation Protocol (12-Step) |
| 7 | GUARDIAN Protocol (Self-Monitoring) |
| 8 | Design System & Page Structure Standards |
| 9 | Code Quality Rules & Anti-Patterns |
| 10 | Operating Modes & Autonomy Levels |
| 11 | Emergency Procedures |
| 12 | Quick Start Checklist |

---

## 1. CORE PHILOSOPHY & THREE LAWS

Every session is a surgical operation on a highly interconnected codebase. One change in file A can break logic in file Z. The only way to solve this is with a protocol that forces full understanding before every change.

### The Three Laws

| # | Law | Directive |
|---|-----|-----------|
| 1 | **Read 0-EOF before touch** | Every file read completely before any edit. No exceptions. No skimming. No assumptions. |
| 2 | **Present before act** | Every change presented with impact analysis BEFORE implementation. No silent autonomous changes. |
| 3 | **Verify before proceed** | Every change verified with build/lint/test before moving on. No broken builds. |

**Additional Rule:** If you encounter ANY issue — even outside the current scope — flag it for guidance. Never skip past a problem because "it's not what we're working on."

### Quality Standards: "Perfection Over Convenience"

When evaluating an approach, ask:
1. Will this work for ALL cases, not just the common case?
2. Will this scale to 1000 users/requests, not just 10?
3. Will this survive a hostile attacker, not just an honest user?
4. Will this be maintainable in 2 years, not just today?
5. Does this set the standard for the industry, not just meet it?

If any answer is **no** → redesign until all answers are **yes**.

**Every line of code must be:** Correct, Safe, Complete, Clean, Tested, Discovery-based.

### Rule Priority Hierarchy

```
Priority 1: Safety & Security    → NEVER compromise
Priority 2: Complete File Reading → NEVER compromise
Priority 3: User Instructions    → Follow unless violates P1-P2
Priority 4: Quality Standards    → Maintain
Priority 5: Efficiency           → Apply when possible
```

---

## 2. THE PUSH GATE (Non-Negotiable & Absolute)

> **DEFAULT STATE: NO PUSH.**
> All work is staged and committed locally, but **never pushed to remote without explicit, session-specific approval.** This overrides any autonomous behavior. Even during overnight autonomous runs, the agent halts at `git commit` and awaits gate clearance.

### Push Gate Protocol

1. Complete all implementation, testing, documentation, and tracking updates.
2. Run final verification:
   ```bash
   npx tsc --noEmit        # TypeScript: 0 errors
   npm run lint            # Lint: 0 errors
   git status --short      # Review staged files
   git diff --stat         # Review change scope
   ```
3. Generate a pre-push report: metrics, changelog summary, commit hash, file diff stats.
4. Prompt user: `PUSH GATE: Ready to push <N> files. Approve? (y/N)`
5. If approved: `git push`
6. If declined/ignored: Changes remain committed locally. Session closes.

---

## 3. FID SYSTEM & LIFECYCLE

All work is tracked through FIDs (Fix Implementation Documents). Every FID has auditable history.

### Naming Convention
```
FID-YYYYMMDD-DESCRIPTION
```
Examples: `FID-20260508-BALANCE-V2`, `FID-20260508-PAGE-STRUCTURE`

### File Structure
```
dev/
+-- fids/
|   +-- FID-YYYYMMDD-DESCRIPTION.md    # Active FIDs
|   +-- progress.md                     # Current objective tracking
|   +-- archived/                       # Completed FIDs moved here
+-- CHANGELOG-INTERNAL.md               # Detailed session changelog
+-- SESSION-SUMMARY.md                  # Latest session report
+-- IMPLEMENTATION-TRACKER.md           # Feature/fix status
```

### FID Document Template

```markdown
# FID-YYYYMMDD-DESCRIPTION

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-...                            |
| **Date Created** | YYYY-MM-DD                         |
| **Status**       | OPEN / FIXED / CLOSED              |
| **Priority**     | CRITICAL / HIGH / MEDIUM / LOW     |
| **Phase**        | Current execution phase            |

## Context
## Issue / Plan
### Impact Matrix
| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `path/to/file` | What changes | What it affects | LOW/MED/HIGH |
## Verification Checklist
## Notes
```

### FID Lifecycle

| Status | Definition |
|--------|------------|
| `OPEN` | Issue identified, analysis in progress |
| `FIXED` | Code changes made, needs live test |
| `AWAITING VERIFICATION` | Awaiting test confirmation |
| `CLOSED` | Verified working, documented in changelog |

When CLOSED, move the FID from `dev/fids/` to `dev/fids/archived/`.

---

## 4. THE 7-PHASE EXECUTION WORKFLOW

```
SESSION WORKFLOW
  +-- Production Pass Protocol (per FID)
        +-- Phase 1: Initialization & Re-orientation
        +-- Phase 2: Planning & Approval Gates
        +-- Phase 3: Execution & Perfection Loop
        |     +-- Perfection Loop (per fix)
        |           +-- 1. Deep Audit
        |           +-- 2. Heuristic Enhancement
        |           +-- 3. Validation Strike
        |           +-- 4. Iterative Convergence
        |           +-- 5. Final Certification
        +-- Phase 4: Test Repair & Quality Verification
        +-- Phase 5: Documentation & Tracking Update
        +-- Phase 6: Commit & Push Gate
        +-- Phase 7: Session Summary
```

### Phase 1: Initialization & Re-orientation

1. Read last session summary (`dev/SESSION-SUMMARY.md`)
2. Read this ECHO v2.0 file
3. Read `dev/fids/progress.md`
4. Read the active FID file completely (0-EOF)
5. Read `dev/CHANGELOG-INTERNAL.md` (unreleased section)
6. Run baseline checks:
   ```bash
   npx tsc --noEmit
   npm run lint
   git log --oneline -10
   git status --short
   git diff --stat
   ```
7. If the FID references specific source files, read them **0-EOF**
8. Create a prioritized task list with HIGH/MEDIUM/LOW priority

### Phase 2: Planning & Approval Gates

1. Read every file referenced in the FID **0-EOF**
2. Trace the full signal path: input -> processing -> output
3. **Present to the user:**
   - Root cause analysis or implementation plan
   - Impact matrix (file, change, blast radius, risk)
   - Verification steps
   - Draft changelog entry
4. **HALT and wait for explicit approval. No code changes until approved.**

### Phase 3: Execution & The Perfection Loop

For each feature/fix, execute the **Perfection Loop** (see Section 5).

**Execution Rules:**
- One feature at a time. Complete -> verify -> document -> next.
- Never re-read a file you already read in this session (Anti-Loop Protocol).
- One edit per file per feature. Decide, act, move on.

### Phase 4: Test Repair & Quality Verification

```bash
npx tsc --noEmit        # TypeScript: 0 errors
npm run lint            # Lint: 0 errors
```

For each failure: read the failing test file, fix the code or fix the test (whichever is correct), re-run.

### Phase 5: Documentation & Tracking Update

| File | When | What |
|------|------|------|
| `dev/fids/FID-*.md` | During and after fix | Status -> FIXED or CLOSED, verification checklist |
| `dev/CHANGELOG-INTERNAL.md` | After EVERY fix | Detailed description with file paths, issue, approach |
| `dev/IMPLEMENTATION-TRACKER.md` | After every feature/fix | Status, progress |

**Changelog entry format:**
```markdown
### YYYY-MM-DD: Brief Description

**FID:** `FID-YYYYMMDD-DESCRIPTION.md`

**Problem:** What was broken

**Root Cause:** Why it was broken

**Fix:**
- `path/to/file` (+N/-M): What changed

**Status:** Code changes implemented / Awaiting test / Verified
```

### Phase 6: Commit & The Push Gate

Pre-commit checklist:
- [ ] `npx tsc --noEmit` passes (0 errors, 0 warnings)
- [ ] `npm run lint` passes (0 errors)
- [ ] All trackers updated
- [ ] No secrets or API keys in committed files
- [ ] No temporary files or build artifacts staged

Commit message format:
```
<type>: <short description>

<optional body with bullet points>
```
Valid types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

```bash
git add -A
git commit -m "<type>: <description>"
```

**HALT AT PUSH GATE. Do not push. Await explicit approval.**

### Phase 7: Session Summary

Create/update `dev/SESSION-SUMMARY.md`:
```markdown
# Session Summary -- YYYY-MM-DD

## Mission
<Brief description of what was asked>

## Status: COMPLETE

## What Was Done
| Item | Status | Details |
|------|--------|---------|
| Feature X | Complete | What was done |

## Tests
- Before: X passing, Y failing
- After: Z passing, 0 failing

## Git & Push
- Commit: <hash>
- Files changed: N
- Pushed: Yes/No (Gated)
```

---

## 5. THE PERFECTION LOOP (Sub-Routine)

The Perfection Loop is a 5-step cycle that elevates code from "functional" to "flawless." It runs on every feature, every fix, every refactor. **It is not optional.**

```
+-----------------------------------------------------+
|              PERFECTION LOOP                        |
|                                                     |
|  1. DEEP AUDIT                                      │
|     Read all target files 1-EOF                     │
|     Analyze for redundancy, debt, vulnerabilities   │
|     Output: list of improvements                    │
|          +                                          │
|  2. ENHANCE                                         │
|     Apply optimizations                             │
|     Improve error handling                          │
|     Constraint: no unwrap/todo/placeholder/as any   │
|          +                                          │
|  3. VALIDATE                                        │
|     Run verification (check, test, lint)            │
|     Must pass with 0 errors, 0 warnings             │
|          +                                          │
|  4. ITERATE                                         │
|     If improvements found -> return to step 1       │
|     If none found -> proceed to step 5              │
|     Max 5 iterations before flagging                │
|          +                                          │
|  5. CERTIFY                                         │
|     Report metrics (LOC, tests, quality)            │
|     Mark complete                                   │
|                                                     │
+-----------------------------------------------------+
```

### Step 1: Deep Audit
- Read ALL target files COMPLETELY (0-EOF) before any analysis
- Analyze every line for redundancy, tech debt, security vulnerabilities
- Verify compliance with project standards
- **Output:** A clear list of improvements before writing any code

### Step 2: Heuristic Enhancement
- Apply performance optimizations (batch operations, efficient data structures)
- Enhance error handling with context-rich logging
- Refine UI/UX with modern patterns
- **Constraint:** Do not introduce unwrap(), todo!(), unimplemented!(), `as any`, or placeholders. Ever.

### Step 3: Validation Strike
- `npx tsc --noEmit` -- 0 errors
- `npm run lint` -- 0 errors
- Verify unit and integration tests are written and passing
- **If any fail:** return to Step 2, fix, then re-validate

### Step 4: Iterative Convergence
- If Deep Audit or Validation identified improvements: implement immediately -> return to Step 1
- Track iteration count (e.g., "Perfection Loop: Iteration 2")
- If NO improvements identified: proceed to Step 5
- **Checkpoint:** If loop exceeds 3 iterations, reassess scope. If 5 iterations without convergence, flag for review.

### Step 5: Final Certification
- Report final metrics (LOC, files changed, tests passing, quality metrics)
- Include: iteration count, improvements made
- **Deliverable:** Final code, verification passes, updated documentation

### Termination Criteria

| Condition | Action |
|-----------|--------|
| Deep Audit yields ZERO actionable improvements | -> Certify |
| User explicitly requests to ship | -> Certify |
| 5 iterations reached without convergence | -> Flag for review |
| Diminishing returns detected | -> Recommend ship |

**Usage:** Trigger by stating "Run perfection", "Initiate perfection loop", or "AAA audit this module".

---

## 6. FLAWLESS IMPLEMENTATION PROTOCOL (12-Step)

**This is the PROVEN 12-step methodology that delivers FLAWLESS results EVERY time.**

When user says "proceed", "code", "yes" to implement a feature, execute EXACTLY these steps IN ORDER:

### Step 1: Read FID Completely
- Locate FID file: `dev/fids/[FID-YYYYMMDD-XXX].md`
- Read COMPLETELY: `read_file(path, 1, 9999)`
- State: "Read FID [name] completely ([X] lines)"
- Extract: scope, acceptance criteria, approach, files, dependencies

### Step 2: Legacy Analysis (if rebuilding existing feature)
- DISCOVER legacy files: `file_search` in `/old projects/politics/`
- READ ALL legacy files COMPLETELY (1-EOF)
- EXTRACT comprehensive feature list (all fields, logic, UI, API, validation, state)
- CREATE feature parity checklist table
- VERIFY ZERO OMISSIONS -- every legacy feature MUST appear in new implementation

### Step 3: Pattern Discovery
- FIND similar WORKING implementations in codebase via `file_search`
- READ 2-3 working examples COMPLETELY (1-EOF)
- EXTRACT patterns: component usage, types, hooks, auth, API
- DOCUMENT discovered patterns

### Step 4: Create Structured Todo List
- Break into 10-15 atomic tasks
- Order: Types -> Utils -> Models -> API -> Hooks -> Components
- Each task: specific file, clear deliverable, acceptance criteria
- Include TypeScript verification task

### Step 5-N: Execute Each Task in Order
For each task:
1. Mark task "in-progress"
2. Read target file(s) completely if modifying
3. Generate COMPLETE code (no placeholders)
4. Follow discovered patterns EXACTLY
5. Include full JSDoc, types, error handling
6. Mark task "completed" with LOC count
7. Report: "Task X complete: [file] ([LOC] lines)"

### Step N+1: TypeScript Verification (BLOCKING)
```bash
npx tsc --noEmit
```
- If errors: FIX ALL before proceeding
- Common fixes: Module not found -> check paths; Type mismatch -> use proper types; Property missing -> add to interface; `as any` -> replace with proper types
- Repeat until: **0 errors**

### Step Final: Completion Report
- Total LOC created
- Files created/modified
- TypeScript status (must be 0 errors)
- Feature summary
- Mark phase COMPLETE

### Why This Protocol Works -- Evidence from Production

| Phase | Method Used | Result |
|-------|-------------|--------|
| Manufacturing | Flawless Protocol | OK 8,000+ LOC, 0 errors |
| Consulting | Flawless Protocol | OK 3,466 LOC, 0 errors |
| Media (first attempt) | Skipped patterns | FAIL Hours of rework |
| Media (corrected) | Flawless Protocol | OK 3,400+ LOC, 0 errors |

**Key Success Factors:** Read FID first -> Legacy analysis -> Pattern discovery -> Structured todos -> Atomic tasks -> TypeScript check

**This protocol is now MANDATORY for ALL feature implementations.**

---

## 7. GUARDIAN PROTOCOL (Self-Monitoring)

GUARDIAN is ECHO's real-time self-monitoring and auto-correction system. It detects and fixes violations IMMEDIATELY.

```
BEFORE every tool call -> Pre-Execution Validation (prevent violations)
AFTER every tool call -> Post-Execution Audit (detect violations)
IF violation detected -> HALT + ANNOUNCE + AUTO-CORRECT + VERIFY
THEN continue -> Only after compliance verified
```

### GUARDIAN Activation Checklist (Execute AFTER EVERY Tool Response)

| # | Check | Auto-Correct |
|---|-------|--------------|
| 1 | File read completely (0-EOF)? | Re-read or batch load |
| 2 | File read before edit? | Read first |
| 3 | No `as any` type assertions? | Use proper types |
| 4 | Searched for existing code before creating? | Search first |
| 5 | No copy-paste duplication? | Extract utility |
| 6 | Tracking updated after fix? | Update now |
| 7 | Todo list for complex features? | Create todo |
| 8 | No pseudo-code/placeholders? | Complete code |
| 9 | Patterns followed from discovery? | Match existing |
| 10 | Verification run after edit? | Run check/test/lint |
| 11 | Tests written for new code? | Write tests |
| 12 | Sensitive data safe in logs/errors? | Remove/redact |
| 13 | Contract matrix generated for UI/API changes? | Execute dual-loading protocol |
| 14 | Index file created for new directories? | Create index.ts |
| 15 | Batch loading used for files >1000 lines? | Read in 500-line chunks |
| 16 | Legacy feature parity verified (if rebuilding)? | Read all legacy files |
| 17 | No duplicate Mongoose indexes? | One index per field |
| 18 | FLAWLESS PROTOCOL steps followed? | Execute missing steps |
| 19 | Page uses GameLayout wrapper (if page route)? | Wrap in GameLayout |
| 20 | Page uses synth palette (not old colors)? | Update to synth tokens |

### GUARDIAN Violation Detection & Auto-Correction

When GUARDIAN detects ANY violation:

```
ECHO VIOLATION DETECTED - Stopping immediately

[Specific violation description]

MANDATORY CORRECTION:
[Execute proper tool calls to fix violation]
```

**Example detections:** Partial file read -> re-read; Edit without reading -> read first; Missing code reuse discovery -> search first; DRY violation -> extract utility; Type safety shortcut -> use proper types; Missing contract matrix -> execute dual-loading protocol; Missing index file -> create index.ts; Missing auto-audit update -> update now.

### GUARDIAN Benefits
- **Instant Detection** -- Violations caught immediately, not after damage done
- **Automatic Correction** -- System fixes itself without user intervention
- **Zero Drift** -- Impossible to accumulate violations over session
- **Learning Pattern** -- Reinforces correct behavior through repetition

---

## 8. DESIGN SYSTEM & PAGE STRUCTURE STANDARDS

### 8.1 GameLayout Wrapper (All Pages)

All game-related pages MUST use the `GameLayout` wrapper component. The game provides a three-panel layout: left sidebar (stats), center tile view (content), right sidebar (controls).

**Canonical pattern (from `app/game/page.tsx`):**
```tsx
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

export default function SomePage() {
  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto">
            {/* Page content */}
          </div>
        }
      />
    </>
  );
}
```

For pages with existing `embedded` prop (tech-tree, wmd, profile, admin):
```tsx
if (embedded) return renderContent();
return (
  <>
    <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={renderContent()}
      />
  </>
);
```

**Acceptable as standalone (no GameLayout needed):**
- Auth pages (`/login`, `/register`)
- Post-payment confirmation/cancel pages (Stripe redirects)
- Dev/test pages

### 8.2 Synth Palette (All Pages)

All pages MUST use the synth palette design system. The old color system (glass/blur utilities, `bg-gray-900`, `bg-space-darker`, `text-neon-cyan`, gradient buttons) is deprecated.

**Old -> New mappings:**

| Old Pattern | Synth Replacement |
|-------------|-------------------|
| `bg-space-darker` | `bg-[--void]` |
| `bg-gray-900`, `bg-gray-950` | `bg-[--card]` or `bg-[--surface]` |
| `text-neon-cyan`, `text-neon-pink` | `text-[--neon-cyan]`, `text-[--neon-pink]` |
| `from-cyan-500 to-blue-500` gradients | `bg-[--neon-cyan]` or `bg-[--synth-purple]` |
| `shadow-[0_0_30px_rgba(0,240,255,0.5)]` | `shadow-glow-cyan` |
| `backdrop-blur`, `glass` utilities | Remove entirely |
| `border-white/10` | `border-[--border]` |
| `text-text-secondary`, `text-white/50` | `text-white/60` |
| `font-display` | Standard font |
| `hover:shadow-[0_0_30px_...]` | `hover:shadow-glow-cyan` or `hover:shadow-glow-pink` |

**Reference files:**
- `app/globals.css` -- CSS custom properties
- `tailwind.config.ts` -- Synth colors and glow shadows
- `components/ui/design.tsx` -- Shared design tokens (CARD, TABLE, BTN)
- `app/game/page.tsx` -- Canonical reference

### 8.3 Utility-First Architecture

**Build modular. Combine overlap. One function, one truth.**

```
BEFORE writing a new function:
1. Does a similar function already exist?
2. Does this new function overlap with an existing one?
3. Can the existing function be expanded to cover both cases?

IF yes to any -> expand the existing function. Don't duplicate.
IF two functions share logic -> combine into one universal function.
IF a pattern appears twice -> extract it into a shared utility.
```

**Implementation order:**
1. Types/Interfaces -> 2. Utilities/Helpers -> 3. Models/Schemas -> 4. Shared Components -> 5. Composed Components -> 6. Feature Pages

---

## 9. CODE QUALITY RULES & ANTI-PATTERNS

### Non-Negotiable Code Rules

| Rule | Rationale |
|------|-----------|
| No stubs (TODO, FIXME, not implemented) | Every feature must be fully functional |
| No `as any` type assertions | Use proper TypeScript types |
| No swallowed errors | Every Result propagated or handled explicitly |
| All error paths handled | No silent failures |
| Build stays clean | Zero errors, zero warnings after every edit |
| Discovery-based over hardcoded | Query system capabilities, don't assume |
| Search for existing code BEFORE creating new | Duplication kills maintainability |
| Follow discovered patterns EXACTLY | Inconsistency creates bugs |
| No unwrap() or expect() in non-test code | Use ?, match, or explicit error handling |
| No copy-paste duplication | Extract to shared utility |
| Update tracking after every feature | Lost progress |
| Never expose sensitive data in logs/errors | Security breach |
| Utility-first, universal logic | Duplication is debugging debt |

### Non-Negotiable Process Rules

| Rule | Rationale |
|------|-----------|
| Read 0-EOF before every edit | The codebase is complex and interconnected. Partial reads cause bugs. |
| Present before act | No autonomous changes without approval |
| Verify before proceed | Build check after every fix |
| Checkpoint gates | Approval between every fix group |
| Changelog every change | Track what was done and why |
| Flag everything | If you see an issue -- even outside scope -- flag it |

### Anti-Loop Protocol (Loop Guard)
- Never re-read a file you already read in this session
- Never re-check what you already know is true
- If you find yourself reading the same file twice -> **MOVE TO NEXT FEATURE**
- One edit per file per feature. If it compiles, move on.
- Never think more than once. Decide, act, move on.

### Anti-Patterns (Never Do These)

| Anti-Pattern | Why |
|--------------|-----|
| "The simplest approach" | We do enterprise-grade implementations |
| "Let me just quickly fix this" | Every change is surgical |
| Reading only the affected line | MUST read full file 0-EOF |
| Making changes without presenting | You are a partner, not a rubber stamp |
| Skipping verification | Broken builds cascade |
| Choosing speed over quality | We are never in a rush |
| Minimizing scope to reduce effort | We do it right, not fast |
| "Good enough" | Good enough is never good enough |
| Skipping an issue outside scope | Flag it for guidance |
| Pushing without approval | Hard violation of the Push Gate |
| Re-reading a file already read this session | Anti-Loop Protocol |

### Signal Path Tracing (For Debugging)

When investigating a bug, trace the FULL signal path end-to-end:
1. Identify the entry point (user action, API call, event)
2. Follow the data through every layer
3. Read every file in the path 0-EOF
4. Build a trace table:

| Step | Component | File:Line | Status |
|------|-----------|-----------|--------|
| 1 | Entry point | `file.ts:120` | Working / Broken |
| 2 | Middleware | `file.ts:45` | Working / Broken |
| 3 | Handler | `file.ts:310` | Working / Broken |

5. Identify the exact step where the signal dies. Present the full trace.

**When You're Stuck:**
1. Read the file you're modifying -- ALL of it
2. Read imports & understand types
3. Search for similar patterns in the codebase
4. Check tests for usage examples
5. If still stuck, mark as `BLOCKED` in the FID and move on
6. **NEVER guess.** If unclear, ask for guidance.

### Common Fix Patterns & Debugging Strategies

**Path Validation (prevent traversal):**
```typescript
if (!user_input.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')) {
  return Err("Invalid input");
}
```

**Async-Safe Error Handling:**
```typescript
match some_function().await {
  Ok(v) => v,
  Err(e) => { tracing::error!("Failed: {}", e); return Err(e.into()); }
}
```

**Atomic Writes (write-before-delete):**
```typescript
insert_new_entries()?;   // If this fails, old data is intact
delete_old_entries()?;   // If this fails, duplicates exist temporarily
```

**Discovery-based Configuration:**
```typescript
fn context_window(&self) -> Option<usize> {
  self.cached_context_window  // Query actual system capabilities
}
```

**Ephemeral Secrets (runtime-only, no persistence):**
```typescript
fn generate_ephemeral_secret() -> String {
  let mut hasher = blake3::Hasher::new();
  hasher.update(uuid::Uuid::new_v4().as_bytes());
  hasher.finalize().to_hex().to_string()
}
```

### Testing Requirements

| Complexity | Unit Tests | Integration | Coverage |
|------------|------------|-------------|----------|
| 1-2 | Optional | None | N/A |
| 3 | Core functions | Endpoints | 60% |
| 4 | All functions | Full flows | 80% |
| 5 | Comprehensive | E2E | 90% |

### Scale Adaptation

| Size | Files | Adaptation |
|------|-------|------------|
| Small | <20 | Standard protocol |
| Medium | 20-50 | Targeted loading |
| Large | 50-200 | Domain-focused |
| Enterprise | >200 | Component-isolated |

Files >2000 lines: batch load in 500-line chunks. Consider decomposition.

### Backend-Frontend Dual-Loading Protocol (Contracts First)

**MANDATORY when task touches UI or API:**

- **Find counterparts:** For every frontend target, locate its backend source of truth (REST handlers, DB schemas, service modules)
- **Read both sides completely:** Load frontend and the exact backend counterparts in full before any edits
- **Extract contracts:** Identify request/response shapes, event names/payloads, status codes, error formats, and side effects
- **Match explicitly:** Compare frontend usage vs backend definition; resolve discrepancies before coding
- **Report a Contract Matrix (in chat):**

| Endpoint/Event | Method/Name | Request | Response | Errors | Notes |
|----------------|-------------|---------|----------|--------|-------|

- **Dynamic batching:** <=1800 LOC combined per batch; 3-10 files per batch; <=4 distinct API surfaces per batch

---

## 10. OPERATING MODES & AUTONOMY LEVELS

| Level | Description | Push Behavior |
|-------|-------------|---------------|
| **Level 1: Guided** (User Present) | Ask before each major change. User approves each commit. | Local commit only. Push requires explicit `y` at gate. |
| **Level 2: Supervised** (User Available) | Work independently but pause at decision points. | Local commit only. Push requires explicit `y` at gate. |
| **Level 3: Autonomous** (User Away) | Work completely independently. Make all decisions, implement, test, document. | Local commit only. Push HALTS at gate until user returns or pre-clears. |

**Granting Level 3:** User says "I'm granting full autonomy. Work through the todo list, but respect the push gate."

**Agent behavior after grant:** Create comprehensive todo list -> Work through each item independently -> Fix any issues encountered -> Update all documentation -> Commit locally -> **STOP AT PUSH GATE** -> Create session summary.

---

## 11. EMERGENCY PROCEDURES

### If Build Won't Fix
1. Read the error message carefully
2. Check recent changes for typos or missing imports
3. Isolate to specific module/package
4. If stuck, `git checkout` the file and try a different approach

### If Looping Detected
If you've read the same file 2+ times or made the same edit 2+ times:
1. STOP immediately
2. Mark current feature as `PENDING`
3. Move to next feature
4. Come back later with fresh context

---

## 12. QUICK START CHECKLIST

When starting a new session:

- [ ] Read `dev/SESSION-SUMMARY.md` (last session)
- [ ] Read this ECHO v2.0 file (lines 1-END, fresh context)
- [ ] Read `dev/fids/progress.md` (current objective)
- [ ] List `dev/fids/` to find active FID(s)
- [ ] Read the active FID completely (0-EOF)
- [ ] Read `dev/CHANGELOG-INTERNAL.md` (recent changes)
- [ ] Run baseline build check (`npx tsc --noEmit`, `npm run lint`)
- [ ] Run `git status --short` (current state)
- [ ] Present findings and plan to user
- [ ] Wait for approval before any code changes
- [ ] Execute fixes through the Perfection Loop
- [ ] Run full verification
- [ ] Update FID status and changelog
- [ ] Commit (do NOT push)
- [ ] Create session summary
- [ ] Prompt user at Push Gate

---

*This document supersedes all prior standalone workflow files (ECHO v1.3.4, SAVANT-CODING-SYSTEM v0.0.2, AUTONOMOUS-WORKFLOW v2.0, FID-SYSTEM-PORTABLE, perfection_loop). It contains the complete Perfection Loop, Flawless Implementation Protocol, GUARDIAN self-monitoring, FID lifecycle, design system standards, quality standards, and the absolute Push Gate protocol. Follow it precisely. Perfection is the standard. The Push Gate is absolute.*
