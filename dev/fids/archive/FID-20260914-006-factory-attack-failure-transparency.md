# FID-20260914-006: "factory attack always fails, 0 dmg / 0 defense" — audit + failure-transparency fix

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260914-006-factory-attack-failure-transparency.md`
**ID:** FID-20260914-006
**Severity:** MED (combat math healthy; failure display opaque and misleading)
**Status:** verified
**Created:** 2026-09-14

---

## 1. Summary

Operator report: factory attacks "always fail" showing `ATTACK FAILED · DMG ▸ 0 · Damage
dealt 0 · Factory defense 0`. A deep audit of the full flow (`app/game/page.tsx` handlers →
`app/api/factory/attack/route.ts` → `lib/factoryService.attackFactory` → presence/bonus
gates → combat roll) found the **combat math healthy** and the **failure display broken**:

- The client's FID-20260911-041 failure branch **hardcodes `playerPower: 0, factoryDefense: 0`**
  for every failure shape — a genuine combat miss (which the server reports WITH its real
  power/defense), a 5-minute cooldown rejection, and a presence 403 all render identically
  as 0/0. Cause-opaque by construction.
- The server log for the reporting session shows the actual history: two real rolls at
  **90% success chance** (power 2,272,610 vs defense 1,000 — capped) that both missed
  (a 1% double-miss), then a third attempt hitting the 5-minute cooldown lockout. The
  "always fails" experience = small-sample luck + cooldown lockout + a display that hides
  the true odds.

## 2. Audit evidence (all measured this session)

| Check | Method | Verdict |
| --- | --- | --- |
| Combat math | Live experiment: fresh account, power 50,110 vs L1 factory, real route, 15 attempts | First roll captured (expected ~90%); subsequent "already control" correctly rejected |
| Failure payload honesty | Live experiment: weak attacker (110 vs 1000 → 11%), sampling misses | 2/2 genuine misses returned `playerPower=110, factoryDefense=1000` — real numbers the client was discarding |
| Presence gate | `lib/presenceCheck.ts` reads DB position; attacker's moves DO persist (`/api/move` writes `current_position_*`; probe: fame at 43,108 ≠ stale) | Healthy |
| Power calc | `calculatePlayerPower` = 100 + rank×10 + `totalStrength` + inventory×50; fame = 2,272,610 ✓ | Healthy |
| Historical successes | `factories` rows: three bot-owned factories captured through the same function | Path works |
| `Math.random` tampering | repo grep | None |

Cleared suspicions: presence gating (position persists), zero-power math, legacy
`units` collection dependence (this flow reads `players.totalStrength`, not units).

## 3. Defect & fix

| Severity | Defect | Fix |
| --- | --- | --- |
| MED | Both `handleAttack` (factory) and `handleBaseAttack` (base raid) failure branches hardcode 0/0, discarding the server's real numbers and making every failure identical | Preserve server values: factory handler reads `data.playerPower`/`data.factoryDefense` when numeric; base handler mirrors its success path (`data.battle?.attacker/defender?.damageDealt`). Verbatim rejection messages (FID-041) unchanged |

## 4. Verification

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test:ci` | 763 passed / 1 skipped / 0 failures (unchanged baseline) |
| Live: success roll | captured on first attempt at 90% chance (15-attempt experiment) |
| Live: failure payload | real numbers on 2/2 genuine misses; rejections correctly carry none |
| Scratch scripts | all deleted after use (evidence preserved here) |

## 5. Residual notes (not approved, recorded)

- The roll is pure `Math.random()` per attempt with no pity/streak protection — miss
  strings at 90% are possible; with honest numbers now displayed, the player can see it.
- Cooldown rejections could get a distinct UI state (disabled button with countdown) —
  UX enhancement, out of scope here.
- The DMG chip (`damageDealt ?? 0`) remains a future-PvP field per the type contract.

## 6. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] live-verified both directions
- **Commit hash (G2):** `4237f51` (umbrella multi-stream commit, 2026-09-15; pre-merge hash — canonical: PR #41)
- **Staging plan:** `app/game/page.tsx`, this FID, `SCOPE.md`, `dev/session-summaries/SESSION-2026-09-14-007.md`

---

**Final status:** closed (commit `4237f51`, pre-merge hash; canonical: PR #41)
