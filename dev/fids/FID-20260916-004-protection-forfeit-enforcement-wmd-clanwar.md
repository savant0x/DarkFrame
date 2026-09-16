# FID-20260916-004: Protection forfeit enforcement — WMD launch void + war-clan join void (Option B spec)

**Filename:** `FID-20260916-004-protection-forfeit-enforcement-wmd-clanwar.md`
**ID:** FID-20260916-004
**Severity:** HIGH
**Status:** verified
**Created:** 2026-09-16

**Decides:** FID-20260916-003 §Operator decision (Option B, recorded 2026-09-16). This FID
specifies the two enforcement seams; implementation remains gated on `loop-complete` +
operator go-ahead.

---

## 1. Summary

Option B (ratified in FID-20260916-003) extends the new-player protection forfeit from
infantry initiation to two more outgoing-aggression surfaces: **WMD launch** (voids the
shield) and **joining a clan that is at ACTIVE war** (voids; neutral clans stay open).
FID-20260916-002 shipped the void helper and the infantry seam only. Grounding for this
spec also surfaced a **false claim in the -002 record**: the infantry route's comment says
"the WMD path enforces the same column via targetingValidator" — but `validateTargeting`
has **zero production callers** (tests only), so the launch path enforces nothing today.

## 2. Evidence (RED)

All claims verified by tool output on 2026-09-16 (pasted in SESSION-2026-09-16-008).

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | `launchMissile` validates only missile existence + READY status. No protection read, no void, and **no target validation at all** (the route's target lookup feeds only the broadcast name). | `lib/wmd/missileService.ts:191-223` | body: `missileResult…if (!missile)…if (missile.status !== MissileStatus.READY)…` then the status-flip UPDATE — zero protection references |
| 2 | The launch route fetches the target **only** `{ username, clanId }` for broadcast naming; no protection check precedes `launchMissile`. | `app/api/wmd/missiles/route.ts:224-239` | `select({ username, clanId })…const result = await launchMissile(validated.missileId, validated.targetId, auth.username)` |
| 3 | **`validateTargeting` has no production callers** — the -002 comment's "WMD path enforces the same column via targetingValidator" is false at launch time. | repo grep | `grep -rn validateTargeting app/api lib` → hits only in `lib/wmd/targetingValidator.ts` (definition) and tests |
| 4 | `joinClan` runs invitation → expiry → clan → capacity → player → already-in-clan checks, then member writes. No protection read, no void. | `lib/clanService.ts:473-557` | body read 0-EOF; zero `protection` references in the function |
| 5 | `joinClan`'s `playerId` param is **username-keyed at the players seam** (`UPDATE players … WHERE username = playerId`), so the username-keyed void helper drops in without identity translation. | `lib/clanService.ts:545-549` | `.where(eq(players.username, playerId))` |
| 6 | The war-state reader for the "ACTIVE war" gate already exists and is exported. | `lib/clanWarfareService.ts:724` | `export async function getActiveWars(clanId: string): Promise<WarWithMeta[]>` (clan_wars rows, status `'ACTIVE'`, both directions) |
| 7 | The void helper is username-keyed, idempotent (guarded by `IS NOT NULL`), and currently called from exactly one site (infantry). | `lib/playerProtection.ts`, `lib/battleService.ts:675` | import :57 + call :675 inside `executeInfantryAttack` |

Call-graph notes (Law 4):
- Launch path: client (WMDMissilePanel) → `POST /api/wmd/missiles` (action='launch') → `launchMissile(missileId, targetId, auth.username)`. The service is the single launch chokepoint (the panel imports the service name for types only).
- Join path: client → `POST /api/clan/join` → `joinClan(invitationId, auth.playerId)`. Single production caller.

## 3. Impact Analysis

- **Who/what is affected:** protected accounts (< 72h, un-voided) who launch WMDs or accept invitations from war-clans; WMD targets (currently any username — see finding 1's "no target validation" note; tightening that is OUT of this FID's scope but recorded as a discovery).
- **Failure modes if unfixed:** a shielded account can fire WMDs (mass-casualty outgoing aggression, no forfeit, no refusal); a shielded account can join a fighting clan and ride war benefits while unraidable.
- **Blast radius of the fix:** two service-level insertions (one void call each) + one war-state select on the join path + one comment correction + test pins. No schema changes, no route changes, no changes to refusal/infantry paths.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — voids fire at the service chokepoints (all callers covered), on committed actions only (missile-found + READY; all join preconditions passed), idempotent via the `IS NOT NULL` guard |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — one indexed `clan_wars` select per join (rare action); launch path adds zero queries (reuses the caller's identity) |
| Survives a hostile attacker, not just an honest user? | Yes — the shield can no longer platform outgoing WMD aggression; war-clan proxy closed; voids are server-side column writes with no client-trusted input |
| Maintainable in 2 years? | Yes — same one-line-per-seam pattern as infantry; policy table lives in FID-003; helper already unit-pinned |
| Sets the standard for the industry? | Yes — "the shield protects arrival, not action" enforced uniformly at every force-projection chokepoint |

## 5. Proposed Fix (GREEN)

**Principle (ratified):** voids fire when an aggressive action is *committed* — after the
action's own preconditions pass, before its effects — mirroring the infantry precedent.

### Changes

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/wmd/missileService.ts` | modify | In `launchMissile`, after the READY check and before the status-flip UPDATE: `await voidProtectionOnAggression(launchedBy);` (import from `../playerProtection`). A failed lookup / not-ready missile never reaches the void — no committed aggression, no forfeit. |
| `lib/clanService.ts` | modify | In `joinClan`, after ALL throwing preconditions pass (invitation valid, clan exists, capacity ok, player exists, not already in a clan) and immediately before the member-write block: `const activeWars = await getActiveWars(invitation.clan_id); if (activeWars.length > 0) { await voidProtectionOnAggression(playerId); }` — username-keyed per finding 5. Joining a neutral clan leaves the window untouched. |
| `app/api/combat/infantry/route.ts` | modify | Comment-only correction: the "WMD path enforces the same column via targetingValidator" claim is false (finding 3). Reword to cite the launch-path void added by this FID. |
| `__tests__/lib/playerProtection.seams.test.ts` | create | Seam pins with chained-mock db idiom: (a) launch by protected player → success + void persisted; (b) launch unknown missile → refusal + **no** void; (c) launch not-ready missile → refusal + **no** void; (d) join war-clan → void fired before member write; (e) join neutral clan → no void; (f) `getActiveWars` empty/throw ⇒ no void, join proceeds (fail-open for the war check only — a war-lookup outage must not block onboarding; the launch void has no such branch). |

### Alternatives considered (rejected)

- **Refuse WMD launch by protected accounts** (Option A semantics) — rejected by operator decision (Option B: launch is aggression, forfeits — consistent with infantry).
- **Void in the routes** — rejected: service-level placement covers all callers and matches the infantry precedent.
- **Void at invitation-*send* time** — rejected: the invitee hasn't committed anything; forfeit belongs to the joiner.
- **Target validation for WMD launches** (finding 1's "any username is launchable") — real gap, but out of Option B's scope; recorded as `[OPEN-OUT-OF-SCOPE]` for a follow-up FID.

### Verification plan (for the implementation stage)

- Gates: `npx tsc --noEmit` (0) · `npx eslint` on touched files (0/0) · `npm run test:ci` (all green + 6 new pins).
- Call-graph reachability: `grep -n "voidProtectionOnAggression" lib/battleService.ts lib/wmd/missileService.ts lib/clanService.ts` → three call sites; `grep -rn "launchMissile\|joinClan" app/api` → the two routes still reach the modified services.
- Live probes (PORT=3002, self-cleaning fixtures, driver pattern from `scripts/e2eNewPlayerProtection.ts`): (1) protected account launches a seeded READY missile → 200 + row `protectionUntil` NULL; (2) protected account accepts an invitation from a clan with a seeded ACTIVE `clan_wars` row → member added + void persisted; (3) invitation from a neutral clan → member added, `protectionUntil` untouched; (4) cleanup residual 0.

## 6. Audit Record

### Pass 1 (2026-09-16) — RED re-verification + GREEN design audit

| Check | Method | Evidence | Result |
| ----- | ------ | -------- | ------ |
| RED finding 1 (launch has no protection interaction) | re-read `launchMissile` body | zero protection references between the READY check and the UPDATE | pass |
| RED finding 3 (validator has no production callers) | repo grep re-run | `validateTargeting` → definition + tests only; -002 comment claim false | pass — GREEN gains the comment correction |
| RED findings 4–5 (join path shape + username keying) | re-read `joinClan` | member write block preceded by exactly five throwing checks; `eq(players.username, playerId)` confirmed | pass |
| GREEN seam placement vs committed-action principle | design re-read | launch void after READY (a not-ready missile is not a launch attempt); join void after all five preconditions (a failed check throws before any forfeit) | pass |
| Identity audit | grep both callers | route passes `auth.username` to `launchMissile`; `joinClan` writes `WHERE username = playerId` — both match the helper's username key | pass |
| Import-path audit | file locations | `lib/wmd/missileService.ts` → `../playerProtection`; `lib/clanService.ts` → `./playerProtection` | pass |
| Discovery recorded | finding 1 note | WMD target validation gap → `[OPEN-OUT-OF-SCOPE]` | recorded |

Pass-1 corrections: none required — the GREEN survived re-verification intact; the pass
added the comment-correction row's precise rewording target and the fail-open note for the
war lookup.

### Pass 2 (2026-09-16) — convergence check

| Check | Method | Evidence | Result |
| ----- | ------ | -------- | ------ |
| Enforcement set completeness vs Option B | FID-003 decision re-read | Option B items: WMD launch void ✓ (seam 1), war-clan join void ✓ (seam 2), neutral-join open ✓ (no-op), harvest untouched ✓ (absent from GREEN) | pass |
| Import-graph safety (cycle risk for the new edge) | grep | `clanWarfareService` has NO import of `clanService` (no reverse edge — new edge acyclic); helper exports verified at `lib/playerProtection.ts` (`voidProtectionOnAggression` :63) matching the GREEN names exactly | pass |
| Delta vs pass 1 | wc | zero GREEN rows changed; 1 clarification + this evidence row folded in — under the 10% cap | pass |
| Oscillation / open findings | re-read | zero actionable improvements remain; no issue repeated across passes | **CONVERGENCE criterion met** |

Pass-2 verdict: zero actionable improvements remain → status `loop-complete`.

## 7. Implementation Record

- **Status:** done (2026-09-16, operator go-ahead)

| Change | File | Notes |
| ----- | ------ | ------ |
| Seam 1 — launch void | `lib/wmd/missileService.ts:215` | after exists+READY checks, before the status-flip UPDATE; import from `@/lib/playerProtection` |
| Seam 2 — war-clan join void | `lib/clanService.ts:539` | after all five throwing preconditions; dynamic `import('./clanWarfareService')` (cycle-safe, house pattern); `getActiveWars(clan_id).length > 0` gate; try/catch fail-open per GREEN |
| Comment correction | `app/api/combat/infantry/route.ts` | `validateTargeting` claim reworded to credit the missileService seam (FID-004) |
| 6 seam pins | `__tests__/lib/playerProtection.seams.test.ts` (new) | pins 1–3 launch (void on commit; no void on not-found / not-READY); pins 4–6 join (war-clan void + membership write proven; neutral no-op; war-lookup throw fails open with join success) |
| Live-probe driver | `scripts/e2eProtectionForfeit.ts` (new) | direct-DB fixtures + service-level seam calls; purge script `scripts/purgeProtectionProbeFixtures.ts` |

**Gates:** tsc 0 · eslint 0/0 (6 files) · vitest **903 passed / 1 skipped** (6 new pins) · **live probes 4/4** (WMD launch by protected account → success + `protectionUntil` NULL; ACTIVE-war-join → success + NULL; neutral-join → success + window untouched; residual 0).

**Reachability:** `voidProtectionOnAggression` call sites: battleService:675 (infantry), clanService:539 (join), missileService:215 (launch); `POST /api/wmd/missiles` → `launchMissile` (:242), `POST /api/clan/join` → `joinClan` (:84).

**Discoveries during implementation (recorded, out of scope):** `clan_invitations` is a raw-SQL table (no drizzle schema; NOT NULL clan_name/inviter_username/invitee_username); `logClanActivity` inserts a `metadata` column absent from this DB's `clan_activities` (pre-existing; absorbed — clan ops still succeed); `launchMissile` resolves missiles by PK `id`, not the `missile_id` business column.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (903+1skip, 6 new pins) · [x] call-graph proven (three void sites total) · [x] live probes 4/4
- **Commit hash (G2 — required for `closed`):** `<hash>`
- **Staging plan (path-scoped, G1 — FID only at this stage):** `git add dev/fids/FID-20260916-004-protection-forfeit-enforcement-wmd-clanwar.md dev/session-summaries/SESSION-2026-09-16-008.md SCOPE.md`
- **Commit message (G8):** `docs(fid): Option B enforcement spec loop-complete — WMD launch void + war-clan join void (FID-20260916-004)`

---

**Final status:** verified (implemented + gates green + live probes 4/4, 2026-09-16; `closed` awaits the G2 commit hash)
