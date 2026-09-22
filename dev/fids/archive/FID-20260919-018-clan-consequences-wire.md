# FID-20260919-018 — Wire the clan WMD consequence system (post-attack cooldowns + retaliation)

**Status:** `closed (2026-09-19 on 6ee7e79)`
**Session:** 2026-09-19 (operator directive: "Decide the clanConsequencesService disposition … wire it into the missile-impact path or remove it, with evidence" → **wire it properly**, balance parameters signed off)
**Origin:** FID-20260919-017's adjacent finding — a documented feature (`dev/architecture.md`) with zero callers and a broken core.

---

## 1. Why wire, and what was wrong

Missile launches were **consequence-free**: a clan could bomb another and suffer nothing but the
target's losses. The module that was supposed to fix that was never wired — and, critically, it was
**partially non-functional even if wired**:

1. `applyClanWMDCooldown` computed `cooldownUntil` then wrote
   `bankTreasuryMetal: sql\`${clans.bankTreasuryMetal}\`` — a self-assignment. It never set
   `wmdCooldownUntil`: the headline cooldown did nothing.
2. `isClanOnWMDCooldown` unconditionally returned `{ onCooldown: false }` — a stub.
3. The launch path contained **no cooldown check at all**, so even a correct cooldown would
   constrain nothing.
4. Retaliation rights had **zero consumers**.
5. `clan_relations` and `wmd_retaliation_rights` were consumed by nothing else — they read as
   "live" in the census only because the dead module held both their writer and their reader.
6. **Id conventions normalized (a false alarm, recorded honestly).** An in-flight claim that
   `grantClanRetaliationRights`' `rr_<ts>_<rand>` (26 chars) overflowed a `varchar(24)` PK was
   **wrong** — both ids fit their columns: `wmd_retaliation_rights.id` is `varchar(50)` and
   `clan_relations.id` is `varchar(24)` while the old `cr_<ts>` id was only 16 chars. Neither
   ever overflowed. Both writers now use `generateId()` for **convention only**, not as a fix.
7. The code's cooldowns (14–60 **days**) contradicted the design doc's "24-72hr cooldowns" by ~10×,
   and the "reputation" penalty decremented `players.researchPoints` (the tech currency) for every
   clan member, with no floor.

## 2. Operator-signed parameters

- **Cooldowns:** the documented **24–72h**, scaled by warhead —
  TACTICAL 24h · STRATEGIC 36h · NEUTRON 48h · CLUSTER 60h · CLAN_BUSTER 72h.
- **Reputation penalty:** applied to the **clan research pool** (`clans.researchResearchPoints`),
  clamped with `GREATEST(0, …)` — clan-scoped, matches "affects all members", no new column.
  Magnitudes carried over from the coded config (2000 / 5000 / 8000 / 10000 / 25000).

## 3. Implementation

- **Fix the cooldown writer** — set `wmdCooldownUntil` (+ `lastWMDLaunch`).
- **Implement the reader** — `isClanOnWMDCooldown` reads the column and computes remaining time.
- **Enforce at launch** (`launchMissile`, after target validation, before the aggression void):
  a clan on cooldown refuses the launch — **unless** the launcher holds a live retaliation right
  against the target's clan, which is then consumed. That is the retaliation-rights consumer.
- **Hook the impact** (`missileTracker` detonation branch): `applyClanWMDConsequences` runs
  non-fatally post-impact; relations set to ENEMY (canonical pair); retaliation rights granted to
  the victim clan.
- **Normalize both ids to `generateId()`** (convention only — neither overflowed, see §1.6).
- **Canonicalize the relations pair** on insert (the schema's documented invariant).
- **Timestamptz migration (0039):** the cooldown/retaliation timestamps were `timestamp without time
  zone` while being compared against `now()` — the live probe read a 24h cooldown as **28h** under
  the process UTC offset (the FID-20260916-009 D2 class, which 0032 fixed for `protection_until`).
  Converted with `AT TIME ZONE 'UTC'` (every value was written as a UTC literal), no instant shifts.
- **`useRetaliationRight` → `consumeRetaliationRight`:** the `use*` prefix collides with React's
  hook namespace, so `react-hooks/rules-of-hooks` errored on every call site in this non-React
  service module.
- **Drop the unreachable `SPY_SABOTAGE` config** (`${warheadType}_LAUNCH` can never match it).
- **Notify the launcher** through the FID-20260919-013 seam that their clan is now on cooldown.

## 4. Gates — as run

- **Pins:** 11/11 (`__tests__/lib/clanWmdConsequences.test.ts`) — cooldown write/read truth, launch
  refusal + retaliation bypass/consume, path-scoped reputation floor (`GREATEST(0, …)`), canonical
  relations pair, retaliation PK width.
- **Live probe:** **23/23** (`scripts/e2eClanConsequencesLive.ts`) against the real dev DB, with
  throwaway clans + members throughout. **P1–P6 (service + gate):** the consequence flow writes a
  ~24h cooldown and the research penalty; relations land as ENEMY on a canonical pair; one
  retaliation right per victim member; `isClanOnWMDCooldown` reports active then expired; the
  **real `launchMissile`** refuses a cooldown-clan launch and leaves the missile READY, then a
  retaliation right lets the victim's launch through and is consumed.
- **P8 — the integrated leg (added after the first closure, which is why the count moved 16 → 23):**
  a service-level pass does **not** prove the hook fires in the live impact path. P8 inserts a due
  `LAUNCHED` missile against a battery-free victim clan, calls the tracker's own
  `processDueMissiles()`, and asserts the sweep detonated it **and** that the detonation applied the
  ~24h cooldown, charged the clan research pool, set relations ENEMY, granted the victim clan's
  retaliation rights, and notified the launcher through the FID-20260919-013 seam. Cleanup (now
  including the messages/alerts the detonation writes) leaves no residue.
- **Suite:** 1285/1285 (132 files) · **tsc:** 0 · **eslint:** clean ·
  **census:** 57 tables — 57 live, 0 ticketed, 0 violations (`clan_relations` and
  `wmd_retaliation_rights` now have real consumers rather than hanging off dead code).
- **Migration 0039 applied** to the dev DB: all four columns verified `timestamp with time zone`.
- **Anti-regression note:** the first probe run (pre-migration) read the 24h cooldown back as 28h —
  the naive-timestamp skew that motivated 0039. P1b now asserts 23.5h < remaining < 24.5h.

## 8. Closure

**Closed 2026-09-19 on `6ee7e79`** (implementation; 10 files, +797/−123) — closure ledger entry
follows in the same batch (FID status, archive, SCOPE row 115, CHANGELOG 0.0.31, VERSION bump).

Disposition: **WIRE** (operator-signed), not remove. The reason to keep it was real — missile
launches were consequence-free — but "wire it into the missile-impact path" as literally stated
would have been theater: the cooldown it applied did nothing, was enforced nowhere, and the
retaliation rights it granted had no reader. Wiring it *correctly* meant four fixes plus the hook,
which is what shipped.

Honest records from this arc:

1. The in-flight claim that `grantClanRetaliationRights` overflowed a `varchar(24)` PK was **wrong**
   — `wmd_retaliation_rights.id` is `varchar(50)` (probed live). No overflow existed in this module.
   The `generateId()` normalization stands as convention only, and both the code comment and the
   probe label were corrected rather than left to imply a bug that never was.
2. FID §1.6 was rewritten after that correction — the file records the false alarm as a false alarm.
3. This module is the **fourth** instance of the same disease this arc found: a fully-built feature
   with no caller (`clanConsequencesService`, plus the three Law-17 writers repaired in -017). The
   difference here was that the fix was a feature build, not a hook-up.
4. Pre-existing lint hazard fixed rather than suppressed: `useRetaliationRight` →
   `consumeRetaliationRight` (the `use*` prefix collides with React's hook namespace).
5. **Evidence strengthened after the first closure commit:** the initial 16 probes drove the
   service and the launch gate directly, which left the *hook* (detonation → consequences)
   verified only by reading code. The added P8 leg exercises the real tracker sweep instead, so the
   FID's central claim now has live evidence rather than an inference.

**Remaining question this FID deliberately did NOT decide:** the retaliation *window* (30 days) and
whether retaliation rights should be visible in the UI. Neither is required for the mechanic to
work; both are product calls. Noting here so it is a decision, not an omission.
