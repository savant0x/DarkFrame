# FID-20260923-001 — Timestamp timezone integrity: the naive-column class + the two open retaliation calls

**Filename:** `FID-20260923-001-timestamp-timezone-integrity.md`
**ID:** FID-20260923-001
**Severity:** HIGH
**Status:** verified (implemented 2026-09-23; gates green; G2 commit pending)
**Created:** 2026-09-23

---

## 1. Summary

The PostgreSQL store carries **two incompatible timestamp conventions at once**. Of 165
timestamp columns, **135 are `timestamp without time zone`** (naive) and 30 are
`timestamptz`. Naive columns have no single meaning: a value written by the *application*
(node-pg serializes a JS `Date` in process-local wall clock) and a value written by the
*database* (`defaultNow()` = UTC wall clock) mean **different instants**, because the Node
process runs `America/New_York` while the DB session timezone is `UTC`. The app and the DB
therefore disagree by the process UTC offset — **4 hours today, DST-variable** — and they
disagree *in opposite directions depending on who wrote the row*, which is why this has
survived so long without being noticed as one bug: it looks like two unrelated 4-hour
oddities. FID-20260919-018 found one instance of this class (the clan WMD cooldown, fixed
by migration 0039) and left the other three missile columns flagged. This FID eliminates
the class rather than the instance, and answers the two retaliation calls that -018
deliberately did not decide.

## 2. Evidence (RED)

Every finding below is a live probe against the dev DB (`.env.local`), not an inference.
Process timezone `America/New_York`; DB session timezone `UTC`.

**(a) The mechanism, proven at the wire.** node-pg serializes a JS `Date` parameter in
local wall clock *with* offset; a naive cast discards the offset, a `timestamptz` cast
keeps the instant:

```
$ node -e "…new Date('2026-09-19T12:00:00Z') as param…"
param Date 12:00Z sent to pg as : 2026-09-19T08:00:00.000-04:00
  ::timestamp text              : 2026-09-19 08:00:00        <-- offset DISCARDED
  ::timestamptz text            : 2026-09-19 12:00:00+00      <-- instant kept
```

**(b) DB-defaulted naive column: the app reads it 4h in the FUTURE.** `players.created_at`
is written by `DEFAULT now()` (migration 0005). The DB's own view of the row's age is
correct; node-pg's parse makes the app see it 4h younger:

```
=== DB TRUTH ===
  w15bontp3u created_at(raw)=2026-09-21 20:13:51.946  DB-age=43.62h
=== APP VIEW (node-pg parsed) ===
  w15bontp3u createdAt=2026-09-22T00:13:51.946Z  app-age=39.62h
```

**(c) App-written naive column: the app is RIGHT and the DB view is 4h wrong.** The mirror
image, on six independent columns — every one shows the same 4.0h delta because none of
them was written by the DB:

```
chat_messages.timestamp        raw=2026-09-19 19:36:07.735 | DB-age=92.3h app-age=88.3h delta=4.0h
wmd_alerts.created_at          raw=2026-09-22 18:04:22.513 | DB-age=21.8h app-age=17.8h delta=4.0h
player_sessions.created_at     raw=2026-09-19 20:24:57.102 | DB-age=91.5h app-age=87.5h delta=4.0h
flag_trail.created_at          raw=2026-09-14 15:54:21.275 | DB-age=216.0h app-age=212.0h delta=4.0h
shrine_blessings.created_at    raw=2026-09-21 20:13:53.625 | DB-age=43.7h app-age=39.7h delta=4.0h
```

**(d) Inventory.** 135 naive vs 30 timestamptz against `information_schema.columns`:

```
$ node -e "…SELECT table_name, column_name, data_type … data_type LIKE 'timestamp%'…"
=== NAIVE (timestamp without time zone): 135 ===   (auctions.*, bans.*, missiles.*, players.*, wmd_* …)
=== timestamptz: 30 ===
```

**(e) The five DB-defaulted naive columns** (the direction that is actually wrong *in the
app today*), found by `defaultNow()` + migration `DEFAULT now()`:

| Table.column | Writer |
| ------------ | ------ |
| `players.created_at` | `defaultNow()` + `0005_lucky_leper_queen.sql:1 ALTER … SET DEFAULT now()` |
| `clan_wars.declared_at` / `created_at` / `updated_at` | `defaultNow()` + `0029_clan_wars.sql:17,33,34 DEFAULT now()` |
| `player_level_history.captured_at` | `defaultNow()` + `0031_player_level_history.sql:16 DEFAULT now()` |
| `flag_trail.created_at` | `0015_flag_trail.sql:16 DEFAULT now()` |

**(d2) The per-class conversion is proven lossless for app-visible behaviour.** The plan's
load-bearing claim, validated live before it was written into §5 — for app-written columns
`AT TIME ZONE 'America/New_York'` reproduces *exactly* the instant node-pg already hands the
app; for DB-defaulted columns the UTC conversion is the correct one and the NY conversion is
the 4h error:

```
=== APP-WRITTEN: converted vs app-parsed instant ===
  raw=2026-09-19 19:36:07.735  converted=2026-09-19T23:36:07.735Z  app=2026-09-19T23:36:07.735Z  MATCH=true
  raw=2026-09-19 19:29:52.268  converted=2026-09-19T23:29:52.268Z  app=2026-09-19T23:29:52.268Z  MATCH=true
=== DB-DEFAULTED: converted (UTC convention) ===
  raw=2026-09-21 20:13:51.946  converted=2026-09-21T20:13:51.946Z
  (if converted with America/New_York instead: 2026-09-22T00:13:51.946Z  <-- 4h off)
```

That is what makes the migration safe: it changes the *storage type* while preserving the
instant every current reader already computes. Zone **names** (not fixed offsets) resolve DST
per stored value, so pre-transition history converts correctly too.

**(f) The convention is environment-dependent.** The stored wall clock depends on where the
process ran, not on the schema: local dev (`America/New_York`) stores NY wall clock; a
UTC host (Vercel's default) stores UTC wall clock — into the **same column, same table**.
Any given naive column can therefore hold a mix of offsets across environments and DST
periods. This is the finding that makes "convert with a fixed offset" invalid and makes
per-row repair of some columns only approximate.

**(g) No gate exists.** Law 17 governs *table consumers*; nothing governs *column types*.
`timestamp('col')` without `{ withTimezone: true }` is a one-word omission that silently
re-creates this class. Migration 0039 fixed four columns by hand; migrations 0032
(`protection_until`) and 0039 are precedents, not enforcement.

**(h) The two open retaliation calls** (from FID-20260919-018 §8, recorded as decisions,
not omissions):

- `lib/wmd/clanConsequencesService.ts:92` — `const RETALIATION_WINDOW = 30 * 24 * HOUR;`
  an unreviewed 30-day magic constant; no product rationale recorded anywhere.
- **Retaliation rights have no surface.** The only consumers repo-wide are the launch
  gate (`lib/wmd/missileService.ts:248,259` — `hasRetaliationRights` /
  `consumeRetaliationRight`). A player granted a right cannot see that they hold it, what
  it is against, or when it expires; the clan WMD cooldown is likewise invisible. The
  actionable effect exists (`missileService` honours it) but the affordance does not.

Call-graph (Law 4): `missileTracker.processDueMissiles` → detonation → `applyClanWMDConsequences`
→ writes cooldown/relations/retaliation rows (all now `timestamptz` after 0039, so this
specific path is clean) → the launch path consults it. The naive columns above are reached
from ordinary reads: `players.created_at` from account-age gates (`antiCheatDetector.ts:712`),
`auctions.expires_at` from the auction sweeper, `bans/mutes.expires_at` from moderation
checks, `missiles.impact_at` from the tracker's due-sweep.

## 3. Impact Analysis

- **Who/what is affected:** all 135 naive columns; concretely the 5 DB-defaulted ones
  (app-visible 4h error today), and any SQL-side view of the ~130 app-written ones.
  Player-facing paths that read a DB-defaulted column include account-age anti-cheat
  (`antiCheatDetector.ts:712`), daily-streak / login-date logic, and level-history
  timestamps (`player_level_history.captured_at`).
- **Failure modes:** (1) app-vs-DB 4h disagreement, DST-variable, silently in both
  directions; (2) any raw-SQL comparison (sweeper `WHERE impact_at <= now()`, expiry
  `WHERE expires_at < now()`, retention cutoffs) is 4h off for app-written rows — a
  cooldown can read as 28h instead of 24h, exactly the -018 symptom; (3) environment-
  dependent storage makes the same feature behave differently on dev vs prod; (4) symptoms
  shift by an hour twice a year, so any manual tally is unreliable.
- **Blast radius of the fix:** direct — schema column types, one idempotent data
  migration, a new gate script + protocol note, and the retaliation decisions. Transitive
  — every read of a converted column, which is why the conversion must preserve the
  instant that the *app currently computes* for app-written columns (and the instant the
  *DB currently computes* for DB-defaulted ones). Both are known and provable per column.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — per-column conversion by zone *name* (not fixed offset) handles DST for every historical value; DB-defaulted columns use the UTC convention. Mixed-writer columns are detected and decided explicitly, never silently. |
| Scales (design tolerates growth)? | Yes — a census script + schema convention makes new columns correct by construction instead of by vigilance. |
| Survives a hostile attacker? | Yes — removes an entire class of time-based bypass (e.g. an expiry that is 4h late/early is a real exploit window); no new input surface. |
| Maintainable in 2 years? | Yes — one vocabulary (`timestamptz` = instant), enforced by a gate; removes the "which convention is this column?" question permanently. |
| Sets the standard for the industry? | Yes — "never store an instant in a naive column" is the canonical rule; this makes it machine-checked rather than aspirational. |

All five are `yes`; no redesign required.

## 5. Proposed Fix (GREEN)

**Approach — eliminate the class, not the instances.**

1. **Classify every naive column by its actual writer** (automated pass, evidence in §6):
   - `.defaultNow()` / migration `DEFAULT now()` → **DB-UTC convention** (5 columns, §2e).
   - JS `Date` passed by application code → **app-local convention** (`America/New_York`).
   - No non-trivial writer, or mixed → **flagged**; decided per column, never silently.
2. **One idempotent migration (0040)** converting all 135 naive columns to `timestamptz`
   with the correct zone **name** per class (`AT TIME ZONE 'UTC'` for DB-defaulted,
   `AT TIME ZONE 'America/New_York'` for app-written — zone names resolve DST per value).
   Guarded and re-runnable per the 0032/0037/0039 convention.
3. **Flip the schema declarations** to `{ withTimezone: true }`. Note the useful consequence:
   once a column is `timestamptz`, `defaultNow()` becomes *correct* (`now()` into a
   timestamptz is the true instant), so the five §2e columns self-heal in the write direction
   too — no writer change is required for them, only the type.
4. **Standing gate (new `scripts/timestampConventionCensus.ts`)** — fails on any
   `timestamp(` without `withTimezone: true`, and on `defaultNow()` over a naive column;
   wired into `pre-push` beside the existing route/schema gates.
5. **Protocol note** in the single-agent spec: instants are `timestamptz`; naive types are
   not permitted for stored instants.
6. **Retaliation — surface it** (per the signed decisions below): expose the clan WMD
   cooldown and any live retaliation right in the WMD/clan UI, and set the window to the
   recorded **7 days**.
7. **Pin `TZ=UTC` in the process — only after the migration.** Post-conversion every stored
   instant is a true instant, so the pin is safe and adds determinism to any remaining date
   math; before the migration it is the trap documented in the rejected-alternatives table.

**Alternatives considered and rejected:**

| Alternative | Why rejected |
| ----------- | ------------ |
| Pin `TZ=UTC` in the process, leave the schema alone | **Proven wrong by probe.** It harmonizes the 5 DB-defaulted columns (43.66h = 43.66h under `TZ=UTC`) but simultaneously *breaks* the ~130 app-written columns, whose stored values are local wall clock and would then read 4h off — trading 5 columns of error for 130. Correct only *after* the migration, as a determinism belt-and-braces. |
| Convert with a fixed `-04:00` offset | Wrong for every value written under EST (`-05:00`) — ~a third of the year and all pre-DST-transition history. |
| Fix only the columns that "look" broken | The class is the problem; 0032 and 0039 were two instances of it and it re-appeared each time. Instances recur; the gate is the fix. |
| Set the DB session timezone to `America/New_York` instead | Makes the DB agree with dev and disagree with prod/UTC hosts, and still leaves instants naive. |

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `scripts/classifyTimestampColumns.ts` | create | Writer-convention classification with pasted evidence per column |
| `lib/db/migrations/0040_timestamptz_conversion.sql` | create | Idempotent per-class conversion of all 135 naive columns |
| `lib/db/schema/*.ts` | modify | `withTimezone: true` on converted columns; `defaultNow()` corrected where it remains |
| `scripts/timestampConventionCensus.ts` | create | Fail-closed gate: no naive instants, no naive `defaultNow()` |
| `.githooks/pre-push` | modify | Wire the new gate beside the existing gates |
| `dev/echo-v0.1.2-single-agent.md` | modify | Spec note: stored instants are `timestamptz` |
| `lib/wmd/clanConsequencesService.ts` | modify | `RETALIATION_WINDOW` 30d → **7 days** (operator-signed), rationale in the comment |
| `components/WMDIntelligencePanel.tsx` (or clan/WMD surface) | modify | Surface clan WMD cooldown + live retaliation rights — target and expiry (operator-signed) |
| `__tests__/**` + `scripts/e2eTimestampIntegrityLive.ts` | create | Pins + live round-trip proof across both conventions |

**Edge cases the classification pass must resolve explicitly** (never silently):

- **Mixed-writer column** — some rows DB-defaulted, some app-written. Detectable because the
two classes cluster 4h apart in wall clock; per-column decision required, since one
conversion cannot be correct for both.
- **Environment-mixed column** — the same column written from a NY host and a UTC host
(finding (f)). Detection is a cluster check; repair may be approximate, and that must be
recorded per column rather than asserted clean.
- **No-writer / probe-only column** — convert the type, leave the (empty) data alone.
- **Date-only columns** (`bans.expires_at` used as a day boundary, etc.) — confirm whether the
value is an instant or a calendar date before converting; a calendar date is not an instant.

**Verification plan** (from `protocol.config.yaml → verification`): `npx tsc --noEmit` → 0;
`npm run lint` → 0/0; `npm run test:ci` → all pass; plus the new census gate exits 0 and
the live driver proves, per class, that the post-migration instant equals the instant the
app computed *before* the migration.

**Call-graph reachability plan:** `grep` proof that (a) the census script is invoked by
`.githooks/pre-push`, (b) the WMD cooldown/rights surfaces are reachable from a mounted
route → panel, and (c) the launch gate still reads `hasRetaliationRights`.

### Operator decisions (signed 2026-09-23)

1. **Scope — all 135 columns.** The class is eliminated outright, so the new gate is fully
   fail-closed with no exception list. Supersedes the behaviour-critical-subset option.
2. **Retaliation window — 7 days.** Recorded product value; replaces the unreviewed
   `30 * 24 * HOUR`. `RETALIATION_WINDOW = 7 * 24 * HOUR`, with the rationale recorded in
   the code comment (proportionate to the 24–72h post-attack cooldowns the right bypasses).
3. **Retaliation visibility — surface it.** The clan WMD cooldown and any live retaliation
   right (target clan + expiry) become visible in the WMD/clan UI, so the mechanic has an
   affordance rather than only an effect.

## 6. Audit Record

Perfection Loop on this FID document. Change % measured as edited-line delta against the
prior pass; convergence = two consecutive passes under 2%; breakers per
`protocol.config.yaml → perfection_loop`.

| Pass | What changed | Change % | Converged? |
| ---- | ------------ | -------- | ---------- |
| 1 | RED established: mechanism probe, both-direction live evidence, 135/30 inventory, 5 DB-defaulted columns, the two retaliation calls | — | — |
| 2 | GREEN rewritten after the `TZ=UTC` probe **falsified the obvious fix**: added the alternative-rejected table entry proving it trades 5 columns of error for 130, and added finding (f) environment-dependence | ~9% | no |
| 3 | Conversion validated live and folded in as §2d2 (MATCH=true) — this *confirmed* rather than changed the approach; added the self-healing `defaultNow()`-on-timestamptz note, the post-migration `TZ=UTC` step, and the gate (finding (g)) | ~4% | no |
| 4 | Audit pass: mixed-writer/environment-mix edge cases and scope consequences of the subset option added to the blocking decisions; no claim changed | <1% | yes |
| 5 | Operator decisions signed and recorded (scope = all 135; window = 7 days; visibility = surface it). Parameterization only — no approach, claim, or evidence changed | ~2% | yes |

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | `tsc`/`lint`/tests were not applicable at `loop-complete` — this audit ran against the DOCUMENT, before implementation (§7). Applied instead to the *artifacts this FID cites*: `grep` confirms `RETALIATION_WINDOW` at `clanConsequencesService.ts:92` and the retaliation consumers at `missileService.ts:248,259`. | pasted above | pass |
| Method 2: manual re-read against this FID | Every §2 claim re-derived from its probe output; §5 checked against §4's five questions; the rejected alternatives checked against the probe that rejects each | §2, §5 | pass |

- Audit outcome: **PASS** → status `loop-complete` (the loop converged on the DOCUMENT;
  implementation was at that point a separate, operator-approved step — §7 records it once
  executed, and the field was corrected to `verified` on 2026-09-23).
- Circuit breakers: 5 passes, no oscillation, 0 changes rejected on reappearance, well
  under the 10-iteration hard stop and the 5-iteration review flag.
- All three §5 blocking decisions were answered by the operator on 2026-09-23 and recorded
  above; none changed the approach, so the loop does not reopen.

## 7. Implementation Record (only after `loop-complete` + operator go-ahead)

- **Status:** implemented (2026-09-23) — uncommitted; closure pending approval
- **Classifier extended:** `scripts/classifyTimestampColumns.ts` gains `--emit-sql`, so
  migration 0040 is generated from the classification rather than hand-transcribed; the
  six MIXED columns carry explicit, evidence-recorded zone decisions (`MIXED_ZONE`).
- **Files changed:**
  - `lib/db/migrations/0040_timestamptz_conversion.sql` — created (135 columns, one guarded
    DO block; 119 `America/New_York`, 16 `UTC`; 57 carried data).
  - `scripts/applyMigration0040.ts` — created (idempotent applier).
  - `lib/db/schema/*.ts` — 134 declarations flipped to `{ withTimezone: true }` across 14
    files (one-shot, idempotent codemod `scripts/codemodTimestamptz.mjs`).
  - `scripts/timestampConventionCensus.cjs` — created (fail-closed gate) + wired into
    `.githooks/pre-push` as Gate 5.
  - `lib/wmd/clanConsequencesService.ts` — `RETALIATION_WINDOW` 30d → **7 days** (rationale
    in the comment); new `getPlayerWmdStatus()` read-side surface.
  - `app/api/wmd/missiles/route.ts` — GET returns `clanWmdStatus`.
  - `components/WMDMissilePanel.tsx` — renders the cooldown + live retaliation rights.
  - `__tests__/lib/timestampIntegrity.test.ts` — created (6 pins);
    `scripts/e2eTimestampIntegrityLive.ts` — created (live driver).
- **Gates:** typecheck 0 · eslint 0 (touched set) · tests **1291/1291** (133 files) · all
  three census gates exit 0 · live driver **10/10**.
- **Migration applied to dev DB:** verified 165/165 timestamp columns are now
  `timestamp with time zone` (0 naive). `players.created_at` retains `DEFAULT now()`, which
  is now correct against a `timestamptz` column.
- **Instant-preservation proof (live, pre→post):** APP-LOCAL columns keep the exact instant
  the app computed (`chat_messages.timestamp`, `battle_logs.timestamp`, `auctions.expires_at`,
  `flag_trail.created_at`); the DB-default column lands on its UTC-wall instant
  (`players.created_at`); the `timestamptz` control (`players.protection_until`) is unchanged.
- **Honest limitation:** the `America/New_York` calibration is correct for the environment
  that wrote this data. A database whose naive rows were written by a UTC process must use
  `UTC` for those rows; the migration header states this and the classifier report §Data
  provenance bounds it (this DB is a fixture: 105/107 `players` rows are seeded).
- **Not applied (deliberate):** the §5.7 process `TZ=UTC` pin. It is safe only *after* the
  migration and is optional determinism, not part of the class elimination; leaving it out
  keeps the change reversible and avoids coupling app behaviour to a host env change.
- **Gate scope note:** the migration scan waives SQL numbered ≤ 0040 (history created those
  columns; 0040 converts them). Any migration above 0040 that adds a bare `timestamp` type
  is refused.

## 8. Closure

- **Gates (run 2026-09-23):** [x] typecheck — `npx tsc --noEmit` 0 · [x] lint — eslint 0 on
  the touched set · [x] tests — **1291/1291** (133 files) · [x] call-graph proven — all
  census gates exit 0 and the live driver reports **10/10** · [x] migration applied — the
  dev DB reports **165/165** timestamp columns `with time zone`, **0 naive**.
- **Commit hash (G2):** — **pending.** The implementation is complete and every gate is
  green, but it is **uncommitted**; G1 forbids the agent from committing, so the operator
  executes the commit and the hash is recorded here. Until that happens this FID cannot be
  `closed` and cannot be archived.
- **Archive:** not applicable until `closed`.
- **Status field corrected 2026-09-23:** `loop-complete` → `verified`. It read
  `loop-complete` — *plan final, pending implementation* — while §7 already documented a
  shipped, gate-green implementation, and the closing line below claimed "No code has been
  written", which was false. `verified` is the allowed value for *implemented, gates green,
  evidence recorded, G2 outstanding*; note honestly that the spec describes it as an
  "intermediate status for partially-executed work", which fits imperfectly. The protocol
  has no value for *fully implemented, awaiting commit* — a real vocabulary gap, recorded
  here rather than papered over.

---

**Final status:** `verified` — the Perfection Loop converged on this document (5 passes;
all three §5 decisions signed) and the resulting plan was implemented on operator go-ahead:
migration 0040 applied, 134 schema declarations flipped, Gate 5 installed, the retaliation
window set to 7 days, and the cooldown/retaliation surface shipped. **The implementation is
complete and every gate is green; what remains is the operator's commit and the G2 hash.**
Presented for approval 2026-09-23; status corrected 2026-09-23.
