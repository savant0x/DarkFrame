# FID-20260928-008: Raid telemetry — the design doc's balancing constants get a data feed

**Filename:** `FID-20260928-008-raid-telemetry.md`
**ID:** FID-20260928-008
**Severity:** LOW
**Status:** closed (2026-09-28, commit recorded in the ledger-closure commit)
**Created:** 2026-09-28

---

## 1. Summary

`PVP_BASE_RAID_DESIGN.md` shipped with tuning constants (`PVP_LOOT_CAP_PER_LEVEL`, `DEFENDER_LOSS_FLOOR`, the period lock, the hostility rule) that had no observation surface — the operator's directive: *"so the balancing constants get tuned on data, not vibes."* Telemetry is now wired with **one new write path and one read endpoint**; everything else reads records that already persist:

- **Outcomes/loot/casualties** — `battle_logs` `BASE_RAID` rows (persisted since FID-20260912-093) aggregated in `lib/raidTelemetry.getRaidTelemetry`: win rate, loot totals per resource, mean attacker/defender losses, distinct participants, over a configurable window.
- **Hostility refusals** — the one gap: refusals previously died in console logs. The gate (`combat/attack`, FID-20260928-006) now writes a `player_activity` row (`action='raid_refusal'`, metadata = attacker/defender/reason/clan ids/allied) via `logRaidRefusal` **before** the refusal response; `getRaidRefusalPairs` aggregates counts per attacker→defender pair.
- **Read surface** — `GET /api/admin/raid-telemetry` (admin-gated, params clamped, both readers best-effort: a failed read returns a structured null/[] — never a 500 into the panel), with `tuningTargets` mapping each metric to the knob it informs.
- **Doc addendum** — `PVP_BASE_RAID_DESIGN.md` §4.6 wires every §4 constant to its metric; tuning stays doc-first (constant edited in doc + `lib/hostileBase.ts` together).

## 2. Evidence (RED → GREEN)

| # | Finding | Evidence |
| - | ------- | -------- |
| 1 | Refusals were unobservable pre-change: the gate only `log.debug`'d | FID-20260928-006's route (pre-edit): debug log + `createErrorResponse`, no persistence |
| 2 | Outcome data already persisted — zero new outcome writes needed | `battle_logs` schema: `outcome`, `resourcesStolenResourceType/Amount`, `attackerUnitsLost`, `defenderUnitsLost` (lib/db/schema/battle.ts) |
| 3 | Refusal rows use a lawful action — `'raid_refusal'` added to `PlayerActionType` (closed-signature union) with the metadata fields declared on `PlayerActivity.metadata` per the closed-index-signature rule | types/game.types.ts; tsc 0 after |
| 4 | Pins: 10 green (`__tests__/lib/raidTelemetry.test.ts`) — action typing, route write-before-refuse ordering, verbatim-reason response contract unchanged, single write path (reader keys the same constant), admin gate, param clamps, structured degraded reads | `npx vitest run __tests__/lib/raidTelemetry.test.ts` → 1 file passed |
| 5 | Gates: tsc 0 · eslint 0/0 · full suite **146 files** green · census 0 · inverted-route census MISSING 0/UNPARSED 0 | executed 2026-09-28 |

## 3. Honest limitations

- Aggregates are computed at read time over raw rows — fine at current raid volume; materialized rollups are the documented next step if the window query gets slow (no premature caching).
- The refusal stream records only *hostility-gate* refusals; presence/cooldown/validation refusals remain ordinary error responses (they are per-request validation, not pair-shaped hostility data).
- `mode() within group` (top reason per pair) is a Postgres aggregate — the reader degrades to `[]` on any non-PG context by design.
- No UI ships with this FID — the endpoint is the contract; an admin panel card can consume it later without format churn (`tuningTargets` is part of the response).

## 4. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0/0 · [x] suite 146 files · [x] census 0 · [x] inverted-route census clean.
- **Commit hash (G2):** recorded in the ledger-closure commit that cites this FID (code + ledger committed same session, code first).
- **Archive:** `dev/fids/archive/` at closure; session summary follow-through; CHANGELOG/VERSION 0.0.54.

---

**Final status:** closed
