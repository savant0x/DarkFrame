# FID-20260906-002: WMD System Revival (Full Mechanics Review)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-002-wmd-system-revival.md`
**ID:** FID-20260906-002
**Severity:** HIGH (operator-declared broken; large surface, 21 tables + ~12 services)
**Status:** created (RED complete; GREEN gated on convergence + operator approval)

---

## 1. Summary

Operator report: "the WMD system is broken/non-functional." RED evidence confirms: the schema
and services exist (21 `wmd_*`/`missiles` tables, 12 services in `lib/wmd/`), but the **read
layer still queries Mongo-era phantom collections**, the **config/seed data was never applied**
(every config table is empty), and therefore every WMD surface returns empty/null. This FID
covers a full mechanics review and staged revival.

## 1a. Design-doc grounding (source of truth)

The operator located the original specs — the mechanics come from these, not invention:
- **`docs/WEAPONS_OF_MASS_DESTRUCTION_DESIGN.md`** (1,294 lines): damage formula
  (`Tech Level × 50,000 + Warhead bonus`, distribution 70% units / 20% factories / 10%
  resources, 5% crit ×2), full 10-tier missile research tree (T1 50,000 RP → T10 500,000 RP),
  5-component sequential missile assembly (1.85M metal / 1.9M energy / 50h total), defense
  tree (T1–T8, 2.36M RP), interceptor batteries (2 max, 10 interceptors, 1/24h regen),
  spy missions + counter-intel, sabotage, Clan Buster rules (80% clan vote, 7-day cooldown,
  distribution 50/30/20, global broadcast + "Nuclear Aggressor" status).
- **`docs/WMD_IMPLEMENTATION_PLAN.md`** (1,612 lines) + **`WMD_PLANNING_COMPLETE.md`** +
  **`WMD_CODE_REVIEW.md`**: the code review asserts services "✅ fully functional" — written
  pre-Postgres-pivot against the Mongo shapes; this FID treats those claims as unproven until
  each is re-verified against the real Postgres tables.

All GREEN design in §4 must be re-derived to serve THESE formulas/trees (e.g. `wmd_config`
seeding = the doc's research costs, component costs, warhead bonuses — not invented numbers).

## 2. Findings (RED — file:line, verified live)

### W1 — Status route reads phantom collections (root cause of "broken")
- `app/api/wmd/status/route.ts:78-81`: reads `wmd_research`, `wmd_missiles`, `wmd_batteries`,
  `wmd_spies` via the shim. Real tables (live-checked): `player_research`, `missiles`,
  `wmd_defense_batteries`, `wmd_spies`. Verified live: `GET /api/wmd/status` → all zeros;
  `GET /api/wmd/research` → `research: null`.
- `lib/db/schema/wmd.ts` real exports: `missiles`, `playerResearch`, `wmdNotifications`,
  `wmdDefenseBatteries`, `wmdVotes`, `wmdSpyMissions`, `wmdClanVotes`, `wmdSuspiciousActivity`,
  `wmdAdminAlerts`, `wmdConfig`, `wmdSpies`, … (full inventory captured in the file).

### W2 — Config/seed data never seeded
- Live row counts: `wmd_config: 0`, `wmd_defense_batteries: 0`, `wmd_spies: 0`,
  `wmd_resource_pools: 0`; `wmd_research` does not even exist as a table (phantom name).
- `lib/db/seeds/wmd.seed.ts` exists but **no script/route ever invoked it** (grep: only the
  seed barrel references it). Consequence: even correctly-wired reads return defaults with no
  game constants (research costs, missile damage, build times) anywhere.

### W3 — Research write path targets the phantom table
- `lib/wmd/researchService.ts` (census from earlier session): persists research progress to
  `wmd_research` (phantom). Real table is `player_research` (schema `wmd.ts:38`).

### W4 — Clan voting correctly clan-gated but downstream dead
- Verified live: `GET /api/wmd/voting` → `{error: "Not in a clan"}` — correct gate, but the
  vote tally/launch-authorization chain reads `wmd_votes`/`wmd_launch_authorizations` through
  the same phantom-name patterns (audit in implementation phase).

### W5 — UI renders from the same empty contract
- `app/wmd/page.tsx` + `components/wmd/*` render `status.rp/missilesReady/batteriesActive/...`
  — all zeros today. After W1–W3 are fixed the UI must be re-verified against real data, and
  its calls inventoried (operator wants a complete mechanics review, not just wiring).

## 3. Five Questions (RED)

1. **What breaks if we do nothing?** WMD stays a dead menu — operator's explicit complaint.
2. **Why now?** Operator directive; also the audit thread keeps surfacing WMD as the largest
   remaining dead feature.
3. **Who is affected?** All players (new combat layer), clans (voting/retaliation), admins
   (`wmd_admin_alerts` flow).
4. **Smallest correct change?** (a) repair read/write seams to the real tables, (b) apply the
   seed as migration 0017 (idempotent), (c) drive one full missile lifecycle live.
5. **What must NOT change?** Damage math (`damageCalculator.ts`), clan consequence rules, and
   the security model (all WMD writes must stay session-identity + admin-gated where they are).

## 4. GREEN Design (sketch — converges in loop before implementation)

- **S1 Seam:** `lib/wmd/stateService.ts` — single read path (`getWmdState(username)`) mapping
  real tables; every `app/api/wmd/*` GET consumes it. Kill all phantom-collection references
  (census to zero).
- **S2 Seed-as-migration:** port `wmd.seed.ts` into `lib/db/migrations/0017_wmd_seed.sql`
  (idempotent), with values **reconciled against the design doc's tables** (research costs,
  component costs, warhead bonuses, interceptor specs) — doc wins on any mismatch.
- **S3 Research:** `researchService` writes `player_research`; costs read `wmd_config`.
- **S4 Lifecycle target:** research → build missile → target validation (`targetingValidator`)
  → launch auth (clan vote where applicable) → flight → damage/interception → notification.
  Each stage verified live with a probe account before the next is wired.
- **S5 Admin alerts:** `wmd_admin_alerts` written by launch attempts; surfaced in admin panel
  (cross-ref FID-20260906-003).

## 5. Verification plan (GREEN)

1. Zero-census: `grep -rn "wmd_research\|wmd_batteries\|wmd_missiles'" app/api lib` → 0.
2. Live: status/research/voting/intelligence/defense each return real (non-constant) data.
3. Full missile lifecycle test on local server with probe accounts; assert each table receives
   expected rows and damage lands on a real target.
4. Admin alert appears in admin panel after a launch.
5. Gates: tsc 0, tests green, lint-delta 0, prod sweep segment clean, then push.

## 6. Loop record

- **Pass 1:** evidence verified live (row counts, phantom collections, seed absence); every
  finding mapped to an S-item; S4 explicitly staged so nothing is wired against unseeded config.
- **Pass 2 (SELF-AUDIT):** schema inventory re-checked against `lib/db/schema/wmd.ts` exports;
  §5.1 each step asserts DB state, not just HTTP codes. Delta < 2%.

**Status:** created — loop continues; implementation only after convergence + operator approval.
