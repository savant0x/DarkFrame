# FID-20260919-018 — Wire the clan WMD consequence system (post-attack cooldowns + retaliation)

**Status:** `created`
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

## 4. Gates
Pins: cooldown write/read truth, launch refusal + retaliation bypass/consume, path-scoped reputation
floor, canonical relations pair, retaliation PK width. Live probe: a real clan-vs-clan detonation
produces the cooldown + relations + retaliation rows, and a cooldown-blocked launch is refused
unless a retaliation right is held. Full suite / tsc / eslint / census.

## 8. Closure

_(filled at closure)_
