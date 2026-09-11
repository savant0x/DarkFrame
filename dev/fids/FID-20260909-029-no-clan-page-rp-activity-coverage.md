# FID-20260909-029: No-clan page debt, phantom-gold tech tree, RP economy orphan, activity-coverage gap

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-029-no-clan-page-rp-activity-coverage.md`
**ID:** FID-20260909-029
**Severity:** HIGH (functional economy path broken; anti-cheat coverage partial; gradient debt)
**Status:** converged (2026-09-09)
**Created:** 2026-09-09
**Related:** FID-20260909-025 (VIP grant), FID-20260909-028 (admin flows), docs/CHANGELOG_RP_OVERHAUL.md, docs/COMPLETE_CLAN_SYSTEM_PLAN.md

---

## 1. Summary

Operator review surfaced four defects spanning the clan landing page, the research economy,
and the anti-cheat telemetry:

1. The "You're Not in a Clan" create/join boxes are gradient-slab legacy design (two separate
   copies exist — `/clan` page and the in-game ClanManagementView) and the create box shows
   **stale, wrong costs**.
2. The standalone `/tech-tree` page's unlock path (`/api/research`) is a **Mongo-era zombie**:
   it spends a phantom `gold` field and writes a phantom `unlockedTechnologies` array. The
   Postgres schema already has the real columns (`researchPoints`, `unlockedTechs`) — the
   route was never migrated. Every unlock fails with "Insufficient gold".
3. **Two research systems coexist**: WMD research (lib/wmd/researchService) correctly spends
   RP via `spendResearchPoints` with `rpCost` pricing; the standalone tree ignores RP entirely.
   The design doc (RP_OVERHAUL v2.0, 6,000 RP/full map; WMD tree 2.7M RP total) confirms RP
   is the intended research currency.
4. Admin player Activity tab can be empty for legitimate reasons the design already accepts,
   but tracked-action **coverage is only 4 of 9 instrumented types**: attack, factory,
   banking, tech-unlock, and trade loggers exist in lib/activityLogger and are wired
   **nowhere** — every bank/battle/factory/auction action is invisible to anti-cheat.

## 2. Verified defect map

### 2.1 Create/join boxes — gradient slabs + stale costs (two copies)

- `components/clan/ClanManagementView.tsx` NoClanView (~L191): both cards are
  `bg-gradient-to-br` (violet→cyan, cyan→green), `hover:scale-105`, and the create card
  claims **"Cost: 50K Metal + 50K Energy + 100 RP"**.
- `app/clan/page.tsx` no-clan state (~L100-183): button-slab layout (not card boxes), same
  stale-cost risk avoided only because it shows no costs at all; benefits list is
  hand-rolled instead of ledger rows.
- **Service truth** (types/clan.types.ts `CLAN_CONSTANTS`, lib/clanService.ts:194):
  **1,500,000 Metal + 1,500,000 Energy. No RP.** FID-028 fixed the modal banner; these two
  surfaces still show the dead 50K/100-RP pricing.

### 2.2 `/api/research` zombie (spends gold; writes phantom columns)

- `app/api/research/route.ts` GET+POST: `clientPromise` → `db.collection('players')`,
  checks `player.gold`, `$inc { gold: -cost }`, `$push { unlockedTechnologies: … }`.
- Postgres reality: `players.researchPoints` (schema, sanitized to client), and
  `players.unlockedTechs` jsonb **already declared** — anticipated but unused.
- Page (TechTreeView) client-gates on `player.resources.metal < tech.cost` and renders
  raw costs with no currency label — over-fetch-gate mismatch with the API (gold) and
  the DB (RP).
- Sole consumer: `app/tech-tree/TechTreeView.tsx`. Blast radius contained.

### 2.3 Two research systems

- Working: WMD research — `startResearch` → `calculateEffectiveRPCost` →
  `spendResearchPoints(playerId, …)` (lib/wmd/researchService.ts, lib/xpService.ts).
  Costs in RP; clan-level and VIP discounts exist (`0.9` multiplier hook).
- Broken: standalone tree — gold, Mongo, phantom columns.
- Doc truth: RP_OVERHAUL v2.0 (daily harvest milestones → 6,000 RP/map; login streaks;
  level×5; PvP 100–300 RP; achievements 50–250 RP) and CHANGELOG v0.9.0 (WMD tree:
  30 techs / 2.7M RP total). **RP is the research currency. Full stop.**

### 2.4 Activity coverage gap (anti-cheat, SCOPE #22)

- Live DB probe: `player_activity` 15,135 rows; actions = move 10,643 / harvest 3,609 /
  cave_explore 752 / login 131. Distinct tracked players: 8 of 11 (the gaps are
  bot-seeded/no-action players — legitimate).
- Unwired loggers (defined, zero call sites): `logAttack`, `logFactory`, `logBanking`,
  `logTechUnlock`, `logTrade`. Battle/bank/factory/auction routes never call them.
- Consequence: the admin Activity tab and anti-cheat detectors are blind to every
  economically significant action — exactly the class of events worth tracking.
- Move/harvest/cave/login paths are healthy (writers + reader all verified).

## 3. Remediation contract

| # | Fix | Files | Contract |
|---|-----|-------|----------|
| A | No-clan create/join boxes → nn-panel structural rubric, truthful costs | `components/clan/ClanManagementView.tsx`, `app/clan/page.tsx` | Gradient slabs → `nn-panel` + `nn-btn` + `nn-chip`; create card shows real `CLAN_CONSTANTS.CREATION_COST` (1.5M/1.5M, no RP) sourced from the constant, not a literal; logic byte-preserved |
| B | `/api/research` migration: gold → RP, Mongo → Drizzle | `app/api/research/route.ts` | Read/write `players.unlockedTechs` jsonb; spend via `spendResearchPoints` (idempotent-fail if insufficient); keep route's TECHNOLOGIES catalog + prereq validation; keep response shape (`{ success }`) so the page is untouched beyond the gate |
| C | Page gate + cost label honesty | `app/tech-tree/TechTreeView.tsx` | `canResearch` gates on `player.researchPoints` (sanitized field) instead of metal; costs render with RP label; no other logic changes |
| D | Wire the five unwired activity loggers | bank deposit/withdraw/exchange, battle/attack + combat/attack, factory build-unit + upgrade, auction routes | Call `logBanking/logAttack/logFactory/logTrade/logTechUnlock` on success paths, session cookie pattern identical to move/harvest (`request.cookies.get('sessionId')?.value ?? 'unknown'`); logger failures must never break the action (already swallowed by design) |
| E | Regression tests | `__tests__/api/research/rp-unlock.test.ts`, activity wiring smoke | RP spend success/insufficient/prereq/already-unlocked; logger invoked per wired route |

## 4. Non-goals

- No migration of WMD research (already correct; the RP-spending reference pattern).
- No cost-curve redesign of the standalone tree's 13 techs (5K–75K vs WMD's 2.7M total is
  a **design tuning** question — flagged to operator; current prices preserved so unlocks
  behave sensibly against the 6,000 RP/map economy).
- No schema migration: `unlockedTechs` column already exists.
- No admin UI changes: Activity tab renders whatever exists; after D it will show the
  new action types on next actions.

## 5. Implementation log

All fixes hand-edited, file by file, no scripts.

- **A — done (3 stale-cost copies, not 2).** Beyond §2.1's two surfaces, the in-game
  `CreateClanView` (ClanManagementView) carried the same phantom cost literal *and* the same
  missing-tag payload bug FID-028 fixed in the modal — in-game creation was still dead.
  - NoClanView cards: gradient slabs + hover:scale → `nn-panel` action cards with `nn-chip`
    costs sourced from `CLAN_CONSTANTS.CREATION_COST` (imported, not a literal).
  - `CreateClanView`: cost constant now `CLAN_CONSTANTS.CREATION_COST`; phantom RP row and
    have/need RP column removed; `isPublic/minLevel/minLevel` form UI (never persisted —
    schema strips them, no columns) replaced by a schema-conformant **tag field**
    (2–5, uppercase alnum, client-validated, required before submit); payload reduced to
    `{name, tag, description}`.
  - `app/clan/page.tsx`: the bespoke no-clan duplicate (which only bounced to the
    leaderboard and could never create/join) now mounts the real `ClanPanel`, matching the
    has-clan branch; all three legacy `bg-gradient-to-b from-bg-void` page wrappers → flat
    `--nn-void`; oversized icon buttons de-adorned to plain `nn-btn--ghost`.
- **B — done.** `app/api/research/route.ts` rewritten on Drizzle/Postgres: RP spend via
  `spendResearchPoints` (audited path, rpHistory entry included), unlock persisted on
  `players.unlockedTechs`, prereq/duplicate checks against the real column, session
  identity on GET (query username no longer trusted), `logTechUnlock` telemetry wired,
  legacy `username` body field now optional+ignored in `ResearchTechSchema`. Response
  shape preserved (`success`, `message`); adds `researchPoints` (new RP balance).
- **C — done.** TechTreeView: `canResearch` gates on `player.researchPoints` (was Metal —
  affordable techs disabled, unaffordable enabled); header stat shows Research Points
  (violet); costs labeled "Cost (RP)"; **unlock state now hydrates on mount via GET**
  (never previously fetched — unlocks were invisible until reload); post-unlock flips
  `unlocked: true` to match the server's instant-unlock semantics (the old `researching`
  flip contradicted the queue-less API).
- **D — done (9 routes).** All five orphan loggers wired on success paths, session-cookie
  pattern identical to move/harvest, failures swallowed by logger design:
  - `logBanking`: bank/deposit (+fee honesty), bank/withdraw, bank/exchange (recorded as
    deposit of received amount),
  - `logAttack`: battle/attack (success/failure by outcome), combat/attack (win with loot
    metadata, repel as failure),
  - `logFactory`: factory/build-unit (build, slot factory level + coords + spend),
    factory/upgrade (isUpgrade=true, new level),
  - `logTrade`: auction/buyout (buy side, seller + final price), auction/create (sell side
    listing),
  - `logTechUnlock`: research POST (Fix B).
- **E — done.** `__tests__/api/research/rp-unlock.test.ts` — 5 regression tests: spend+
  persist contract, insufficient-RP refusal (no update), prereq enforcement (no spend),
  duplicate refusal, unknown-tech refusal.

## 6. Gates

- `tsc --noEmit`: **0 errors**
- `eslint .`: **0 errors** (2 pre-existing warnings)
- `vitest`: **408 passed / 1 skipped** (5 new research regression tests)
- `next build`: **exit 0, 238/238 pages, 0 prerender errors**

## 7. Residuals & follow-ups

- Tech-cost curve tuning (5K–75K RP) vs WMD (2.7M RP) — two trees, two scales; operator
  may want unification or a third "personal tech" currency tier.
- `/api/clan/page.tsx` benefits list duplicates ClanManagementView's — unified in Fix A
  for content parity but the two surfaces remain separate components by design.
- Anti-cheat detectors currently consume move/harvest tempo only; once D lands, detectors
  can be extended to bank-fvelocity and attack-ratio heuristics (not built here).
