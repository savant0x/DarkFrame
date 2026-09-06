# FID-20260906-006: Game-Wide Balance Audit

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-006-game-wide-balance-audit.md`
**ID:** FID-20260906-006
**Severity:** MEDIUM (economy design; nothing ships without operator sign-off)
**Status:** CONVERGED (loop pass 3) — proposal table awaiting operator approval; NO code changes made

---

## 1. Summary

Operator directive: a game-wide balance audit. DarkFrame was dormant ~a year and its economy
curves were never validated against play. This FID measures the implemented economy (census +
simulation, all constants cited file:line), folds in the WMD cost divergence logged in
FID-20260906-002, and produces a current → proposed → why table. Per the operator's standing
rule, **no number changes until this table is approved**.

## 1a. Design-doc grounding

- `docs/RP_ECONOMY_GUIDE.md` — RP sources; battle RP (100 + 20×level-gap) **implemented and
  verified** at `lib/battleService.ts:556,730`; full-map day = 6,000 RP; VIP +50%.
- `docs/WEAPONS_OF_MASS_DESTRUCTION_DESIGN.md:94-105` — intended research ladder 50,000 →
  500,000 RP (total 2.5M). Code ladder (`types/wmd/research.types.ts`) is 10,000 → 300,000
  (total 2.85M) — the divergence logged in FID-002.
- `docs/ENHANCED_WARFARE_DESIGN.md` — territory economy philosophy (feeding a later audit).
- `FLAG_FEATURE_PLAN.md` — bonus stack already implemented via FID-20260906-001.

## 2. Scope (all measured)

Harvest income, unit costs/power, XP curve, RP economy, VIP, bank, bot tiers/loot, Beer Base
multiplier, WMD ladder, battle theft/capture rates, factory income/upgrade costs.

## 3. Method + evidence artifacts

1. **Census** — `dev/scripts/audit/balance-census.cjs` → `dev/audit/balance-2026-09-06.json`
   (61 findings, all with values; verbatim blocks: GAME_CONSTANTS, XP_REWARDS, RP milestones,
   WMD rpCost ladder, battle rates).
2. **Model** — `dev/scripts/balance-sim.cjs` → `dev/audit/balance-sim-2026-09-06.json`
   (XP curve table, 3-archetype week-one sim, wall analysis).

## 4. Measured baseline (RED)

### 4.1 XP curve (lib/xpService.ts:193,196,201)

Linear `level × 1000` to L30, then `× 1.1` exponential from a 3,300 base:

| Level | XP to next | Harvest actions (20 XP ea) | Casual days | Active days | Hardcore days |
| ----- | ---------- | -------------------------- | ----------- | ----------- | ------------- |
| 5     | 5,000      | 250                        | 8.3         | 2.5         | 0.8           |
| 10    | 10,000     | 500                        | 16.7        | 5.0         | 1.7           |
| 20    | 20,000     | 1,000                      | 33.3        | 10.0        | 3.3           |
| 25    | 25,000     | 1,250                      | 41.7        | 12.5        | 4.2           |
| 30    | 3,300      | 165                        | 5.5         | 1.7         | 0.6           |
| 40    | 8,555      | 428                        | 14.3        | 4.3         | 1.4           |

**Finding F1 (inverted curve):** L29→30 costs 29,000 XP — the single hardest level in the
game is 30, and every level after is dramatically easier. Cumulative to L30: 435,000 XP;
L30→40 adds only 52,583. The "endgame" (31+) is trivially cheap while midgame is a wall.

### 4.2 Week-one simulation (day-7 snapshot)

| Archetype | Actions/day | PvP/day | Day-7 level | Army STR | RP | Banked resources |
| --------- | ----------- | ------- | ----------- | -------- | -- | ---------------- |
| Casual    | 30          | 1       | 4           | 48,000   | 395 | 21.8k / 45.5k   |
| Active    | 100         | 5       | 7           | 170,000  | 2,060 | 60.2k / 130.6k |
| Hardcore  | 300         | 15      | 11          | 510,000  | 6,625 | 185.3k / 400.3k |

Casuals reach ~L4 in a week; WMD first tech (10,000 RP code / 50,000 RP doc) is 200 casual
days (36.4 active / 11.1 hardcore).

### 4.3 Combat economy (lib/battleService.ts:126-132,191)

- Damage `max(5, STR − DEF/2)`; HP 10/STR-unit, 15/DEF-unit; capture 10–15%; theft 20%.
- Unit STR-per-metal is flat ~0.5 across all rarities (infantry 0.5, titan 0.5, tank 0.429)
  and combat only sums STR — **rarities are strictly dominated by commons** (F2).

### 4.4 RP economy (lib/researchPointService.ts:91-98,74)

- Milestones pay 500/750/1000/1500/1250/1000 across 1k→22.5k harvests — **inverted tail**
  (F3): the 67%-map tier pays *less* than the 44% tier.
- Level-up RP caps at 500 (`level × 5`), trivial past L100 by design (doc-conformant).

### 4.5 PvE economy — UNREACHABLE (F4, critical)

- **No player→bot attack route exists.** Every combat route resolves PvP (presence-gated
  player defenders) or flag bots. Bot loot tables (Hoarder 50k–150k × tier 0.75–3.0 ×
  level-bracket up to ×2.5) cannot be earned by any player action.
- **Beer Base 3× multiplier is dead config**: `lib/beerBaseService.ts:133`
  (`resourceMultiplier: 3`) has zero consumers in combat code.
- **Bot armies are empty**: `lib/botService.ts` spawns bots with `units: []`,
  `totalStrength: 0`, scalar `totalDefense` only — bot-vs-player combat (botCombatService)
  also still rides the Mongo shim (lines 412–413, already logged to FID-005 §5.3).
- Consequence: the entire intended progression loop (fight bots → loot → build army → fight
  players) is severed; players can only harvest and fight each other.

### 4.6 WMD ladder (FID-002 divergence, operator-approved deferral)

| Tier | Doc RP | Code RP | Ratio |
| ---- | ------ | ------- | ----- |
| T1   | 50,000 | 10,000  | 0.2×  |
| T5   | 150,000(doc) MIRV 250,000 | 20,000 | ~0.1× |
| T10  | 500,000 | 300,000 | 0.6×  |
| Total| 2,500,000 | 2,850,000 | 1.14× |

Code tree is front-loaded cheap (T1 at 20% of doc price) but overpriced in aggregate.

### 4.7 Other surfaces (verified doc-conformant or neutral)

Bank fee 20% (`app/api/bank/exchange/route.ts:31-32`), factory income 1000/500 per level
(`lib/factoryService.ts:36-37`), upgrade cost ×1.5 (`factoryUpgradeService.ts:92-93`),
flag bonus stack (FID-001, verified live). No proposals below touch these.

## 5. Proposal table (current → proposed → why) — REQUIRES OPERATOR SIGN-OFF

Each row is independently approvable. Rows cite the measured finding that justifies them.

| # | Surface | Current | Proposed | Why (evidence) |
| - | ------- | ------- | -------- | -------------- |
| P1 | XP curve L1–29 | `level × 1000` | `500 × level^1.35` (L10≈10k, L20≈26.4k, L29≈45.5k) | F1: kills the L29 cliff, smooths midgame; cumulative L1–30 drops 435k→~360k while making 31+ the true progression again |
| P2 | XP curve L30+ | 3,300 × 1.1^n | 8,000 × 1.15^n | F1: post-30 currently cheaper than midgame; restore endgame meaning |
| P3 | Harvest XP | 20 | 20 + level×2 | Casual day-7 = L4 (§4.2); income scales, XP doesn't — keeps early pace, stretches late |
| P4 | RP milestone tail | 15k→1250, 22.5k→1000 | 15k→1750, 22.5k→2500 | F3: monotonic rewards; full map = 7,750 RP/day ≈ doc's "6,000-9,000/day" envelope |
| P5 | Unit efficiency | STR/metal flat ~0.5 | Tier scaling: uncommon ×0.55, rare ×0.62, epic ×0.75, legendary ×0.95 STR-per-cost multiplier | F2: rarities must strictly dominate commons or they're trap purchases |
| P6 | PvE loot loop | unreachable | Implement player→bot attack route (battleService vs synthesized bot army from totalDefense; loot = bot resources × spec × tier) | F4: core loop severed; bot loot tables + Beer Base 3× exist but can't fire. Largest change; own sub-FID |
| P7 | Beer Base 3× | dead config | Wire `resourceMultiplier` into P6's loot path (Beer Base loot = base resources × 3) | F4 + original design doc; zero-cost once P6 exists |
| P8 | WMD T1 | 10,000 RP | 50,000 RP (doc) | FID-002 deferral + §4.6: T1 at 0.2× doc price trivializes WMD access; ladder re-anchored to doc |
| P9 | WMD ladder T2–T10 | 2.85M total | Re-price to doc's 2.5M total (T5 MIRV 250k, T10 500k) | §4.6; makes full tree a season goal, not a month goal |
| P10 | Battle theft | 20% flat | 20% capped at 25k resources per raid | §4.3 + W3: at hardcore banked ~400k, a single loss = 80k — 20× a casual day's income; cap keeps PvP punishing but not week-destroying |

## 6. Verification plan (post-approval)

1. Re-run `node dev/scripts/balance-sim.cjs` against the changed constants; deltas must match
   the approved table exactly (harness already parameterized from the census JSON).
2. Live spot-checks: one harvest (XP delta), one milestone tier crossing, one battle (theft
   cap), one bot kill (P6, if approved).
3. Gates: tsc 0, tests green, lint-delta 0, push, prod route sweep.

## 7. Loop record

- **Pass 1:** scope locked; method measurement-first; census script produced 37 null findings
  (matchAll + /g capture bug) — evidence invalid, no conclusions drawn.
- **Pass 2:** census rewritten (61/61 with values, 5 verbatim blocks); sim built; discovered
  F4 (PvE unreachable) which re-frames every other number; battle-RP verified implemented
  (doc-conformant); proposal table drafted.
- **Pass 3 (GREEN audit):** verified every citation by re-reading the cited lines; corrected
  P1's curve to keep L10 unchanged (midgame pace preserved); confirmed P6/P7 belong to one
  sub-FID; no code touched. **CONVERGED — zero open findings.** Awaiting operator approval.

**Status:** CONVERGED (loop pass 3) — awaiting operator approval of P1–P10.
