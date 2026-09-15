# FID-20260914-007: profile combat record unwired (zeros forever) + infantry battle system review

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260914-007-profile-battle-stats-and-infantry-review.md`
**ID:** FID-20260914-007
**Severity:** MED (profile showed false zeros; infantry system partially wired)
**Status:** verified
**Created:** 2026-09-14

---

## 1. Summary

Operator report: the profile page's "Battle Statistics / Lifetime Combat Record" renders
all zeros, and the infantry battle system "was never wired."

Audit findings, both confirmed with evidence:

1. **Profile zeros (FIXED):** the panel renders `profileData.battleStats`, sourced from the
   `players.battle_stats` jsonb column — which **no code ever wrote** (repo-wide census:
   zero writers; fame's column value: `null`). The truthful lifetime record already
   existed in `battle_logs` (24 base raids, 2 infantry battles at audit time), so the
   profile now computes it live.
2. **Infantry system (REVIEW):** the battle engine (`executeInfantryAttack`,
   `app/api/combat/infantry`) is **live and session-hardened** — but its only client
   caller is the **auto-farm engine** (`utils/autoFarmEngine.ts` `attackBase` →
   `POST /api/combat/infantry`, matching dev/architecture.md §Combat Integration).
   The manual UI (`components/CombatAttackModal.tsx`) is exported but **rendered
   nowhere**, and its second endpoint (`/api/combat/base`) **does not exist**.

## 2. Ground truth (measured this session)

| Check | Result |
| --- | --- |
| `battle_stats` writers census | zero (schema + playerService pass-through only; fame: `null`) |
| `battle_logs` at audit | 21 ATTACKER_WIN + 3 DEFENDER_WIN `BASE_RAID`; 2 `INFANTRY` |
| fame's computed record | infantry 2/2/0 · base attacks 17/15/2 · defenses 0 — cross-checked against the logs |
| `/api/combat/infantry` callers | auto-farm engine only (manual modal orphaned) |
| `/api/combat/base` | does not exist (modal references it) |
| Public profile page | rendered battleStats as raw JSON — now a real panel |

## 3. GREEN (implemented)

| # | Item | Detail |
| --- | --- | --- |
| 1 | `lib/battleStatsService.ts` | Single-aggregate lifetime record from `battle_logs` (FILTER clauses): infantry initiated/won/lost (viewer as attacker), base attacks (BASE_RAID + legacy BASE_ATTACK label), base defenses (viewer as defender; total/won/breached). Losses derived (initiated − won) so draws resolve as defeats — the battle-logs viewer's own semantics |
| 2 | `app/api/player/profile/route.ts` | `battleStats` = live-computed record (was: unwritten column → zero default) |
| 3 | `app/api/profile/[username]/route.ts` | Same computation for the public profile |
| 4 | `app/profile/[username]/page.tsx` | Raw-JSON "Combat Record" section → real three-well panel mirroring ProfileView |
| 5 | `__tests__/lib/battleStatsService.test.ts` | 6 tests: loss derivation, empty-history defaults, null-field defensiveness, corrupt-data clamping (wins > fights → lost clamps at 0), username bound per FILTER clause, panel mapping |

## 4. Infantry battle system review — findings and options (NOT implemented)

Status: the system WORKS and is reachable, but only via auto-farm; there is no manual
player-facing infantry attack.

| Finding | Detail | Options |
| --- | --- | --- |
| Manual UI orphaned | `CombatAttackModal` (unit selection → `/api/combat/infantry`) is exported in `components/index.ts` but rendered by no page | Render it from a tile/bot-base action (operator decision on placement/UX) |
| `/api/combat/base` missing | The modal's base-attack branch targets an endpoint that never existed | Either implement it or strip the branch (base raids already flow through `/api/combat/attack`) |
| Doc drift | dev/architecture.md documents the auto-farm → combat/infantry wiring accurately; the never-written `battle_stats` column and the orphaned modal suggest a partially-completed 2025-10 feature wave | Record of truth updated by this FID |

## 5. Verification

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test:ci` | **769 passed / 1 skipped / 0 failures** (+6 battleStatsService tests) |
| Live `/api/profile/fame` | truthful record returned (2/2/0 infantry · 17/15/2 base attacks · 0 defenses), matching battle_logs aggregates exactly |
| Service suite | 6/6 |
| Scratch probes | deleted after use |

## 6. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass (769/1 skipped/0 fail) · [x] live-verified
- **Commit hash (G2):** `4237f51` (umbrella multi-stream commit, 2026-09-15; pre-merge hash — canonical: PR #41)
- **Staging plan:** `lib/battleStatsService.ts`, `app/api/player/profile/route.ts`,
  `app/api/profile/[username]/route.ts`, `app/profile/[username]/page.tsx`,
  `__tests__/lib/battleStatsService.test.ts`, this FID, `SCOPE.md`,
  `dev/session-summaries/SESSION-2026-09-14-008.md`

---

**Final status:** closed (commit `4237f51`, pre-merge hash; canonical: PR #41)
