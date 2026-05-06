# FID-20260505-BALANCE: Restore Army Balance System — Missing Balance Multiplier in Power Display

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-20260505-BALANCE              |
| **Date Created** | 2026-05-05                        |
| **Status**       | OPEN                              |
| **Priority**     | HIGH                              |
| **Phase**        | Audit Complete / Awaiting Approval |
| **Related FIDs** | FID-20251017-020 (Multi-Layered Balance System with Combat Penalties) |

---

## Context

The army balance system was designed and implemented under FID-20251017-020 as a 4-tier STR/DEF balance enforcement mechanic. The current `StatsPanel.tsx` displays raw `totalStrength + totalDefense` as "Effective Power" without applying the balance multiplier from `calculateBalanceEffects()`. The old `StatsPanel_OLD.tsx` properly showed `balanceEffects.effectivePower`, `BalanceIndicator`, penalty warnings, and bonuses. These elements were lost during the Supabase migration refactor.

---

## Issue: "Effective Power" Shows Raw STR+DEF, Not Balance-Adjusted

### Symptoms
- Military Power section shows raw STR + DEF sum (e.g., 100 STR + 50 DEF = 150 power)
- No balance penalty applied (should be 50% penalty → 75 effective power at CRITICAL)
- No balance status indicator (CRITICAL/IMBALANCED/BALANCED/OPTIMAL)
- No `BalanceIndicator` visual bar
- No penalty warnings or bonus messages
- No recommendation text (e.g., "Build X more DEF for balanced army")

### How It Should Work (per FID-20251017-020)

**Formula:** `ratio = min(STR, DEF) / max(STR, DEF)`

| Tier | Ratio | Power Multiplier | Example (100 STR, 50 DEF) |
|------|-------|-----------------|---------------------------|
| CRITICAL | < 0.7 | 0.5× | 150 → **75** effective |
| IMBALANCED | 0.7–0.85 | 0.8× | 150 → **120** effective |
| BALANCED | 0.85–1.15 | 1.0× | 150 → **150** effective |
| OPTIMAL | 0.95–1.05 | 1.1× | 150 → **165** effective |

### Root Cause

`StatsPanel.tsx` line 64 computes `effectivePower` as:
```typescript
const effectivePower = useCountUp(
  (player?.totalStrength || 0) + (player?.totalDefense || 0),
  { duration: 1500 }
);
```

The old `StatsPanel_OLD.tsx` used the same raw value for the animated counter line but then showed `player.balanceEffects.effectivePower` with color-coded status in the balance effects section. The current panel never reads `player.balanceEffects`.

---

## Fix Plan

### Restore from `StatsPanel_OLD.tsx` (lines 276-348)

The old panel had a conditional block that rendered when `balanceEffects` was present AND total army power > 0. This block contained:
1. **Effective Power** — `balanceEffects.effectivePower` with color-coded status and multiplier percentage
2. **BalanceIndicator** — visual STR/DEF ratio bar
3. **Active Penalties** — Warning messages (red box)
4. **Bonuses** — Bonus messages (yellow box, non-BALANCED statuses)
5. **Recommendation** — Text suggesting how to balance army (blue box)

### Implementation

| # | File | Change |
|---|------|--------|
| 1 | `components/StatsPanel.tsx:64` | Replace raw `str + def` with `player.balanceEffects?.effectivePower ?? (str + def)` for `effectivePower` |
| 2 | `components/StatsPanel.tsx:397-408` | Expand existing `balanceEffects` conditional to include full balance block from OLD panel |
| 3 | `components/StatsPanel.tsx` | Import `BalanceIndicator` from `@/components` |
| 4 | `components/StatsPanel.tsx:361-393` | Fix STR/DEF percentage badges — currently use wrong ratio logic (`> 1.2`, `< 0.8` don't match `balanceService` thresholds) |

### Verification Checklist
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Effective Power shows balance-adjusted value (not raw STR+DEF)
- [ ] CRITICAL army shows 0.5× effective power in red
- [ ] BALANCED army shows 1.0× in green
- [ ] OPTIMAL army shows 1.1× in gold
- [ ] BalanceIndicator bar renders with correct proportions
- [ ] Penalty warnings show for CRITICAL/IMBALANCED
- [ ] Recommendation text suggests corrective action
- [ ] STR/DEF percentage badges use correct thresholds (matching `balanceService.ts`)

---

## Notes
- `balanceService.ts` (304 lines) and `BalanceIndicator.tsx` (124 lines) are fully implemented and correct — they just need to be wired back into the StatsPanel display
- `combatPowerService.ts` (87 lines) extends balance effects with clan/discovery/specialization bonuses — separate from the Military Power display which should show just the balance-adjusted power
- `player.balanceEffects` is computed in `app/api/player/route.ts` (line 46-49) and included in the API response (line 71) — it IS available to the frontend via `player.balanceEffects`
- FID-20251017-020 was marked COMPLETED on 2025-10-17 — this FID restores the UI that was lost during the Supabase migration refactor
- Date of audit: 2026-05-05. All files read 0-EOF per ECHO standards.

