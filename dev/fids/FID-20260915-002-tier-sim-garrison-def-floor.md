# FID-20260915-002: tier-mismatch simulation — synthesized garrison counters wired to the wrong stat

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260915-002-tier-sim-garrison-def-floor.md`
**ID:** FID-20260915-002
**Severity:** HIGH (synthesized-garrison raids were free wins at every tier mismatch)
**Status:** verified (closure on commit per G2)
**Created:** 2026-09-15

---

## 1. Summary

Per operator directive ("simulate the new combat scale across tier mismatches and flag any
matchmaking holes"), a simulation sweep (attacker tier × defender tier × power ratio, real
`resolveBattle` engine with `applyCasualties: false`, both defender profiles) is committed
as `scripts/simulateCombatTiers.ts`. Findings recorded in
`dev/audits/COMBAT-TIER-SIM-2026-09-15.md`.

**Flag 1 (CRITICAL, code-confirmed, fixed here):** the attack route's weight-class floor
(`GARRISON_STR_RATIO = 0.6 × attackerSTR`) inflated garrison **STR** — but the engine's
defender counter is `defenderDEF − attackerSTR/2` (`battleService.calculateDamage` receives
`totalDEF`; `battleService.ts:381`). Garrison STR never counters. The floor only padded
garrison HP, making raids *easier*: every fresh-synth cell resolved in 1–2 rounds at 0–9%
attacker losses, tier mismatch irrelevant. (The FID-20260914-002 comment mis-stated the
defender term as `defSTR` — corrected in code comments here.)

**Fix:** split the weight-class floor — `GARRISON_DEF_RATIO = 0.65` drives the counter
(`0.15 × attackerSTR` per round = DEF_RATIO − 0.5), `GARRISON_STR_RATIO = 0.2` pads the HP
pool. Same synthesis size algebra, same caps; one knob, two constants.

## 2. Remaining findings (recorded, NOT fixed — operator decisions)

- **Flag 2 (HIGH):** real regrown garrisons have no weight-class floor at all — measured
  0%-loss wins at 2.9× (T3 vs MID), 19.8× (T5 vs MID), 3.3× (T5 vs STRONG). Fix would
  extend the DEF floor to real garrisons as supplemental reinforcement; governs how
  profitable farming mature low bases remains.
- **Flag 3 (MEDIUM):** STR ≈ 2× DEF stall band still reaches the 100-round cap; recommend
  round-based min-damage escalation after round 30.
- **Flag 4 (INFO):** `BASE_RAID_BALANCE.md` tuning table predates the Phase-3 HP scale.

## 3. Verification (evidence)

- Sim sweep rerun post-fix: fresh-synth cells now 13–15% attacker losses (pre-fix 0–9%),
  round count varies 2→6 with defender tier; counter scales with the raider.
- `npm run lint` → 0 problems; `npx tsc --noEmit` → 0 errors; `npx vitest run` →
  794 passed / 1 skipped / 0 failed (no test pinned the old synth shape — confirmed by
  grep: zero references to the old constants in `__tests__/`).
- Audit document updated with pre/post-fix matrices:
  `dev/audits/COMBAT-TIER-SIM-2026-09-15.md`.

## 4. Files

- `app/api/combat/attack/route.ts` — floor split + honest formula comments
- `scripts/simulateCombatTiers.ts` — new (tier-mismatch sim, rerunnable)
- `dev/audits/COMBAT-TIER-SIM-2026-09-15.md` — new (findings + post-fix matrices)
- `CHANGELOG.md`, `SCOPE.md`, `dev/session-summaries/SESSION-2026-09-15-003.md` — bookkeeping
