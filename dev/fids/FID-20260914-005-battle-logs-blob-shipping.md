# FID-20260914-005: battle-logs page loads in ~40 s — SELECT * toasts the combat-report blobs

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260914-005-battle-logs-blob-shipping.md`
**ID:** FID-20260914-005
**Severity:** HIGH (player-facing: every battle-logs tab load ~40 s)
**Status:** verified
**Created:** 2026-09-14

---

## 1. Summary

`/game/battle-logs/attack` took ~40 s to render. The route (`app/api/battle-logs/route.ts`,
FID-20260912-075) ran `db.select()` — all 38 columns — while its mapping consumes 27. On a
26-row table whose `attacker_units` ≈ 48 KB and `defender_units` up to ~125 KB *compressed*
(TOAST total 1,352 kB of 1,488 kB, 91%), every page fetch decompressed ~1.5 MB of jsonb it
then threw away. Measured Node-side: **17–23 s per `SELECT *`**, reproducible, while the
identical predicate on slim columns returns in 66 ms and the in-database plan costs 0.15 ms
(index scan, 9 buffers). Root cause is fetch-side detoast/decompress per request — SQL was
never slow.

Two secondary findings fixed in the same pass:
(a) raw captured-unit arrays re-inflated the response to 654 KB (one log row carried
**4,400+ full unit documents**, 242 KB) although the page renders only `.length`
("N unit group(s)");
(b) the `land-mines` tab served the user's attack/defense logs mislabeled — the header
promised "an honest empty set" (no writer) but only the `infantry` branch filtered
`battleType`.

## 2. Ground truth (measured this session)

| Observation | Value |
| --- | --- |
| Table rows | 26 |
| Heap / TOAST | 48 kB / **1,352 kB** |
| Biggest rows | `attacker_units` ≈ 48.7 KB, `defender_units` ≈ 125 KB (compressed) |
| In-database plan (`EXPLAIN ANALYZE`) | 0.139–0.152 ms, index scan, 9 buffers |
| Node-side `SELECT *` (19 rows) | 18.5 s / 22.8 s / 21.1 s / 16.9 s — every run |
| Node-side slim columns (same predicate) | 66 ms |
| Live API before fix | 16.3–19.4 s per request |
| Response payload before fix | 654 KB (raw captured arrays) |

The page adds a second factor on top: React dev strict-mode runs effects twice, so the
browser paid the ~19 s fetch twice — matching the user-reported ~40 s.

## 3. Defects

| # | Severity | Defect |
| --- | --- | --- |
| 1 | HIGH | `db.select()` ships all 38 columns; mapping never reads `attackerUnits`/`defenderUnits`/`rounds` (the giants). TOAST decompression dominates every request. Same blob-shipping class as FID-20260911-043. |
| 2 | MED | Raw captured-unit arrays (full `Unit` documents) serialized into every response — 654 KB for 19 logs — for a UI that renders counts only. |
| 3 | LOW-MED | `land-mines` returned mislabeled attack/defense logs, contradicting the route's own documented contract. |

## 4. GREEN (implemented)

1. Explicit projection of the 27 mapped columns (includes `attackerUnitsLost`/`defenderUnitsLost`; excludes the three giants).
2. `summarizeCapturedUnits()` collapses captured arrays to per-type `{ unitType, count }` groups — counts stay truthful, "group(s)" finally means groups. Module-local (route files may only export handlers/config).
3. `land-mines` short-circuits to the documented empty envelope, no DB query.

## 5. Verification

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test:ci` | **763 passed / 1 skipped / 0 failures** (+3: projection exclusion, summarize collapse, land-mines no-query) |
| Contract suite | `__tests__/api/battle-logs.contract.test.ts` 11/11 (mock discriminator sharpened: one-key `{count}` projection = count query) |
| Live timing (attack tab, `username=fame`) | 19 s → **0.35–1.04 s** · payload 654 KB → **14.6 KB** |
| Live timing (all tabs) | attack 1.04 s / defense 0.08 s / infantry 0.08 s / land-mines 0.006 s |
| Consumer audit | page is the route's only consumer (grep); it never renders individual captured entries |

**Law 4:** route-internal change; response contract kept (envelope + all page-read fields);
contract tests pin the shape and were extended for the three fixes.

## 6. Residual risks / follow-ups

- The `attacker_units`/`defender_units`/`rounds` giants are written by the battle recorder
  but read by nothing outside the DB — a future FID could stop persisting full unit
  rosters per log (or move the full report to an on-demand detail endpoint). Out of scope here.
- Other `select()`-everything routes over blob-heavy tables may share the defect class
  (candidates: any table with multi-KB jsonb). A systematic audit is the natural sweep.

## 7. Implementation record

Implemented 2026-09-14 (SESSION-2026-09-14-006): projection + summarize + land-mines
short-circuit; contract test extended; all gates green; live timings above. Scratch perf
probes deleted after use (evidence preserved in this record).

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass (763/1 skipped/0 fail) · [x] live-verified
- **Commit hash (G2):** _pending commit (presented plan: `perf(battle-logs)` path-scoped)_
- **Staging plan:** `app/api/battle-logs/route.ts`, `__tests__/api/battle-logs.contract.test.ts`, this FID, `SCOPE.md`, `dev/session-summaries/SESSION-2026-09-14-006.md`

---

**Final status:** verified (implemented + live-verified 2026-09-14; closes on commit per G2)
