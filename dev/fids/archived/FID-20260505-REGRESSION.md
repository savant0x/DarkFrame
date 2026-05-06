# FID-20260505-REGRESSION: Factory System — New Defects from 20260504 Closure

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-20260505-REGRESSION           |
| **Date Created** | 2026-05-05                        |
| **Status**       | FIXED                             |
| **Priority**     | CRITICAL                          |
| **Phase**        | Code Complete / Awaiting Verification |

---

## Context

Post-closure of FID-20260504-FACTORY, the player reports ALL owned factories show 0 available slots and regeneration does not work. A fresh deep audit of the entire end-to-end system revealed 9 defects, including one CRITICAL filter inversion in the background job that causes the entire regen system to silently no-op.

---

## Issue: Background Regeneration Job Excludes Full Factories; Auto-Correction Leaves In-Memory State Stale

### Symptoms

- All factories show 0 available slots in UI
- Factories never recover used slots over time
- Background regen job reports "All factories at max capacity" or zero throughput
- Background regen job processes zero factories when `slots` column is stale (0 or old-scale value)

### Root Cause Analysis

The CRITICAL defect in `lib/jobs/factorySlotRegeneration.ts:127` uses filter `f.used_slots < f.slots` to select factories needing regeneration. This filter means "pick factories NOT at max capacity." But the regen job's purpose is to DECREASE `used_slots` (recover slots), which is needed precisely when factories ARE at max capacity or have any used slots at all. Factories with `used_slots > 0` are excluded from regen entirely, so they stay full forever.

Compounding: the auto-correction in status/list routes updates the DB `slots` column but fails to propagate the corrected value into the in-memory `Factory` object returned to the client. The response carries stale `slots` on the first read.

Attack capture writes `owner`, `used_slots=0`, and `last_resource_generation` but never writes the `slots` column. A factory captured with a stale `slots` value retains that stale value forever.

---

## Bugs Found (9 Total)

### 🔴 CRITICAL

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `lib/jobs/factorySlotRegeneration.ts` | 127 | Filter `used_slots < slots` excludes factories at max capacity — zero regen for full factories. Must be `used_slots > 0`. |

### 🟡 HIGH

| # | File | Line | Issue |
|---|------|------|-------|
| 2 | `app/api/factory/status/route.ts` | 73 | Auto-correction updates DB `slots` but does not propagate corrected `slots` into in-memory `factory` object |
| 3 | `app/api/factory/list/route.ts` | 104 | Auto-correction updates DB `slots` but does not propagate corrected `slots` into in-memory `factories[i]` object |
| 4 | `lib/factoryService.ts` | 346-349 | Attack capture does not write `slots` column — stale/broken `slots` persists after capture |

### 🟡 MEDIUM

| # | File | Line | Issue |
|---|------|------|-------|
| 5 | `lib/factoryService.ts` | 463 | `produceUnit` response message uses stale DB `factory.slots` instead of `getMaxSlots(factory.level)` |
| 6 | `app/api/factory/release/route.ts` | 61-71, 89-99 | Release does not reset `used_slots` to 0 — factory appears full to next owner until regen catches up |
| 7 | `lib/factoryUpgradeService.ts` | 297 | `getUpgradeProgress` has misleading ternary — `typeof invested === 'number'` inverted semantics (functions correctly by coincidence) |

### 🟢 LOW

| # | File | Line | Issue |
|---|------|------|-------|
| 8 | `components/FactoryManagementPanel.tsx` | 228 | Next-upgrade stats show hardcoded `+2` slots and `+0.1`/hr — should be `+500` and `+41.67` |
| 9 | `app/api/factory/abandon/route.ts` | 176, 188 | Docstring still says "All units produced at factory are deleted" but code does NOT delete units (per FID-20260504 fix) |

---

## Fix Plan

### Impact Matrix

| # | File | Change | Blast Radius | Risk |
|---|------|--------|--------------|------|
| 1 | `lib/jobs/factorySlotRegeneration.ts:127` | `f.used_slots < f.slots` → `f.used_slots > 0` | Background regen for all owned factories with used slots | LOW — corrects regen to spec |
| 2 | `app/api/factory/status/route.ts:73` | Spread `slots: levelCapacity` into factory object | Status endpoint response | LOW — corrects stale in-memory state |
| 3 | `app/api/factory/list/route.ts:104` | Spread `slots: levelCapacity` into factories[i] | List endpoint response | LOW — corrects stale in-memory state |
| 4 | `lib/factoryService.ts:346-349` | Add `slots: getMaxSlots(factory.level \|\| 1)` to capture update | Newly captured factories | LOW — ensures clean state on capture |
| 5 | `lib/factoryService.ts:463` | `factory.slots` → `getMaxSlots(factory.level \|\| 1)` | produceUnit response message | LOW — cosmetic fix |
| 6 | `app/api/factory/release/route.ts:61-71,89-99` | Add `used_slots: 0` to release update | Released factories | LOW — clean state for next owner |
| 7 | `lib/factoryUpgradeService.ts:297` | Restructure ternary for clarity | getUpgradeProgress display | LOW — cosmetic clarity |
| 8 | `components/FactoryManagementPanel.tsx:228` | `+2`→`+500`, `+0.1`→`+41.67` | Factory panel display | LOW — cosmetic fix |
| 9 | `app/api/factory/abandon/route.ts:176,188` | Update docstring to reflect no-unit-deletion | N/A | LOW — comment only |

### Verification Checklist

- [x] `npx tsc --noEmit` → 0 errors
- [ ] Background regen job processes factories with `used_slots > 0`
- [x] Auto-correction re-fetches from DB instead of patching in-memory state
- [x] Attack capture sets `slots` column on takeover
- [x] `produceUnit` response shows correct capacity via `getMaxSlots(level)`
- [x] Release sets `used_slots` to 0
- [x] FactoryManagementPanel next-stats show correct increments (+500/+41.67)
- [x] Abandon docstring matches actual behavior (units NOT deleted)
- [x] Regen job header docstring reflects 5000+ scale formula

---

## Notes

- The CRITICAL defect (#1) is a logic inversion dating back to the original implementation. The old small-scale formula (10-28 slots) masked this because `used_slots < slots` was always true in most scenarios. With the new 5000+ scale, full factories are common and the exclusion is catastrophic.
- The daily reset job (`lib/jobs/factoryDailyReset.ts`) resets `used_slots` to 0 daily, which is why some factories may temporarily recover. But between resets, background regen does nothing for full factories.
- This FID is a direct continuation of FID-20260504-FACTORY (CLOSED). That FID fixed scaling and deletion issues; this one fixes the regen logic and stale-state propagation.

