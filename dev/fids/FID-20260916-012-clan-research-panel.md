# FID-20260916-012: Clan research panel — contribute/unlock UI for the existing tree

**Filename:** `FID-20260916-012-clan-research-panel.md`
**ID:** FID-20260916-012
**Severity:** HIGH (largest unreached system; cooperative sink fully built, zero player reach)
**Status:** verified (2026-09-16 — implemented on operator go-ahead; closed awaits G2 hash)
**Created:** 2026-09-16

---

## 1. Summary

The 2026-09-16 feature survey (SCOPE #69) named the clan research tree the largest
system no player can reach. Ground truth refines that: the **tab exists** but is a
placeholder, the **backend is fully live**, and one missing endpoint is all that
separates the system from its players. This FID builds the contribute/unlock UI over
the existing services — no new mechanics, no new policy.

## 2. Evidence (RED)

All claims probed 2026-09-16 (Law 16 — pasted, not recalled):

1. **The tab is a placeholder** — `ClanPanel.tsx:290` includes `'research'` in the
   `ClanTab` union and lines 368-370 render its tab button, but lines 429-431 render
   `<ComingSoonTab feature="Clan Research" />`. The survey's "no panel anywhere" was
   imprecise: the panel is `ComingSoonTab`.
2. **Both mutation endpoints are live with zero client callers** —
   `POST /api/clan/research/contribute` (`requireClanMembership` → `contributeRP(clanId,
   auth.username, amount)`, body `{ amount }`) and `POST /api/clan/research/unlock`
   (→ `unlockResearch(clanId, auth.username, researchId)`, body `{ researchId }`).
   Client grep for `clan/research` returns only `lib/middleware/activityLogger.ts:120`
   (a server-side path→ActionType map, not a caller).
3. **No state endpoint exists** — `app/api/clan/research/` contains only `contribute/`
   and `unlock/`. There is no GET a panel could call, despite
   `getResearchTree(clanId)` being fully implemented.
4. **The tree contract is real and shaped** — `getResearchTree` returns four branch
   arrays with `{ unlocked, available }` per node plus `clanLevel` and the fund
   `researchPoints`. After the FID-20260912-058 (C1) cut, `RESEARCH_TREE` holds
   exactly **4 MILITARY nodes** (`mil_combat_1`, `mil_tactics_1`, `mil_warmachine`,
   `mil_domination`) — the INDUSTRIAL/ECONOMIC/SOCIAL arrays are structurally empty
   and their bonuses have no consumer.
5. **Permission + currency model is already decided in code** — unlock is
   role-gated server-side to LEADER/CO_LEADER/OFFICER
   (`clanResearchService.ts:180-182`); contributions spend personal
   `players.researchPoints` into the shared `clans.researchResearchPoints` fund.

## 3. Impact Analysis

- **Player-facing:** a cooperative system (clan RP fund → attack/defense bonuses that
  `combatPowerService` actually consumes) becomes playable. Today RP earned by players
  has a sink literally no one can reach.
- **Server-facing:** one new thin read-only GET; both mutations untouched. The UI must
  not duplicate the role gate or availability logic — those stay server-side; the panel
  renders and lets the server refuse.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — renders whatever the tree returns (any future nodes appear without UI changes); empty branches render as empty |
| Scales? | Yes — one GET + one component; contribution/unlock are the two existing POSTs |
| Survives a hostile attacker? | Server-side gates untouched; buttons disabled presentationally only |
| Maintainable? | Yes — thin adapter over `getResearchTree`; states derived from `unlocked`/`available`/`requiredLevel`, not re-derived rules |
| Sets the standard? | Yes — same ComingSoonTab→real-panel pattern the bank/warfare tabs followed |

## 5. Proposed Fix (GREEN)

**A. New `GET /api/clan/research/state`** — `requireClanMembership` →
`getResearchTree(clanId)`, returned as `{ success, tree }`. No other surface. (Role
comes from ClanPanel's existing `playerRole` prop — no role leak into the response.)

**B. New `components/clan/ClanResearchPanel.tsx`** —
- Fund header: current `researchPoints` balance.
- **Single MILITARY rendering** (honest to the C1 cut — no four fake branch tabs over
  three structurally-empty arrays; if nodes are ever re-added they render via the same
  list).
- Node cards: name, description, cost, required clan level, prerequisites, bonuses
  (attack/defense values — the only types with a consumer). Three visual states:
  `unlocked` / `available` (unlockable now) / `locked` (level or prerequisite gap).
- **Contribute:** amount input → `POST contribute { amount }` → refresh tree; server
  errors surfaced verbatim via the existing error-extraction idiom.
- **Unlock:** on available nodes for LEADER/CO_LEADER/OFFICER (presentational gate —
  `playerRole` prop) → `POST unlock { researchId }` → refresh tree; server refusal
  (including `Insufficient permissions`) surfaced verbatim.

**C. `ClanPanel.tsx`** — replace the `ComingSoonTab` line with `<ClanResearchPanel />`
receving `clanId` + `playerRole`; no other byte changes.

## 6. Audit Record

- **Loop record (ECHO v0.1.2, FID-20260916-012):**
  - **Pass 1 — RED verification:** all five anchors re-probed (placeholder line,
    zero callers, no GET, 4-node military tree, role gate at :180-182). One survey
    erratum recorded (§2.1): tab exists, content is the placeholder.
  - **Pass 2 — impact re-check:** one new GET + one component + one-line ClanPanel
    swap; no mutation logic touched. Holds.
  - **Pass 3 — alternative sweep:** extend ClanBankPanel vs separate component →
    separate (single responsibility, matches sibling panels); fold tree into an
    existing clan state endpoint → rejected (Law-11 thin routes; the research GET is
    cleanly scoped); four branch tabs vs single list → single list (C1 honesty).
  - **Pass 4 — not-to-change re-check:** C1 cut not resurrected; server role gate and
    availability logic not duplicated; node ids/costs/prereqs untouched; personal-RP
    currency untouched.
- **Convergence:** 4 passes, no new findings after pass 2 → converged.
- **Loop status: loop-complete** (2026-09-16). Implementation awaits operator go-ahead
  per protocol vocabulary.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- [x] GET `/api/clan/research/state` thin route
- [x] `ClanResearchPanel.tsx`: fund header, node cards, contribute flow, unlock flow
- [x] `ClanPanel.tsx` placeholder swap
- [x] Pins: state contract (4 nodes, fund balance), contribute/unlock request bodies,
      verbatim error surfacing, presentational role gate (3 route + 6 component pins)
- [x] Gates: tsc 0 · eslint 0/0 · vitest full suite green
- [x] Live probe: state read on a probe clan + contribute→unlock round-trip (dev DB),
      errors verbatim (scripts/e2eClanResearchRoundTrip.ts, 4/4 stages, exit 0)
- [ ] §8 hash, SCOPE row, session record

**Implementation evidence (2026-09-16):**
- `GET /api/clan/research/state` — `requireClanMembership` → `getResearchTree`, tree
  returned verbatim; no role data exposed (server re-gates at unlock time).
- `components/clan/ClanResearchPanel.tsx` — fund header, single MILITARY-honest list
  (C1 preserved), node cards in three states (unlocked/available/locked), contribute
  (numeric amount, client-side positivity check, server errors via toast verbatim),
  unlock (presentational officer gate; disabled with explanatory title for others).
- `ClanPanel.tsx` — placeholder swapped for the panel with `clanId`, `playerRole`,
  `onRefresh` (refreshes the clan-level fund display the panel cannot reach).
- Gates: tsc 0 · eslint 0/0 · vitest **951+1skip** (9 new pins) · live probe 4/4
  stages, exit 0: tree shape, contribute math exact, unlock drains fund by cost +
  records the tech, member refusal verbatim.
- Disclosures: (1) the member contribute probe exposed the fund-coverage reality —
  node 1 costs 5000 while a member holds 800, so the driver adds a leader top-up
  step before unlock (probe logic, no product code change); (2) running the gates
  here caught that the FID-011 probe driver had never been typechecked (written
  after its batch's tsc run; `pool` import + `SpyRank` typing fixed in this batch,
  probe re-run green) — full `tsc --noEmit` before every batch is now non-negotiable.

## 8. Closure

- **Commit hash (G2):** —
- **Gates (G1):** —
