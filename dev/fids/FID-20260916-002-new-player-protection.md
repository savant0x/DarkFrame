# FID-20260916-002: New-player protection window

**Filename:** `FID-20260916-002-new-player-protection.md`
**ID:** FID-20260916-002
**Severity:** MEDIUM
**Status:** verified
**Created:** 2026-09-16

---

## 1. Summary

There is no new-player protection: `players.protection_until` exists in schema but nothing in the codebase writes it, the only reader (`validateTargeting`) checks a column that is always NULL, and the PvP / base-raid / factory-capture paths have eligibility gating of any kind — only damage mitigation (level-gap formula). Implement a time-boxed protection window set at registration, enforced on all player-vs-player attack surfaces, expiring early on aggression.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | Column exists, never written | `lib/db/schema/players.ts:101` | `protectionUntil: timestamp('protection_until')`; repo-wide grep for writes → zero hits (only the schema line + one read) |
| 2 | Sole reader checks a dead column | `lib/wmd/targetingValidator.ts:37-39` | `if (target.protectionUntil && new Date(target.protectionUntil) > new Date()) { errors.push('Target is under protection'); }` — always NULL, always passes |
| 3 | Registration does not set it | `lib/playerService.ts:431-460` | `createPlayerWithAuth` builds `newPlayer` without `protectionUntil`; insert at :460 |
| 4 | No eligibility gating on PvP surfaces | `app/api/combat/attack/route.ts`, `app/api/combat/infantry/route.ts`, `app/api/factory/attack/route.ts` | no level/protection checks found (only WMD has a level-10 floor, `targetingValidator.ts:41`) |
| 5 | Not in the domain type | `types/game.types.ts` | grep `protectionUntil` → zero hits; the validator reads the raw `PlayerRow`, not `Player` |
| 6 | No design doc describes it | `docs/*`, `dev/*.md` | grep `new-player protection\|spawn protection\|grace period\|protection window` → zero hits |
| 7 | Mitigation ≠ eligibility (what exists today) | `lib/battleService.ts:209-231` | level-gap damage scaling past a 20-level gap — softens stomps, does not prevent them |

Call-graph notes (Law 4): attack entry points are `POST /api/combat/attack` (base raids), `POST /api/combat/infantry` (PvP), `POST /api/factory/attack` (capture), and the WMD launch path (already gated by `validateTargeting`, which comes alive automatically once the column is written). Registration entry is `POST /api/auth/register` → `createPlayerWithAuth` (`lib/playerService.ts:421`).

## 3. Impact Analysis

- **Who/what is affected:** new registrants (retention — day-1 stomps end runs before tutorial value lands); attackers (one more refusal branch with a server reason); no economy/data migration (column exists).
- **Failure modes if built wrong:** protection as a shield for aggression (smurf farms risk-free, then hides) — must expire on outgoing PvP; permanent-safe accounts if expiry never fires — must be time-derived (`protectionUntil < NOW()`), never a flag that can stick; UI confusion if the client cannot see remaining time (expose on the sanitized player or a dedicated field — UI itself is operator-owned, this FID only exposes data).
- **Blast radius of the fix:** 1 insert site, 3 enforcement sites (+WMD free), 1 type addition, 1 sanitizer decision, unit + route tests. No schema change.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | yes — timer-derived expiry cannot stick; aggression-expiry closes the shield vector; every surface verified in the pass-1 surface census (combat/attack proved bots-only, so players are structurally unreachable there) |
| Scales (design tolerates growth; harness reference is 1000 agents)? | yes — one timestamp comparison per attack, indexed username lookup already on the path |
| Survives a hostile attacker, not just an honest user? | yes — server-side checks on every surface (no client trust); early-expiry on outgoing attacks defeats shield abuse; clock is server time |
| Maintainable in 2 years? | yes — single constant + pure predicate, unit-pinned |
| Sets the standard for the industry? | yes — transparent, data-exposed, abuse-closed protection instead of hidden immunity flags |

## 5. Proposed Fix (GREEN)

- **Approach:** write the dormant column at registration; refuse protected targets on every PvP surface with a server reason; clear the window when the protected player attacks.
- **Defaults (operator-tunable, flagged as decisions not facts):** `PROTECTION_WINDOW_HOURS = 72` (covers tutorial + first base build); aggression voids the window; expiry is purely `protectionUntil <= now` (no boolean to stick).
- **Alternatives considered:** (a) level-gated immunity (e.g. untouchable below level 10, mirroring the WMD floor) — rejected: level pace varies, timer is uniform and self-cleaning. (b) opt-out flag — rejected: sticky-flag failure mode. (c) damage-only mitigation (status quo) — rejected: finding #7, does not prevent stomps.
- **Changes:**

| File | Action (create/modify/delete) | Description |
| ---- | ----------------------------- | ----------- |
| `lib/playerService.ts` | modify | `createPlayerWithAuth`: set `protectionUntil = now + PROTECTION_WINDOW_HOURS` on the insert row |
| `lib/playerProtection.ts` (new) | create | `PROTECTION_WINDOW_HOURS` const + pure `protectionActive(until, now)` + `voidProtectionOnAggression` helper; unit-pinned |
| `types/game.types.ts` | modify | add `protectionUntil` to `Player` (nullable date) |
| `lib/playerSanitize.ts` | modify | decision: expose remaining protection on the sanitized player (needed for any client display; UI work itself is operator-owned) |
| `lib/battleService.ts` (or route-adjacent service) | modify | refuse `combat/infantry` vs protected targets (server reason); clear attacker's own window on outgoing PvP. **Pass-1 correction:** `combat/attack` is NOT an enforcement site — it refuses non-bot targets outright (`app/api/combat/attack/route.ts:257-259` `if (!base.isBot) → 'Target is not a hostile base'`), so player bases are structurally unreachable there; no gate needed |
| `app/api/factory/attack` path | modify | same refusal for factory capture vs protected owners |
| `app/api/flag/*` (challenge/claim) | none (decision) | **Pass-1 decision (operator-tunable):** flag steal channels are EXEMPT from protection — the flag is an opt-in global event; carrying it is continuous exposure, the old damaging `flag/attack` route no longer exists (challenge/claim flow damages no one; verified by grep: zero damage/hp sites under app/api/flag/) |
| `__tests__/lib/playerProtection.test.ts` (new) | create | curve pins: active/expired/boundary/aggression-void; route refusal tests per surface (infantry + factory + WMD-negative) |

- **Verification plan:** `npx tsc --noEmit` (0), `npm run lint` (0/0), `npx vitest run` (full suite green + new test file); live probe: register → row has `protectionUntil ≈ now+72h`; attack protected target on infantry + factory surfaces → refused with server reason; protected attacker on infantry → own window cleared; WMD path refuses without code change (already reads the column); negative control: combat/attack vs a protected player's base still 400s with 'Target is not a hostile base' (structural, unchanged).
- **Call-graph reachability plan:** grep the three enforcement call sites from their route files (`combat/attack`, `combat/infantry`, `factory/attack` → service → `protectionActive`); grep `createPlayerWithAuth` insert includes `protectionUntil`.

## 6. Audit Record

### Pass 1 (2026-09-16) — RED re-verification + GREEN design audit

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static re-grep | R1 schema line + repo-wide writes | `grep -n protection_until lib/db/schema/players.ts` → `:101` only; zero writes estate-wide | pass (citation held) |
| Method 1: static re-grep | R2 sole reader | `grep -B1 -A2 protectionUntil lib/wmd/targetingValidator.ts` → `:37-39` unchanged | pass (citation held) |
| Method 1: static re-grep | R3 insert site | `createPlayerWithAuth` at `:421`, `newPlayer` `:431`, insert `:460` — citations held; **NEW: second insert site `createPlayer` (:341-378) has ZERO callers repo-wide** (grep census) — dead code; the write stays singular at `createPlayerWithAuth` | pass + new finding (dead site excluded from scope) |
| Method 1: surface census | R4 enforcement set | `combat/attack` refuses non-bot targets (`:257-259`) → bots-only route, players structurally unreachable — REMOVED from enforcement set; `combat/base` + `combat/pike` are EMPTY directories (no route.ts) — not surfaces; `flag/attack` no longer exists (challenge/claim steal-channel flow, zero damage/hp sites under app/api/flag/) → exempt by decision; infantry identity is session-bound (`:56-63`) | **FAIL → SELF-CORRECT** (GREEN surface map revised) |
| Method 1: seam audit | mapper/sanitizer paths | `mapRowToPlayer` spreads the row (`...row`, playerService:33) → `protectionUntil` already reaches domain objects; sanitizer is an ALLOWLIST with invariant logging (playerSanitize:122/147) → explicit allowlist addition is the only display seam; `mapDomainPlayerToRow` consumers are bot-insert paths only (flag-bot/bot-summoning) — protection irrelevant | pass (GREEN mapper row never needed — confirmed as designed-by-spread; implementation must NOT add a redundant mapper edit) |
| Method 2: manual re-read | Five Questions + impact vs corrected surface map | answers hold with the combat/attack correction folded in | pass |

Pass-1 verdict: RED findings all reproduced; GREEN contained 1 design error (combat/attack listed as a PvP surface — it is bots-only) + 2 clarifications (dead insert site; flag channels exempt). GREEN revised above. Line drift: level-gap mitigation now at battleService:229 (FID cited 209-231 — same block).

### Pass 2 (2026-09-16) — audit of the REVISED GREEN (convergence check)

| Check | Method | Evidence | Result |
| ----- | ------ | -------- | ------ |
| Enforcement set complete vs all player-harm vectors | route census | infantry (session-bound PvP) + factory/attack (capture) + WMD (column reader comes alive) + flag channels (exempt, decision recorded) + combat/attack (structurally excluded) — every reachable player-vs-player vector covered or explicitly dispositioned | pass |
| Aggression-void write path specified | GREEN re-read | infantry path clears the attacker's own window (battleService row) — the only outgoing-PvP surface | pass |
| No mapper redundancy | seam re-check | spread-mapper finding recorded so implementation adds zero mapper lines | pass |
| Verification plan matches corrected surfaces | plan re-read | probes re-pinned to infantry/factory/WMD + the combat/attack negative control | pass |
| Delta vs pass 1 | wc | GREEN table +3 rows, RED +1 finding, definitions unchanged — well under the 10% cap, no oscillation | **CONVERGENCE criterion met** |

Pass-2 verdict: zero actionable improvements remain → status `loop-complete`. Implementation (§7) remains gated on operator go-ahead.

## 7. Implementation Record

- **Status:** implemented 2026-09-16 (operator directive: implement the loop-complete FID — full gates + live probes)

**Code delta:**

| Change | File | Notes |
| ----- | ------ | ------ |
| Protection module (constant + pure predicate + void helper) | `lib/playerProtection.ts` (new) | `PROTECTION_WINDOW_MS` 72h, `protectionActive`, `voidProtectionIfProtected` (per FID-052 Law 12: no re-export barrel) |
| 72h window at registration | `lib/playerService.ts` | `createPlayerWithAuth` — singular insert site (dead `createPlayer` intentionally untouched) |
| `protectionUntil` on the domain type | `types/game.types.ts` | optional — matches the FID's tolerant-NULL design |
| Sanitizer allowlist + default | `lib/playerSanitize.ts` | passes the column through instead of stripping it |
| Infantry refusal at the route | `app/api/combat/infantry/route.ts` | after defender row fetch, before presence; text `'Target is under new-player protection'` per GREEN |
| Aggression void in the service | `lib/battleService.ts` | inside `executeInfantryAttack` (infantry path only — `executeBaseAttack` untouched, bots-only per pass-1 correction) |
| Factory-capture refusal | `lib/factoryService.ts` | inside `attackFactory`, after the self-ownership gate, before power computation |
| Unit pins | `__tests__/lib/playerProtection.test.ts` (new) | 14 tests: predicate pins, void SQL semantics, registration write, both refusals |
| Live-probe driver | `scripts/e2eNewPlayerProtection.ts` (new) | full matrix per the FID's verification plan, self-cleaning fixtures |

**Gates (2026-09-16):** tsc 0 · eslint 0/0 on all 9 touched files · vitest **883 passed / 1 skipped** (14 new protection pins green) · **live probes 7/7** on PORT=3002 (register ≈72h Δ=71.999h; infantry 400 refusal; WMD refusal with zero code change; aggression void persisted NULL; factory refusal; base-raid negative control; residual 0).

Live probes exercised the full error-envelope path via `error.details.message` — recorded because `createErrorResponse(code, { message })` nests custom messages in `error.details` while `error.message` stays generic.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass · [x] call-graph proven (route → predicate; service → void helper; factory service → predicate) · [x] live probes 7/7
- **Commit hash (G2 — required for `closed`):** `<hash>` (pending operator-executed commit)

---

**Staging plan (path-scoped, G1):**

```bash
git add lib/playerProtection.ts lib/playerService.ts lib/playerSanitize.ts types/game.types.ts app/api/combat/infantry/route.ts lib/battleService.ts lib/factoryService.ts __tests__/lib/playerProtection.test.ts scripts/e2eNewPlayerProtection.ts dev/fids/FID-20260916-002-new-player-protection.md dev/session-summaries/SESSION-2026-09-16-004.md SCOPE.md
git commit -m "feat: new-player 72h protection window — registration write, infantry/factory enforcement, aggression void (FID-20260916-002)"
```

---

**Final status:** verified (implementation done + gates green + live probes 7/7, 2026-09-16; `closed` awaits the G2 commit hash)
