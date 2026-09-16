# FID-20260916-003: Protection forfeit edges — harvest, clan join, WMD launch (debate)

**Filename:** `FID-20260916-003-protection-forfeit-edges-debate.md`
**ID:** FID-20260916-003
**Severity:** MEDIUM
**Status:** closed (2026-09-16 — Option B ratified and fully implemented via FID-20260916-004, commit `2cf2f8a`)
**Created:** 2026-09-16

---

## 1. Summary

FID-20260916-002 shipped the 72h new-player protection window with a single forfeit trigger:
initiating an infantry attack on another player (the "aggression void", `battleService:675`).
The operator asks whether protection should also break on **harvesting contested tiles** or
**joining a clan** — i.e., whether the shield should protect only against *violence*, or also
against *advantage-taking* while shielded. This FID is a **debate**: it grounds each edge in
code truth, lays out the option space with tradeoffs, and records the operator's decision.
It intentionally does NOT propose a fix until the operator picks a lane.

## 2. Evidence (RED)

Ground truth as of 2026-09-16 (tool output pasted in session summary 005).

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | The void has exactly one call site — infantry initiation. Factory capture, WMD launch, and harvest never touch protection forfeit. | `lib/battleService.ts:675` | `grep -n "voidProtectionOnAggression" lib/battleService.ts` → single hit (import :57, call :675, inside `executeInfantryAttack`) |
| 2 | **No contested-tile harvest mechanic exists.** Harvest is position-tile harvest of neutral terrain (metal/energy/cave/forest). There is no tile ownership, no per-player tile claim, no contested harvest path. | `app/api/harvest/route.ts:104-117` | route dispatches purely on `tile.terrain` (Metal/Energy/Cave/Forest); no owner field consulted. Schema: `lib/db/schema/tiles.ts` has `baseOwner` (bot base owner) — no player tile ownership |
| 3 | "Contested" exists ONLY as clan-war territory capture (war-gated, treasury-funded, capture score). It is a clan-vs-clan mechanic, not a harvest-time state. | `lib/clanWarfareService.ts:17,62` | `attemptTerritoryCapture()-> contested capture, war-gated, costs treasury`; `CAPTURE_JITTER: 0.15 // ±15% strength jitter on contested captures` |
| 4 | **Clan join is invitation-acceptance**, not open enlistment. | `app/api/clan/join/route.ts:11,84` | `POST /api/clan/join - Accept clan invitation`; `joinClan(validated.invitationId, auth.playerId)` |
| 5 | **WMD launching has ZERO protection interaction on the launch side** — a protected account can arm and fire. The only protection text in WMD code is target-side refusal. | `lib/wmd/targetingValidator.ts:37-38` | `grep -rn "protection" app/api/wmd/ lib/wmd/` → only the target-side `errors.push('Target is under protection')` |
| 6 | War declaration and territory capture are clan-level actions with no player-protection gate. | `lib/clanWarfareService.ts` | (header API list; no protection references in file) |

Call-graph notes (Law 4):
- Aggression void is reached: `POST /api/combat/infantry` → `executeInfantryAttack` → `voidProtectionOnAggression(attackerId)`. NOT reached from factory capture, WMD launch, harvest, or clan join.
- Harvest is reached: `POST /api/harvest` → terrain dispatch → `harvestResourceTile`/`harvestCaveTile`/`harvestForestTile` — all player-scoped cooldowns, no other-player interaction.
- Clan join is reached: `POST /api/clan/join` → `joinClan(invitationId, playerId)` — requires a pre-existing invitation row.
- WMD launch: `app/api/wmd/*` → `validateTargeting` (target-side only) → launch path with no launch-side protection read.

## 3. Impact Analysis

- **Who/what is affected:** new accounts (< 72h old, not yet voided), their clan recruiters,
  rival clans in active wars, WMD-armed accounts, harvest economy.
- **Failure modes if edges stay as-is (violence-only forfeit):**
  1. A protected account can **join a clan and be dragged into war benefits/obligations** while shielded — asymmetric participation.
  2. A protected account can **launch WMDs** (if it acquires one via trade/gift/cave drop) — outgoing mass-casualty aggression that neither voids nor is refused. This is the sharpest hole: infantry refuses *nothing* on the launch side and forfeits only via the infantry seam.
  3. A protected account can **participate in war-gated territory capture** through its clan (as a member) — again shielded participation.
- **Blast radius of any fix:** small and additive — new predicate call sites in `lib/wmd/*` (launch path), `lib/clanService.joinClan`, and (if desired) `app/api/harvest/route.ts`; no schema changes; no changes to the existing infantry/refusal paths.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — this FID enumerates ALL outgoing interactions a protected account can take (attack, capture, launch, join, harvest) rather than the infantry case only |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — a single `forfeitOn(kind, username)` seam centralizes forfeit policy; new mechanics register a policy entry instead of scattering conditionals |
| Survives a hostile attacker, not just an honest user? | Yes — server-side checks at the action seams; the shield cannot be used as an offensive platform (launch-while-protected closed), and voids are idempotent column writes |
| Maintainable in 2 years? | Yes — policy table documented in this FID; each forfeit trigger is one line + a test pin |
| Sets the standard for the industry? | Yes — "protection ends when you act, not when you claim" with an explicit, documented policy matrix is a defensible design |

## 5. Option Space (GREEN deferred — this section IS the deliverable)

**Design principle extracted from FID-20260916-002:** protection shields *arrival*, not *action*.
The open question is which actions count as "acting."

### Option A — Violence-only forfeit (status quo, plus one patch)
- Forfeit: infantry initiation (already shipped).
- Patch: refuse WMD **launch** by protected accounts (no forfeit — launch is refused outright like incoming attacks are).
- Clan join: allowed, forfeits nothing. Harvest: irrelevant (no contested mechanic).
- Rationale: the shield exists so new players are not farmed on arrival; joining a clan is social integration and should stay open.
- Risk: a protected member can sit in a war clan and benefit from clan spoils while unraidable.

### Option B — Outgoing-aggression forfeit (recommended)
- Forfeit: infantry initiation (shipped) **and WMD launch** (void, not refuse — firing a WMD is unambiguous aggression).
- Clan join: allowed but **forfeits only if the clan is at ACTIVE war** at join time (joining a fighting force is an act of war by proxy).
- Harvest: no-op — ground truth shows no contested-tile harvest exists; inventing one now is out of scope ([OPEN-OUT-OF-SCOPE] if operator wants tile ownership later).
- Rationale: consistent rule — "if it projects force, it forfeits." WMD launch forfeiting closes the sharpest hole; war-clan joining closes the proxy hole; neutral clans stay open to newcomers.

### Option C — Any-PvP-adjacent participation forfeit
- Forfeit: infantry, WMD launch, joining ANY clan (war or not), participating in territory capture.
- Rationale: simplest possible rule — new players must reach 72h in solitude.
- Risk: over-broad. Blocks clan onboarding (a major retention lever), punishes harmless socialization; highest churn risk during the exact window meant to retain new players.

### Rejected outright
- **Forfeit on being attacked** — nonsensical (punishes the victim; would contradict the shield's purpose).
- **Forfeit on harvest of neutral tiles** — no other player is affected; forfeiting here would make the shield a movement punishment. If tile ownership/contested harvest is ever built, that mechanic should consult this FID's policy table at design time.

### Recommendation
**Option B.** It closes both real holes (WMD launch, war-clan proxy), keeps newcomer onboarding open, and matches the principle that the shield protects arrival, not advantage.

## 6. Audit Record

Not applicable in the loop sense — this FID is a decision record. Evidence method: every
RED claim above was verified by direct tool output (grep/route reads) during the session;
claims 2–5 were re-checked against the tree today. No Perfection Loop was run because there
is no design to converge yet; the loop (if the operator picks a lane) runs in a follow-up
FID that specifies the chosen option's enforcement seams.

## 7. Implementation Record

- **Status:** decision recorded — implementation BLOCKED pending follow-up enforcement-spec FID (loop) + operator go-ahead

## 8. Closure

- **Gates:** n/a until a decision produces an implementation FID or direct change set.
- **Commit hash (G2):** `<hash>` (this document's own commit)
- **Staging plan (path-scoped, G1):** `git add dev/fids/FID-20260916-003-protection-forfeit-edges-debate.md dev/session-summaries/SESSION-2026-09-16-005.md SCOPE.md`
- **Commit message (G8):** `docs(fid): protection forfeit edges debate — harvest/clan/WMD option space, operator decision pending (FID-20260916-003)`

---

**Operator decision (recorded 2026-09-16):** **Option B — outgoing-aggression forfeit.**

1. **WMD launch by a protected account voids the shield** (fires the same `voidProtectionOnAggression`-class write; launching is unambiguous aggression, not something to refuse).
2. **Clan join voids the shield only if the clan is at ACTIVE war** at join time (joining a fighting force is war by proxy). Neutral-clan onboarding stays open.
3. **Harvest: no forfeit, no gate** — no contested-tile harvest mechanic exists; revisited only if tile ownership is ever built (it must consult this policy table at design time).
4. Policy principle (ratified): the shield protects *arrival*, not *action* — any action that projects force forfeits.

**Next step:** enforcement spec (seams, refusal/void placement, tests) in a follow-up FID that runs the Perfection Loop; implementation gated on its `loop-complete` + operator go-ahead.

**Final status:** analyzed (debate complete; Option B recorded 2026-09-16 — implementation via follow-up FID)

**Closure note (2026-09-16, operator directive "fix with the most robust option"):** Option B is
now implemented in full — the WMD-launch void and the war-clan-join void both shipped in
FID-20260916-004 (commit `2cf2f8a`) with seam pins and live probes, and that FID is closed.
The harvest edge stands as ratified: **no forfeit, no gate** — no contested-tile harvest
mechanic exists, and inventing one to gate would be the less robust choice; if tile ownership
is ever built, this policy table must be consulted at design time (per §5). Nothing further
is owed by this FID.
