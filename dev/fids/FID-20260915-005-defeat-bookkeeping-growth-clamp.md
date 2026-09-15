# FID-20260915-005: defeat bookkeeping precision + growth clamp

**Severity:** MEDIUM · **Status:** implemented · **Created:** 2026-09-15

## Summary

Two refinements from the bot-vault economy audit (row 44), shipped together:

1. **Defeat bookkeeping zeroed both stockpiles regardless of what was looted.**
   The raid win path set `resourcesMetal: 0, resourcesEnergy: 0` on the defeated
   bot, even when the raid's declared resource took only one. A declared-metal
   raid destroyed the bot's untouched energy reserve for nothing.
2. **The growth cycle wrote above the vault cap.** The regen step clamps to
   `2 × spawner max`, but the subsequent 70/20/10 growth step (up to ×1.15)
   wrote its result uncapped — vaults idled 1–15% over cap until the next
   tick's regen clamp re-applied.

## Fix

- `app/api/combat/attack/route.ts`: defeat write zeroes `resourcesMetal` iff
  `lootMetal > 0`, `resourcesEnergy` iff `lootEnergy > 0` (mirroring the loot
  rule: declared resource or both when undeclared). Untouched stockpiles keep
  their value.
- `lib/botGrowthEngine.ts`: new exported pure helper `nextGrownVault(grown,
  regenerated, cap)` → clamped value or `null` (no-op skip); the growth write
  in `runGrowthCycle` goes through it.

## Evidence

- 10 contract tests (`__tests__/api/combat/defeatBookkeeping.test.ts`,
  raidLogFidelity mirror style): declared-metal/energy preserve, undeclared
  wipes both, over-cap capped loot still zeroes, empty stockpile no phantom
  write, clamp shapes incl. the regenerated-at-cap no-op case and the float
  floor (180k × 1.15 → 206999).
- Full gates: tsc 0 · lint 0 · vitest 807/1 skipped.
- Note: under the current exponential regen the zeroing asymmetry self-heals
  poorly (absorbing zero — audit B1); the linear-regen fix (open decision,
  row 44) makes the preserved stockpile durable either way.
- **Live confirmation (2026-09-15):** fame's declared-metal raid on hoarder
  Marauder_Control zeroed only the metal stockpile — the bot's energy
  (307,500) survived the defeat intact, then regrew 307,500 → 347,220 →
  395,735 toward its 450,000 cap under FID-006 linear regen. Driver kept
  permanent: `scripts/e2eHoarderJackpot.ts`.

## Status

Implemented, uncommitted — pending commit with the session's next stream.
