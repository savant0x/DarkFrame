# Law-17 ticket triage — the 8 remaining ticketed tables (2026-09-19)

**Method:** full reference census per table (writer + reader sites, excluding the
schema-defining file and archives), a **live id-width probe** against the real DB,
writer-reachability tracing (each writer's enclosing function → its callers → its
route/job), and a UI-consumer sweep. Every verdict below is backed by a probe, not
an inference. All 8 tables hold **0 rows** in the live DB.

The census classes: `write-only` = writers exist, no reader; `read-only` = readers
exist, no writer; `no-consumer` = neither.

---

## Summary disposition set (recommended)

| # | Table | Class | Writer reachable? | Writer works? | Reader? | Verdict |
|---|---|---|---|---|---|---|
| 1 | `achievements` | read-only | **no writer at all** | — | admin stats route | **REMOVE** |
| 2 | `wmdVotes` | no-consumer | — | — | none | **REMOVE** |
| 3 | `wmdConsequenceEvents` | write-only | **no** (dead wrapper) | — | none | **REMOVE** |
| 4 | `wmdResourcePools` | write-only | yes | yes | none | **REMOVE** |
| 5 | `wmdDefenseGrids` | write-only | yes | yes | none | **REMOVE** |
| 6 | `wmdIntelligenceReports` | write-only | yes | **NO — id overflow** | none | **WIRE** |
| 7 | `wmdCounterIntelOperations` | write-only | yes | **NO — id overflow** | none | **WIRE** |
| 8 | `wmdInterceptions` | write-only | yes | **NO — id overflow** | none | **WIRE** |

Net: **5 removes, 3 wires.** Removing 5 takes the census to 57 tables, 54 live,
3 ticketed; wiring the 3 takes it to 57 tables, 57 live, **0 ticketed**.

---

## The three broken writers (the sharpest finding)

All three pass FID-20260903-002's own convention — *"Lengthen [id] to 50 where
callers exceed 24 (verified per column below)"* — and all three **violate it**: the
`id` column is `varchar(24)` while the callers generate longer ids. Live id-width probe:

| Table | Generated id | Length | Column | Result |
|---|---|---|---|---|
| `wmd_intelligence_reports` | `wir_<ts>_<rand>` | 27 | varchar(24) | **overflows** |
| `wmd_counter_intel_operations` | `wcio_<ts>_<rand>` | 28 | varchar(24) | **overflows** |
| `wmd_interceptions` | `wi_<ts>_<rand>` | 26 | varchar(24) | **overflows** |
| `wmd_resource_pools` | `pool_<ts>`.slice(24) | 18 | varchar(24) | ok |
| `wmd_defense_grids` | `grid_<ts>` | 18 | varchar(24) | ok |
| `wmd_consequence_events` | `ce_<ts>` | 16 | varchar(24) | ok |

Consequences (traced, not inferred):

- **`wmdIntelligenceReports`** — written by `generateIntelligence` (spyService:1019),
  called from `completeMission` (spyService:412) on **every successful spy mission**.
  The insert throws (uncaught inside `generateIntelligence`), so mission completion
  fails whenever intel is generated. Reachable via `POST /api/wmd/intelligence`
  (`completeMission`).
- **`wmdCounterIntelOperations`** — written by `recordCounterIntelOperation`
  (spyService:1477), called from `counterIntelligenceSweep` (spyService:651),
  reachable via `POST /api/wmd/intelligence`. Wrapped in try/catch → the failure is
  **silently swallowed**; the sweep "succeeds" and records nothing.
- **`wmdInterceptions`** — written by `defenseService.attemptInterception`
  (defenseService:145), reachable via `POST /api/wmd/defense` (`action: intercept`).
  Not caught in the service; the route's outer catch turns it into a 500 on a
  **successful** interception — i.e. a working interception reports failure.

**WIRE** (recommended) fixes three real bugs **and** gives each table a reader:
- intel reports → `WMDIntelligencePanel` (report history with target + expiry)
- counter-intel ops → `WMDIntelligencePanel` (sweep history)
- interceptions → `WMDDefensePanel` (defense history; currently only a socket toast)

## The five removes, with evidence

- **`achievements`** — read-only; has **no writer anywhere**. Every player-facing
  achievement read uses `players.achievements` (jsonb): `/api/player/profile`,
  `/api/profile/[username]`, `/api/admin/players/[username]`, `ProfileView`. The
  only table reader is `/api/admin/achievement-stats`, which aggregates a table that
  can never fill. Remove the table; retarget that admin route to the jsonb (or drop
  the route).
- **`wmdVotes`** — **zero references repo-wide**. The live vote store is
  `wmdClanVotes` (used by `/api/wmd/status`, `/api/wmd/voting`, admin status). A
  pre-revival orphan. Drop.
- **`wmdConsequenceEvents`** — its only writer `logConsequenceEvent`
  (clanConsequencesService:299) is called only from `applyClanWMDConsequences`, which
  has **zero callers repo-wide**. The whole consequence module is unwired (its
  `wmdRetaliationRights` writer sits in the same dead wrapper). Drop the table and the
  dead wrapper; the consequence *feature*, if wanted, is a separate FID.
- **`wmdResourcePools`** — written on `RESOURCE_POOLING` vote resolution (reachable
  via cast/veto). But no reader anywhere and no UI concept; the recorded pool amount
  is never spent. Remove (wiring real pooling is a feature, not a census fix).
- **`wmdDefenseGrids`** — same shape: written on `DEFENSE_GRID` vote resolution, no
  reader, no UI. Real clan defense lives in `wmdDefenseBatteries`; the "grid" is a
  parallel concept with no consumer. Remove.

## Notes / adjacent observations (not part of the 8)

- The entire `clanConsequencesService` module is effectively unwired: its writer entry
  `applyClanWMDConsequences` has no callers, and its exported readers
  (`hasRetaliationRights`, `useRetaliationRight`, `isClanOnWMDCooldown`) have no
  callers either. `wmdRetaliationRights` is classified live by the census only because
  its writer+reader both exist inside that dead module. Worth a separate disposition.
- The `RESOURCE_POOLING` / `DEFENSE_GRID` vote types remain castable in
  `clanVotingService`/`voteExpirationCleaner` but produce no consumed effect; removing
  their tables leaves the actions as no-ops (flag for the vote-feature decision).
