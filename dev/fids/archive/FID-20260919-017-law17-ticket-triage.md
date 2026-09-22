# FID-20260919-017 — Law-17 ticket triage: 5 removes, 3 wires (clears the queue)

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-19 (operator directive: "Triage the 8 remaining Law-17 ticketed tables into wire-vs-remove with evidence, and present the disposition set for approval" → approved as recommended)
**Origin:** FID-20260919-014's Law-17 census. Full triage: `dev/LAW17-TICKET-TRIAGE-2026-09-19.md`.

---

## 1. Disposition (operator-approved)

All 8 ticketed tables held **0 rows**; every verdict is probe-backed.

**REMOVE (5):** `achievements`, `wmdVotes`, `wmdConsequenceEvents`, `wmdResourcePools`, `wmdDefenseGrids`
**WIRE (3):** `wmdIntelligenceReports`, `wmdCounterIntelOperations`, `wmdInterceptions`

## 2. Removes — evidence

- **`achievements`** — read-only; **no writer anywhere**. Live achievements are
  `players.achievements` jsonb (all player-facing reads). Its only reader,
  `/api/admin/achievement-stats`, aggregates a table that can never fill → retarget to
  the jsonb.
- **`wmdVotes`** — **zero references repo-wide**; superseded by the live `wmdClanVotes`.
- **`wmdConsequenceEvents`** — only writer `logConsequenceEvent` sits behind
  `applyClanWMDConsequences`, which has **zero callers repo-wide** (the whole
  consequence module is unwired — recorded separately in the triage).
- **`wmdResourcePools`** / **`wmdDefenseGrids`** — writers reachable (vote resolution)
  but no reader anywhere and no UI concept; the pool amount is never spent and real
  defense is `wmdDefenseBatteries`.

## 3. Wires — the three broken writers

FID-20260903-002's own convention ("lengthen id to 50 where callers exceed 24") is
violated by all three; live id-width probe confirms:

| Table | Generated id | len | col max | effect |
|---|---|---|---|---|
| `wmd_intelligence_reports` | `wir_<ts>_<rand>` | 27 | 24 | insert throws → **successful spy missions fail to complete** |
| `wmd_counter_intel_operations` | `wcio_<ts>_<rand>` | 28 | 24 | insert silently swallowed → sweep records nothing |
| `wmd_interceptions` | `wi_<ts>_<rand>` | 26 | 24 | insert throws → **successful interception 500s** |

Fix: `generateId()` (23 chars) for the PK (no migration needed). Then give each a
reader — the columns already carry the owner:
- reports → mission join via `wmdSpyMissions.ownerId`; `GET /api/wmd/intelligence?type=reports`
  → `WMDIntelligencePanel` "Reports" view.
- counter-intel ops → `operatorId`; `GET /api/wmd/intelligence?type=counter-intel`
  → same panel.
- interceptions → `defenderId`; `GET /api/wmd/defense?history=1` → `WMDDefensePanel`
  history section.

## 4. Gates
Pins: removal migration content + schema exports gone; the three writers emit ≤24-char
ids (table-name + id-length asserted); reader services return owner-scoped rows. Live
probe: id widths fit; a reader round-trip returns a planted row per table. Full suite /
tsc / eslint / Law-17 census (target: 0 ticketed).

## 8. Closure

Implemented same session on operator directive. Implementation commit: `da29f5b`
(20 files, +753/−158). Closed on `da29f5b`.

**The Law-17 ticket queue is empty: 57 tables — 57 live, 0 ticketed, 0 violations.**

**Removes (migration 0038, applied to the dev DB — all five gone):** `achievements`,
`wmd_votes`, `wmd_consequence_events`, `wmd_resource_pools`, `wmd_defense_grids`.
Schema exports + barrel entries removed; the two dead writers
(`logConsequenceEvent`, the RESOURCE_POOLING / DEFENSE_GRID vote-action inserts)
removed with them; the admin achievement-stats route now rolls up the live
`players.achievements` jsonb (one `jsonb_array_elements` unnest) instead of the
retired table.

**Wires:** the three tables whose reachable writers had been silently failing on
`varchar(24)` PK overflow now use `generateId()` — `wmd_intelligence_reports`
(spy-mission completion no longer throws), `wmd_counter_intel_operations` (sweeps
record again), `wmd_interceptions` (a successful interception no longer 500s).
Readers added: `getPlayerIntelligenceReports` / `getPlayerCounterIntelHistory`
(spyService) and `getDefenderInterceptions` (defenseService), served by new
`/api/wmd/intelligence?type=reports|counter-intel` and `/api/wmd/defense?history=1`
types and mounted as a Reports view (`WMDIntelligencePanel`) and an Interception
Log (`WMDDefensePanel`).

**Evidence:** 12 pins + live driver `scripts/e2eLaw17TriageLive.ts` **11/11** —
the five tables absent, all three repaired writers accepting a `generateId()` PK,
all three readers returning their owner-scoped planted rows, and a clean teardown.
Gates: suite **1274/1274** (131 files), tsc 0, eslint clean; census 57 tables —
**57 live, 0 ticketed, 0 violations**.

**Pin maintenance recorded:** the FID-016 and FID-017 pins initially asserted
"is the newest migration file" — brittle now that 0038 exists. Both were relaxed to
"exists as a tracked migration file", preserving the invariant without the trap.

**Adjacent finding (recorded, not actioned):** the entire `clanConsequencesService`
module is unwired — its entry `applyClanWMDConsequences` and its exported readers
have no callers. `wmdRetaliationRights` is classed live only because that dead
module holds both a writer and a reader. A separate disposition is warranted.
