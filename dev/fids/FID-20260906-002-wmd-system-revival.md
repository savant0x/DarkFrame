# FID-20260906-002: WMD System Revival (Full Mechanics Review)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-002-wmd-system-revival.md`
**ID:** FID-20260906-002
**Severity:** HIGH (operator-declared broken; large surface, 21 tables + ~12 services)
**Status:** CONVERGED + LIVE-VERIFIED (pass 6; 15/15 lifecycle assertions, gates green) — archived

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

> **PASS-3 CORRECTIONS (loop):** the original RED over-claimed service phantom-writes.
> Re-verified against code + live DB: all 21 `lib/wmd` services are already drizzle-native.
> Three NEW findings (W6–W8) are the real blockers.

### W1 — Three API routes still read the Mongo shim (root cause of "broken")
- `app/api/wmd/status/route.ts:78-83`: phantom reads `wmd_research`/`wmd_missiles`/
  `wmd_batteries`/`wmd_votes` via `getDatabase()`.
- `app/api/wmd/defense/route.ts:66-67`: shim read of `wmd_defense_batteries`.
- `app/api/wmd/missiles/route.ts:67-68,221-222`: shim reads of `wmd_missiles` + players
  by `playerId` (players PK is username — always 404s the name lookup).
- Live: all 13 wmd tables exist and are EMPTY (row counts probed).

### W2 — No seed needed; the old seed is dead Mongo code
- `lib/db/seeds/wmd.seed.ts` (797 lines) is 100% shim (`insertMany` into phantom
  collections), never invoked, schema-incompatible → **DELETE, not port**.
- Game constants do NOT live in `wmd_config` (that table is exclusively alert settings,
  key='alerts', lazily upserted by `alertService.ts:635-665`). Costs/trees are typed
  constants: `WARHEAD_CONFIGS` (missile.types.ts:345), `COMPONENT_COSTS` (:439),
  `ALL_RESEARCH_TECHS` (research.types.ts:624). S2's seed-migration plan is DROPPED.

### W3 — RETRACTED
- `researchService.ts` writes `player_research` (line 10, 174-180) and reads RP from
  `players.researchPoints` (line 125-127). Drizzle-clean. No change required.

### W4 — Voting route is shim-based (kept from original RED)
- `app/api/wmd/voting/route.ts:44,204,256` uses `getDatabase()`; rewrite to
  `wmdClanVotes`/`wmdVotes` in implementation phase.

### W6 (NEW) — Missile damage is a stub: detonations destroy nothing
- `lib/wmd/jobs/missileTracker.ts:80-93`: `applyDamage` returns zeros unconditionally.
- The real engine `lib/wmd/damageCalculator.ts` implements an absolute-damage model
  (50k–5M damage points) that matches NEITHER the tracker's percent model NOR the doc's
  70/20/10 distribution. Three competing damage models exist; none is wired end-to-end.

### W7 (NEW) — Tracker target semantics broken
- `missileTracker.ts:157,171`: passes `missile.ownerClanId` where the TARGET belongs;
  `missile.targetId` (set at launch, missileService.ts:214) is never read by the tracker.
- Interception therefore checks the ATTACKER's batteries, not the defender's.

### W8 (NEW, production blocker) — WMD jobs never run on Vercel
- Scheduler starts only in `server.ts:129` (custom server); Vercel runs route handlers
  only → missile impacts/spy completions/vote expirations/battery repairs never fire
  in production. vercel.json has no wmd cron; Hobby plan caps crons at daily anyway.
- GREEN answer: lazy self-tick (`ensureWmdJobsTicked()` with 45s in-process guard)
  invoked from WMD GET routes, plus `/api/cron/wmd-tick` (CRON_SECRET, fail-closed)
  for self-host/pro-cron use.

### W9 (NEW) — Battery status vocabulary mismatch
- Writer (`defenseService.ts`): `BatteryStatus.IDLE/COOLDOWN/DAMAGED`.
- Reader (`damageCalculator.ts:51`): filters `'OPERATIONAL'` — a status nothing writes;
  defense strength is always 0. Status route counts `IDLE/ACTIVE` (ACTIVE unwritten).

### W5 — UI renders from the same empty contract
- 7 panels → 6 endpoints (`WMDMiniStatus`→status, `WMDResearchPanel`→research,
  `WMDMissilePanel`→missiles, `WMDVotingPanel`→voting, `WMDDefensePanel`→defense,
  `WMDIntelligencePanel`/`WMDNotificationsPanel`). After W1 fixes the panels must be
  re-verified against real data.

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

## 4. GREEN Design (converged — pass 3)

- **G1 Status seam:** rewrite `app/api/wmd/status/route.ts` drizzle-native — RP from
  `players.researchPoints`; `missiles` WHERE ownerId+status='READY'; `wmd_defense_batteries`
  WHERE clanId+status='IDLE'; `wmd_spies` WHERE ownerId+status='AVAILABLE'; `wmd_votes`
  WHERE clanId+status='ACTIVE'; `wmd_notifications` WHERE scope/target unread. Same response
  contract (WMDMiniStatus keeps working).
- **G2/G3 Defense+Missiles seam:** same rewrite for defense/missiles route shim reads
  (players PK lookup by username, `missiles` by missileId).
- **G4 Real damage engine (doc-faithful):** implement `applyDamage` per design doc §162-176:
  distribution 70% units / 20% factories / 10% resources, 5% crit doubles percentages.
  Units: `players.units` jsonb (proven battleService pattern); factories: production hit
  + lastAttackedBy; resources: metal/energy reduction. Deviation logged: no 24-72h factory
  recovery job in this FID (logged to FID-006 backlog).
- **G5 Tracker target fix:** damage/interception use `missile.targetId`; interception checks
  the TARGET's clan batteries (`status='IDLE'`, matching the writer's vocabulary); on
  intercept → battery to COOLDOWN; broadcasts use owner/target names.
- **G6 Lazy self-tick:** extract tracker core to `processDueMissiles()`; `ensureWmdJobsTicked()`
  (45s guard) called at top of WMD GETs; new `/api/cron/wmd-tick` (CRON_SECRET fail-closed,
  same pattern as player-snapshot). server.ts scheduler retained for self-host.
- **G7 Notifications + admin alert:** launch → `notifyMissileLaunch`; impact →
  `createWMDNotification` (target; CLAN_BUSTER also global); `wmd_admin_alerts` row on every
  launch (S5).
- **G8 Delete dead seed:** remove `lib/db/seeds/wmd.seed.ts` + barrel; verify zero imports.
- **G9 Cost divergence (code 10k→300k RP vs doc 50k→500k):** behavior-preserving revival —
  logged to FID-20260906-006; NOT re-priced here.

## 5. Verification plan (GREEN)

1. Zero-census: `grep -rn "getDatabase\|\.collection(" app/api/wmd` → 0 shim references.
2. Live: status/research/voting/intelligence/defense/missiles each return real (non-constant)
   data for a probe player.
3. Full missile lifecycle live: create → assemble → launch → lazy-tick impact →
   assert damage landed on target units/resources/factories, notification rows written,
   admin alert present.
4. Gates: tsc 0, tests green, lint-delta 0 on new code, then push.

## 6. Loop record

- **Pass 1:** evidence verified live (row counts, phantom collections, seed absence); every
  finding mapped to an S-item; S4 explicitly staged so nothing is wired against unseeded config.
- **Pass 2 (SELF-AUDIT):** schema inventory re-checked against `lib/db/schema/wmd.ts` exports;
  §5.1 each step asserts DB state, not just HTTP codes. Delta < 2%.
- **Pass 3 (RED correction):** original W1–W5 re-verified file-by-file. W3 retracted (research
  service is drizzle-clean). Six shim references confirmed across 3 routes (not 1). New findings
  W6–W9 from deep reads: damage stub, tracker target bug, Vercel scheduler gap, battery status
  mismatch. S-plan rewritten as G1–G9.
- **Pass 4 (GREEN audit):** every G-item re-checked against exact code: battery ownership is
  CLAN-scoped (`wmdDefenseBatteries.clanId`, no ownerId column — the defense route's ownership
  check compared a phantom field); `getAuthenticatedPlayer.playerId === username`;
  `WARHEAD_CONFIGS.damage.primaryPercent` (25/50) aligns with the doc's 20-40%/50-70% unit
  bands → percent model confirmed doc-faithful; vote broadcast enrichment replaceable with
  drizzle `wmdClanVotes` reads; seed deletion safe (barrel imports verified zero).
- **Pass 5 (CONVERGENCE):** no remaining design gaps; every finding has a G-item; every G-item
  has a §5 verification step. **CONVERGED — implementation may proceed.**
- **Pass 6 (IMPLEMENTATION + live verification):** G1–G9 implemented. Live full-lifecycle probe
  **15/15**: all 5 seams return real data; probe missile launch → lazy-tick impact →
  **DETONATED with real damage** (2,794 units destroyed, 33,346 metal + 33,346 energy lost on
  the target account) → wmd_notifications row (1) → wmd_admin_alerts row (1).
  Two new defects found and fixed during verification:
  (a) `createWMDNotification` generated 33+ char ids for `varchar(24)` columns — EVERY WMD
  notification insert had silently failed; ids now ≤24 chars.
  (b) lazy-tick backoff committed even on failure, stalling retries for the full interval;
  backoff reduced 45s→10s with success-only commit + 3s failure retry.
  Probe-infrastructure lesson (not a product bug): Supabase session pooler caps 15
  clients/account — probe pools must hold ≤1 client or they starve the server they test.
  Gates: tsc 0, 341 tests green, eslint clean on all touched files. FID **CONVERGED + VERIFIED**.
- **Implementation record (all G-items built):** G1 status route rewritten drizzle-native
  (players.researchPoints, missiles, wmdDefenseBatteries IDLE, wmdSpies AVAILABLE,
  wmdClanVotes ACTIVE, wmdNotifications ALERT/CRITICAL). G2 defense battery read +
  clan-scoped ownership. G3 missiles route (detail/launch-broadcast/target lookup by
  username) + voting broadcast enrichments + notifications route (GET/PATCH/DELETE with
  viewedBy[] read-model). G4 real damage engine (70/20/10 + 5% crit; units via players.units
  quantity, factories via productionRate hit, resources via stock %). G5 tracker targets
  missile.targetId; interception consumes TARGET clan IDLE batteries → COOLDOWN.
  G6 processDueMissiles core + ensureWmdJobsTicked lazy tick (10s, retry-safe) in 3 GET
  routes + /api/cron/wmd-tick (CRON_SECRET fail-closed). G7 impact notifications (TARGETED)
  + wmd_admin_alerts on every resolution. G8 dead Mongo seed deleted.
- **Bugs found during live verification (loop pass 6):** (a) notification ids were 33+ chars
  into varchar(24) — every WMD notification insert silently failed since the pivot; fixed to
  `wn<36-radix ts><rand>` ≤24. (b) lazy-tick backoff persisted across failed ticks, stalling
  impact processing up to 45s; now commits only on success. (c) probe/tooling: Supabase
  session-pooler 15-client cap starved dev-server ticks during verification — probe held 1
  client at a time; production Vercel uses its own pool (no probe contention).
- **Live verification (15/15):** login → all 6 seams 200 with real data → probe missile
  inserted + DB-side launch → lazy-tick detonation → damage asserted on the live row
  (units 15996→13202, metal 1333866→1300520) → notification + admin alert rows present.
  Gates: tsc 0, 341 tests green, eslint clean on all touched files, shim census 0.
