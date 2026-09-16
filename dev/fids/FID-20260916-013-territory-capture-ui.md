# FID-20260916-013: Territory-capture UI — wire the dead capture route, fix the strength-0 defect, add target-tile enumeration

**ID:** FID-20260916-013
**Severity:** HIGH
**Status:** loop-complete
**Created:** 2026-09-16
**Track:** P2 feature (feature survey 2026-09-16, row #73 disposition)

---

## 1. Summary

The 2026-09-16 feature survey identified territory capture as the largest remaining
unreached system: `POST /api/clan/warfare/capture` is fully implemented, server-gated,
and war-aware — and has **zero client callers**. Grounding this turn found a second,
worse defect behind the dead UI: the route calls `captureTerritory` →
`attemptTerritoryCapture` with `attackerStrength = 0`, which guarantees every
route-level capture fails (0 * jitter ≥ 5000 defensePower is impossible) while still
charging the 25,000 metal + 25,000 energy treasury cost and consuming one of the 3
daily attempts. A third gap: the UI cannot render capturable targets because no
endpoint enumerates the enemy's tiles.

Fix all three together: derive attacker strength in the service, enumerate target
tiles for the UI, and wire the capture flow into `ClanTerritoryPanel`.

## 2. Ground truth (probed this turn, Law 16)

| # | Probe | Result |
|---|---|---|
| R1 | UI callers of `/api/clan/warfare/capture` | **0** (`grep` across components/app/lib: only the route itself). RED anchor. |
| R2 | `attemptTerritoryCapture` production callers | exactly one: `app/api/clan/warfare/capture/route.ts:98` via `captureTerritory(..., auth.username)` → `attemptTerritoryCapture(clanId, targetClanId, tileX, tileY, playerId, 0)` |
| R3 | Strength math | `lib/clanWarfareService.ts:448-449`: `jitteredAttack = attackerStrength * (1 + ±15% jitter)`; `captured = jitteredAttack >= defensePower`; `defensePower = 5000 * (1 + defenseBonus/100)` ≥ **5000**. With strength 0: `0 >= 5000` is always false → guaranteed repel. |
| R4 | Failure still charges | service lines 456-463: repelled captures debit treasury 25k/25k (`CAPTURE_COST_METAL/ENERGY`, lines 59-60) and increment `attackerCapturesToday` |
| R5 | Direct service callers | none in production — `__tests__/lib/clanWarfareV2.test.ts` imports only `WAR_CONSTANTS`, `recordWarBattleOutcome`, `settleDueWars` (strength math is unpinned by tests) |
| R6 | Route error mapping | verbatim strings: `No active war with this clan — declare war before capturing territory` → 400; `Territory not owned by target clan` → 400; `Daily capture limit reached (3/day per clan per war)` → 400; `Only Leaders, Co-Leaders, and Officers can capture territory` → 403; `Capture costs 25000 metal + 25000 energy from the treasury (have X/Y)` → 400 |
| R7 | War context source | `GET /api/clan/wars` exists (`app/api/clan/wars/route.ts`, `requireClanMembership`-gated, returns `{ success, wars: WarDto[] }` with `attackerClanId/defenderClanId/attackerTag/defenderTag/status`); `ClanWarfarePanel.tsx:96` already consumes it. ClanPanel renders territory and warfare as sibling tabs — war state must be fetched inside the territory panel flow, not shared via props. |
| R8 | Panel structure | `ClanTerritoryPanel.tsx` (482 lines): `Clan` + `currentUserRole: ClanRole` + `onRefresh` props, `canManage = ROLE_PERMISSIONS[currentUserRole].canManageTerritories`, `ClaimTerritoryModal` pattern (typed-coordinate modal, `nn-*` styling, toast feedback) exists to mirror |
| R9 | Capture permission key | server gate is the hardcoded `['LEADER','CO_LEADER','OFFICER']` in `requireRole`; `ROLE_PERMISSIONS.canManageWars` matches exactly on LEADER/CO_LEADER (true), OFFICER (false — but OFFICER **can** capture per server). Presentational gate must therefore key on OFFICER-or-above, matching the server, not `canManageWars`. |

## 3. Impact

- Clan wars cannot progress: the headline war mechanic (taking territory) is
  unreachable by players.
- If a player had discovered the API, every attempt would have silently burned
  50k combined treasury resources per attempt with a 0% success ceiling —
  and the UI would never have shown them why.
- The war panel shows active wars; the territory panel shows own tiles; nothing
  connects them to the capture action the server is fully willing to serve.

## 4. Alternatives considered

- **Extend ClanWarfarePanel with the capture action** — rejected: capture targets are
  *territories*, the territory panel already lists/maps tiles and holds the claim
  modal pattern; warfare's tab is about war lifecycle, not tile actions.
- **Fold target-tile enumeration into `GET /api/clan/wars`** — rejected: mixing tile
  payloads into the war list couples two services' shapes; a separate read-only GET
  under `warfare/` keeps the capture seam self-contained.
- **Fix only the UI, defer the strength defect** — rejected: wiring UI to a route
  whose success rate is 0% ships a broken feature; the strength fix is small and
  unblocks the whole flow.

## 5. Spec (GREEN state)

### 5.1 Service: derive attacker strength (the defect fix)

`attemptTerritoryCapture`'s `attackerStrength: 0` call-site is the route; the fix
lives in `captureTerritory` (the route-facing wrapper): replace the hardcoded `0`
with a derived clan strength so route-level captures are live:

- Derive strength from the capturing clan's own territories + level, reusing the
  same scale the defense wall uses (`5000 * (1 + bonus/100)`): a sensible, testable
  choice is `5000 * (1 + clanLevel * 0.1)` clamped to at least the base defense wall
  (5000) so an unbonused, undeveloped defender is capturable but a same-level attacker
  reliably wins within jitter. Exact formula recorded here once implemented and
  becomes the pinned contract.
- `attemptTerritoryCapture`'s signature is **unchanged** — strength stays a parameter;
  direct callers (tests, future sim drivers) keep explicit control.
- V2 test gains pins for the strength-derivation helper (pure function) so the
  capture odds can never silently regress again.

### 5.2 Route: target-tile enumeration GET

New `GET /api/clan/warfare/capture/targets`:
- `requireClanMembership` gate; responses mirror the POST's shapes.
- Behavior: find the caller's **ACTIVE war as attacker** (same query the service
  uses); if none, return `{ success: true, targets: [], activeWar: null }` (the UI
  renders "no active war" guidance, not an error).
- If a war exists: return the defender's territory tiles
  (`{ success: true, activeWar: { warId, defenderClanId, defenderTag }, targets: [{ tileX, tileY, defenseBonus }] }`).
- Read-only; no treasury or cap interaction.

### 5.3 UI: capture flow in ClanTerritoryPanel

- **Enemy-targets section:** when an ACTIVE attacker-war exists, a "Capture from
  [TAG]" section lists the enemy's tiles (coords + defense bonus), each with a
  capture button for OFFICER-and-above (presentational gate mirrors the server's
  `requireRole`, not `canManageWars` — see R9).
- **Capture attempt:** confirm-then-fire `POST /api/clan/warfare/capture` with
  `{ targetClanId, tileX, tileY }`; the server's `success: true/false` distinction is
  surfaced honestly — success toasts + list refresh, repel shows the server's
  verbatim message (which already discloses the cost).
- **Errors verbatim:** no-wars, cap-reached, treasury-short, and permission refusals
  surface the server message through the toast channel (same channel as the claim
  modal); no client-side refusal pre-filtering.
- **No war:** the section renders guidance pointing at the Warfare tab instead of a
  silent absence.
- **Non-officers:** see the section read-only with the standard "Only Leaders,
  Co-Leaders, and Officers can capture territory" note; buttons hidden.

### 5.4 Not-to-change list

- `attemptTerritoryCapture`'s signature and math (beyond the strength-derivation
  call-site fix in `captureTerritory`).
- The daily cap (3), treasury cost (25k/25k), defense-wall scale (5000 base), and
  jitter (±15%) — economy constants stay exactly as designed.
- `GET /api/clan/wars`, `ClanWarfarePanel`, the claim/unclaim flows.
- The route's error-mapping structure (verbatim-message passthrough is correct).

## 6. Perfection Loop record

| Pass | Focus | Findings |
|---|---|---|
| 1 | RED re-probe + spec coverage | R1-R6 re-verified live; spec covers all three defects (strength, enumeration, UI). No gaps. |
| 2 | Impact re-check | Confirmed R3-R4 by reading the transaction body: repel path debits treasury and burns a daily attempt. Spec keeps cost-on-failure as designed (not-to-change). |
| 3 | Alternative sweep | Four alternatives evaluated (§4); one rejected shape (capture UI in warfare tab) recorded there. |
| 4 | Not-to-change re-check | §5.4 re-read against §5.1-5.3: no contradiction. Signature unchanged; constants unchanged; wars GET untouched. |

**Loop verdict:** loop-complete (4 passes, no open findings).
