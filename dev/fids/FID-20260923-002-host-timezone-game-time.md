# FID-20260923-002 — Host-timezone game-time math: the class that survived the timestamptz fix

**Filename:** `FID-20260923-002-host-timezone-game-time.md`
**ID:** FID-20260923-002
**Severity:** HIGH
**Status:** verified (implemented 2026-09-23; gates green; G2 commit pending)
**Created:** 2026-09-23
**Predecessor:** FID-20260923-001 (naive-column class — the *storage* half)

---

## 1. Summary

FID-20260923-001 fixed where instants are **stored**. This fixes where the app
decides what a "game day" or "game hour" **is**. Server-side code read the host
process's local timezone — `getHours()`, `getDay()`, `setDate()`,
`setHours(0,0,0,0)`, `new Date(y, m, d)` — so the same schedule fired at a
different wall-clock time depending on where the process ran, and shifted again
across DST. A dev box in `America/New_York` and a production host in UTC
disagreed about when the week ends by four or five hours.

This is the second half of the same root cause. -001 proved the *wire* drops the
offset; -002 proves the *application* then invented one from the host.

## 2. Evidence (RED)

Scanned live code (`lib/`, `app/api/`, `server.ts`, excluding client display) for
host-local date methods — 466 server files:

- **Scheduled behaviour, host-dependent:**
  - `lib/beerBaseService.ts` — `calculateLegacyNextRespawn` + the multi-schedule
    branch (`now.getDay()`, `now.getHours()`, `setHours/setDate`), **and**
    `isRespawnTime`.
  - `lib/wmd/jobs/beerBaseRespawner.ts` — a *second*, duplicated implementation of
    the same schedule.
  - `lib/botService.ts` — `now.getDay() === 0 && now.getHours() === 4` ("Sunday 4 AM").
  - `lib/harvestService.ts` — the AM/PM reset boundary and the reset countdown.
  - `app/api/combat/attack/route.ts` — the AM/PM raid-period guard.
  - `lib/territoryService.ts` — daily income window (`new Date(y, m, d)`), and a
    mixed local-construction + `setUTCHours` next-collection.
  - `lib/clanDistributionService.ts` — the daily distribution reset
    (`setHours(0,0,0,0)`).
  - `lib/chatService.ts` — the month bucket.
  - `app/api/economy/stats/route.ts` — `startOfToday`.
- **Duration math that drifted by an hour across DST:** retention/expiry cutoffs
  via `setDate(getDate() - N)` / `setHours(getHours() - N)` in `activityLogService`,
  `battleLogService`, `clanActivityService`, `clanLevelService`,
  `playerHistoryService`, `chatService`, `stripe/subscriptionService`,
  `cron/player-snapshot`, `logs/cleanup`, `wmd/notifications`.
- **A latent dead policy (found en route, exposed by the fix):**
  `lib/activityLogService.cleanupOldLogs` computed `adminCutoffDate` and never
  read it — `policy.adminLogDays` had **no effect**; admin logs are never purged.
  eslint could not see it before because the mutation counted as a "use".

Also corrected: `__tests__/lib/beerBaseScheduler.test.ts` built its fixtures with
`new Date(2026, 8, 13, 4, 30)` (host-local) — a CI-host-dependent assertion.

## 3. Impact Analysis

- **Who/what:** every scheduled game event and every duration cutoff. The visible
  failure is a schedule firing at the wrong wall-clock hour per host; the subtle
  one is a single-hour drift twice a year (DST) in retention and VIP expiry.
- **Failure modes:** dev/prod disagreement on the week boundary; a raid or harvest
  period rolling at a different hour; a "Sunday 4 AM" respawn that is Sunday 4 AM
  only in the server's zone; DST-shifted expiries.
- **Blast radius:** server-side time computation only. Client display formatting
  is deliberately unchanged — there the user's browser timezone is correct.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases? | Yes — the game day is one explicit zone, resolved per instant; DST handled by re-reading the offset at the candidate instant. |
| Scales? | Yes — one module (`lib/gameTime.ts`) plus a gate; new code is correct by construction. |
| Survives a hostile attacker? | Yes — removes a time-based inconsistency (a period boundary an attacker could straddle differently per host). |
| Maintainable in 2 years? | Yes — the game timezone is one constant, not dozens of implicit host reads. |
| Sets the standard? | Yes — "resolve the domain's time in an explicit zone" is the canonical rule, machine-checked. |

## 5. Proposed Fix (GREEN)

1. **`lib/gameTime.ts`** — explicit-zone helpers: `gameParts`, `gameHour`,
   `gameDayOfWeek`, `gameDateKey`, `startOfGameDay`, `atGameTime`, `addGameDays`,
   `nextGameOccurrence`, `daysAgo`, `hoursAgo`. `GAME_TIMEZONE` is
   `America/New_York`, chosen so the existing behaviour on the original host is
   **preserved exactly** while other hosts now match it.
2. **Scheduled sites** rewired to those helpers (the ten files above).
3. **Duration cutoffs** normalised to exact-ms arithmetic (`Date.now() - N * 86_400_000`).
4. **Gate** — `scripts/hostTimezoneCensus.cjs`, scoped to `lib/`, `app/api/` and
   `server.ts` (client display exempt), fail-closed (exit 2 on scan error), wired
   into `.githooks/pre-push` as Gate 6.
5. **Pins** — `__tests__/lib/gameTime.test.ts` (DST both directions, host
   independence), `__tests__/lib/gameTimeCallSites.test.ts` (call-site pins + gate).

Deliberately NOT done: the residual `policy.adminLogDays` purge — implementing it
is a data-retention product call; the dead arithmetic was removed and the finding
recorded.

## 6. Verification

- `npx tsc --noEmit` → 0 · `eslint` touched set → 0 · full suite → see §7.
- Host-timezone census → clean on 466 server files; drilled by injecting
  `now.getHours()` into `lib/botService.ts` (refused, exit 1) and restoring.
- `gameTime` pins prove host independence by asserting absolute instants,
  including both DST transitions.

### 6.1 Suite host-independence (closed 2026-09-23)

The weakest point of the verification above was that the suite itself ran under
the developer's system timezone: a host-local assumption produced a GREEN build
on `America/New_York` and a RED one on UTC, i.e. the failure was invisible
exactly where it was written. Closed in two parts.

**The failures, found by running the suite under a non-local zone.**
`TZ=UTC npx vitest run` → **3 failed / 1297 passed**, all in
`lib/beerBaseService.test.ts`, all the same defect: the respawn assertions read
host accessors (`nextRespawn.getDay()`, `nextRespawn.getHours()`) on a value the
service now computes in the game zone. On a UTC host `4 AM game time` reads as
`8`, `12` as `16`, `0` as `4` — each exactly the NY offset. The production code
was correct; the *assertions* were the host-dependent part. All five sites
(three failures plus two non-failing `now.getDay()/getHours()` reads in the
`isRespawnTime` case) now read the instant through `gameDayOfWeek`/`gameHour`,
the same explicit-zone helpers the service uses.

**The class, made un-hideable.** `vitest.setup.ts` now pins the suite's zone:
`process.env.TZ = process.env.TEST_TZ ?? 'UTC'` — deterministic UTC by default on
every machine, overridable to audit under any zone. Node honors a runtime TZ
assignment (verified before relying on it: assigning mid-process flips
`Date`/`Intl` immediately), and the setup file runs before test files are
imported.

**Drill (the pin is proven, not assumed).** Reverting one assertion to the
host accessor `nextRespawn.getHours()`:

| invocation | result |
| --- | --- |
| ambient NY host, pin active | **FAIL** — `expected 8 to be 4`, 1 failed / 35 passed |
| `TEST_TZ=America/New_York` | **PASS** — 36/36, the override works |

The first row is the point: that assertion *passed* on this box before. A
host-local regression is now visible where it is written, which is what the
earlier verification could not claim.

### 6.2 Two tests that mirrored production instead of testing it

Running the suite in a foreign zone exposed a second, worse instance of the same
class — not host-local assertions, but **tests that re-derived production's date
math and asserted on their own copy.**

- `__tests__/lib/baseRaidFidelity.test.ts` carried a hand-copied duplicate of the
  route-local raid period helper. Its own comment said *"if the route's copy
drifts, these break"* — it could not. The route was converted to game-zone time
  in this FID and the duplicate kept passing, because it both built and read its
  dates host-locally: self-consistent in every zone, so it could not fail
  anywhere, ever. The helper is now `lib/raidPeriod.ts`, imported by **both** the
  route and the test — one implementation, drift impossible by construction.
- `__tests__/api/stripeVipKeying.test.ts` mirrored `extendVIP` with
  `expected.setDate(expected.getDate() + 7)` where production adds an exact
  duration (`base.getTime() + days * 86_400_000`). The two agree except across a
  DST transition, and the fixture never crossed one — a latent 1-hour divergence
  that could never surface.

**Drill — the duplicate is now a real test.** Injecting drift into the single
shared implementation (`AM start 0 → 1` in `lib/raidPeriod.ts`):

| invocation | result |
| --- | --- |
| drift injected | **FAIL** — `expected 1 to be +0`, 1 failed / 18 passed |
| restored | **PASS** — 19/19 |

The injected drift is invisible to the old duplicate in *every* zone; it is now
caught.

### 6.3 No single zone detects everything — the audit is the union

An honest limit of the pin above: **the two failure classes need opposite
conditions, and each is invisible in the other zone.** Pinning to UTC removes DST
entirely, so a DST-sensitive method divergence can never appear there. Probed
rather than assumed — the same production change (VIP exact duration → wall-clock
calendar walk) under two zones:

| zone | covers | drift result |
| --- | --- | --- |
| `UTC` | host-zone assumptions (no DST, no offset) | **PASS** — 7/7, cannot see it |
| `America/New_York` | DST-sensitive method drift | **FAIL** — 1 failed / 6 passed |

So the proof of host-independence is the **union** of both runs, and that union is
now one command: `npm run test:zones` (`scripts/zoneAudit.cjs`) runs the whole
suite under each zone and exits non-zero if either fails. Drilled with the
host-local assertion re-injected: it reports **FAIL UTC · PASS America/New_York**,
prints the host-dependency diagnosis, and exits 1.

- Suite under the pinned zone (UTC): **1301/1301** (135 files).
- Suite under `TEST_TZ=America/New_York`: **1301/1301** (135 files).
- Suite under `TEST_TZ=Asia/Tokyo`: **1301/1301** (135 files) — host independence
  demonstrated on a zone that is neither the host nor the game zone.
- `npm run test:zones`: **PASS UTC · PASS America/New_York**.

## 7. Implementation Record

- **Status:** implemented (2026-09-23) — uncommitted; closure pending approval.
- **Files:** `lib/gameTime.ts` (new); `lib/beerBaseService.ts`,
  `lib/wmd/jobs/beerBaseRespawner.ts`, `lib/botService.ts`, `lib/harvestService.ts`,
  `lib/territoryService.ts`, `lib/clanDistributionService.ts`,
  `lib/clanAllianceService.ts`, `lib/chatService.ts`, `lib/activityLogService.ts`,
  `lib/battleLogService.ts`, `lib/clanActivityService.ts`, `lib/clanLevelService.ts`,
  `lib/playerHistoryService.ts`, `lib/stripe/subscriptionService.ts`,
  `app/api/combat/attack/route.ts`, `app/api/economy/stats/route.ts`,
  `app/api/cron/player-snapshot/route.ts`, `app/api/logs/cleanup/route.ts`,
  `app/api/wmd/notifications/route.ts`; `scripts/hostTimezoneCensus.cjs` (new);
  `.githooks/pre-push` (Gate 6); `vitest.setup.ts` (suite-zone pin);
  `lib/beerBaseService.test.ts` (five host-local assertions read through
  `gameTime`); `lib/raidPeriod.ts` (new — the route's period helper, extracted so
  the route and its fidelity test share one implementation);
  `scripts/zoneAudit.cjs` (new) + `package.json` (`test:zones`);
  `__tests__/lib/baseRaidFidelity.test.ts` (duplicate replaced by the import);
  `__tests__/api/stripeVipKeying.test.ts` (expectation mirrors production's method;
  new absolute DST-crossing case); two new test files; one test fixture corrected.
- **Second-order finding:** `policy.adminLogDays` is inert (recorded above).

## 8. Closure

- **Gates (run 2026-09-23):** [x] typecheck — `npx tsc --noEmit` 0 · [x] lint — eslint 0 on
  the full touched set · [x] tests — **1301/1301** (135 files), and the same suite green
  under `TEST_TZ=America/New_York` and `TEST_TZ=Asia/Tokyo` · [x] call-graph proven — all
  four census gates exit 0 (inverted-route, schema-consumer, timestamp-convention,
  host-timezone) · [x] enforcement drilled — host-timezone census refused an injected
  `now.getHours()` (exit 1); the suite zone pin caught a re-injected host-local assertion on
  this NY host; injected `lib/raidPeriod.ts` drift failed the shared fidelity test; the
  two-zone audit reported `FAIL UTC · PASS America/New_York` and exited 1.
- **Commit hash (G2):** — **pending.** The implementation is complete and every gate is
  green, but it is **uncommitted**; G1 forbids the agent from committing, so the operator
  executes the commit and the hash is recorded here. Until that happens this FID cannot be
  `closed` and cannot be archived.
- **Archive:** not applicable until `closed`.
- **Status field corrected 2026-09-23:** `implemented (uncommitted)` → `verified`. The old
  value is **not in the protocol's allowed status list** (`created | analyzed | fixed |
  verified | loop-complete | closed`); the legacy-synonym map sends `implemented` → `closed`
  only when backed by a G2 commit hash, which this FID does not yet have — so the field was
  unlawful in both directions. `verified` is the allowed value for *implemented, gates
  green, evidence recorded, G2 outstanding*, with the same honest caveat as -001: the spec
  calls it an "intermediate status for partially-executed work", and the protocol has no
  value for *fully implemented, awaiting commit*.
