# FID-20260916-011: Sabotage UI — WMDIntelligencePanel target → victim preview → fire flow

**Filename:** `FID-20260916-011-sabotage-ui-panel.md`
**ID:** FID-20260916-011
**Severity:** HIGH
**Status:** verified (2026-09-16 — implemented on operator go-ahead; closed awaits G2 hash)
**Created:** 2026-09-16

---

## 1. Summary

FID-20260916-007 made sabotage fully functional server-side — the route was repaired
(`executeSabotage(spyId, targetType, targetId, operatorId)` with the route sending
`auth.playerId`), the victim is now derived from the target asset, hijacked spies are
refused, protection voids at commit, and 4/4 live probes passed. **No client can send
any of it.** The recorded product call (session 023 feature survey, P1) is to surface
sabotage in `WMDIntelligencePanel` as a target → victim preview → fire flow.

The panel today offers spies + missions views, recruitment, and counter-intel. The
sabotage POST branch exists in the route (`action === 'sabotage'`, route.ts:208) but
no UI writes it, and no GET enumerates valid targets — the fire flow has nothing to
target.

## 2. Evidence (RED)

Probed 2026-09-16 (Law 16 — every claim pasted, not recalled):

1. **No UI caller of the sabotage action** — `grep -rn "action: 'sabotage'" components/ app/ lib/`
   → zero matches in client code. The only sabotage references in the panel file are the
   SABOTAGE specialization chip in recruitment.
2. **No target enumeration endpoint** — route GET accepts `type` of `spies | missions`
   only; anything else returns 400 `"Invalid type. Use \"spies\" or \"missions\""`
   (route.ts:76, re-anchored after a mis-cited line number). There is no way for a client to discover valid `targetType`/
   `targetId` pairs.
3. **The fire seam works without UI** (verified live in -007's probes): POST body
   `{ action: 'sabotage', spyId, targetType, targetId }` (branch at route.ts:208)
   against the repaired route — success → `{ success: true, message, damage }`,
   refusal → 400 `{ error }` with the service's verbatim messages.

## 3. Impact Analysis

- **Player-facing:** the entire sabotage system — spies with the SABOTAGE
  specialization, skill floors, difficulty/detection mechanics, protection void — is
  dead UI weight. Recruit a SABOTAGE spy and you can never use the skill you trained.
- **Server-facing:** none. This FID adds one read-only GET enumeration; the fire path
  is the already-pinned -007 seam. No protection logic may be altered here — the UI
  must surface the server's refusals, not pre-filter them (a client-side gate would be
  a second hand-rolled predicate — exactly the drift FID-009's D1 just eliminated).

## 4. Five Questions

1. **What breaks without this?** Nothing — the system stays unreachable, which is the
   problem.
2. **What breaks with this?** A bad fire call voids the operator's own protection —
   which is the -007-designed, per-fire cost, surfaced (not softened) by the preview.
   Wrong target ids fail server-side with `Invalid sabotage target`.
3. **Who is affected?** Players with sabotage-capable spies; victims of successful
   operations (notification pipeline already exists, SABOTAGE_COMPLETED/DETECTED).
4. **Is there a simpler alternative?** None: the endpoint contract is fixed by the
   pinned -007 signature; the only UI decision is placement (this panel owns spies —
   a separate panel would fragment the agent lifecycle).
5. **What must NOT change?** The six refusal messages' verbatim text (parity constant
   `PROTECTION_REFUSAL_REASON` and the five `executeSabotage` preconditions), the
   void-at-commit ordering, and the per-fire protection cost. The UI is read-only
   orchestration; it may never duplicate server authorization logic.

## 5. Proposed Fix (GREEN)

Three layers, all thin adapters over existing systems:

**A. New GET branch: `type=sabotage-targets`** (same route, same auth + rate-limit wrapper)
Returns every sabotagable asset in three arrays, each row carrying the victim identity
the service derives at fire time (so the preview shows the truth the void will hit):

- `MISSILE` — from `missiles` join `players` (missileId, type, ownerId, ownerUsername,
  protectionActive)
- `DEFENSE_BATTERY` — from `wmdDefenseBatteries` join `clans` (batteryId, clanId,
  clanName, leaderUsername, protectionActive)
- `RESEARCH` — from `playerResearch` join `players` (researchId, playerId,
  ownerUsername, protectionActive)

Each row also carries `difficulty` (0.2/0.3/0.4) and `detectionRisk` base from the
service's own tables — exported as constants so the route cannot drift from the service
(the FID-009 D1 lesson: one source of truth, imports not copies).

**B. Panel: a third `sabotage` view** in the existing tab row, gated to players who
hold at least one AVAILABLE spy with `skills.sabotage >= 30` (the server floor; the
gate is presentational only — the server refuses anyway).

**C. The flow (three steps, one screen):**
1. **Target** — pick a spy, pick target type, pick from the enumerated assets.
2. **Preview** — victim username/clan, protection status (shielded targets are
   selectable but visibly flagged — the fire attempt will return the parity refusal
   verbatim, which the result area surfaces), difficulty → computed success chance
   `max(0.05, skills.sabotage/100 − difficulty)`, detection risk, and the standing
   warning: *firing voids your remaining protection window*.
3. **Fire** — POST `{ action: 'sabotage', spyId, targetType, targetId }`; the result
   area renders the server's `message` verbatim on both success and refusal paths.
   No client-side refusal pre-filtering.

## 6. Audit Record

- **Gate G2 (probe):** route GET/POST contracts, service signature, refusal messages,
  difficulty/detection tables, and target-asset tables all read 0-EOF this session;
  RED evidence above is paste-derived.
- **Loop record (ECHO v0.1.2, FID-20260916-011):**
  - **Pass 1 — RED verification:** evidence items 1–3 re-probed; all three hold. The
    "no UI caller" grep and the GET 400 message are the pinned anchors.
  - **Pass 2 — impact re-check:** §3's "no server-facing changes" holds; the one
    server edit (exports of difficulty/detection tables) is additive and
    test-visible.
  - **Pass 3 — simpler-alternative sweep:** reuse of the `spies` view with inline
    fire buttons rejected — sabotage needs target-type + asset selection the spies
    list cannot carry without bloating every row; a dedicated view is the minimal
    shape.
  - **Pass 4 — not-to-change re-check:** §4.5 list verified against the -007 pins;
    no wording drift.
- **Convergence:** 4 passes, no new findings after pass 2 → converged.
- **Loop status: loop-complete** (2026-09-16). Implementation awaits operator go-ahead
  per protocol vocabulary.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- [x] GET `type=sabotage-targets` enumeration with per-type victim identity
- [x] Difficulty/detection constants exported from service (single source of truth)
- [x] Panel `sabotage` view: target selection → preview → fire
- [x] Result area surfaces server messages verbatim (success + refusal)
- [x] Pins: route enumeration shapes (3 target types + empty-state), preview
      computation, fire request body contract
- [x] Gates: tsc 0 · eslint 0/0 · vitest full suite green
- [x] Live probe: enumerate → preview math → fire refusal path (protected target)
      against dev DB
- [ ] §8 hash, SCOPE row, session record

**Implementation evidence (2026-09-16):**
- Shared math landed as a new DB-free module `lib/wmd/sabotageMath.ts` (difficulty /
  detection tables + success/detection formulas + skill floor + type guard); the
  service DELEGATES to it and the route + client panel import it — a stronger shape
  than "export from service": no server modules in the browser bundle.
- New enumeration service `lib/wmd/sabotageTargets.ts` → `getSabotageTargets(spyId)`;
  victim derivation mirrors `resolveSabotageTarget` exactly (missile owner →
  players.username; battery → clan → leader; research → owner), `protectionActive`
  per row. Listing is GLOBAL per §5 ("every sabotagable asset") — matches the fire
  path, which validates any existing asset; the spy read enforces the skill floor.
- Route: GET `type=sabotage-targets` (400 without `spyId`, service refusal messages
  verbatim); invalid-type message updated; POST sabotage now rejects malformed
  `targetType` before the service switch; spies GET scoped via the new `operators`
  param (`[auth.playerId]`).
- Panel: third `Sabotage` tab; operator → target → preview+fire; preview shows
  victim, shield state, computed success/detection, and the void warning; result
  area renders server messages verbatim; no client-side refusal pre-filtering.
- Gates: tsc 0 · eslint 0/0 · vitest **942+1skip** (11 new pins) · live probe
  3/3 stages (`scripts/e2eSabotageUiFlow.ts`, exit 0): enumeration derived the
  victim + `protected=true` from a seeded shielded missile, preview math matched
  the fire-path formula bit-for-bit, fire refused with the parity constant
  verbatim and left the spy AVAILABLE. Two probe-driver iterations disclosed:
  varchar(20) username overflow (base36 stamps now), then an exit-path restructure
  (single pool owner, no top-level await).

## 8. Closure

- **Commit hash (G2):** —
- **Gates (G1):** —
