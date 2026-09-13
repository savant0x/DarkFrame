# FID-20260912-080 — /api/battle-logs ⇄ battle-logs page contract tests

## Problem

The `/game/battle-logs/[type]` page has fetched `/api/battle-logs` since 2025-10-17, but the route didn't exist until FID-075 built it (2026-09-12). For ~2 months the viewer silently rendered an empty table on a 404. Nothing on either side pinned the shape, so this class of drift was undetectable — the route could rename a field, change a perspective mapping, or alter the envelope, and the page would regress to the empty state with no failing test.

## Contract pinned (from `page.tsx` render code, field-by-field)

**Envelope** (`expectEnvelopeMatchesPageContract`):
- `success: true`, `logs: BattleLog[]`, `total: number`, `page: number`, `totalPages: number >= 1` (page guards division by it)

**Log** (`expectLogMatchesPageContract`):
- `_id: string` (React key — undefined breaks reconciliation)
- `attackerUsername` / `defenderUsername: string` (opponent display)
- `result: 'victory' | 'defeat'` (chip styling)
- `type: 'attack' | 'defense' | 'infantry' | 'land-mines'` — and matches the requested type
- `metalGained/metalLost/energyGained/energyLost: number` (page does `(x || 0)` math)
- `location.x` / `location.y: number`
- `timestamp: ISO-parseable string` (`formatTimestamp`)
- Optional-but-paired: `attackerStrength/defenderStrength`, `attackerLosses/defenderLosses` (page renders each row only when BOTH are present)

## Tests (8)

1. **Attack view, full field mapping** — victory row maps every rendered field (`_id`, perspective result, spoils, location, strengths, losses, ISO timestamp)
2. **Defense perspective** — same DB row, viewer was defender: `ATTACKER_WIN` → their `defeat`
3. **Defense perspective, flipped** — `DEFENDER_WIN` → viewer-side `victory`
4. **Energy-only spoils** → `energyGained`, `metalGained` stays 0
5. **DRAW** → renders as `defeat` (page union has no draw state)
6. **Empty history** → still a valid envelope, `total: 0`, `totalPages: 1`
7. **Pagination** — 25 rows at limit 20, page 2 → `total: 25`, `totalPages: 2`
8. **Validation** — missing username / bad type → 400 the page never sees

## Test harness notes

- Mocked drizzle `db` via the established `vi.hoisted` pattern; the mock's `where()` is both chainable and awaitable (`Object.assign(Promise.resolve(...), mockDb)`) because the rows query chains `where→orderBy→limit→offset` while the count query awaits `.where()` directly — mirroring the route's real `Promise.all` pair.
- `dbRow()` fixtures use the drizzle snake-mapped row shape (`battleId`, `attackerTotalSTR`, `resourcesStolenResourceType`, …) so the route's mapping — not the mock — is under test.

## Gates

- tsc: 0 errors
- eslint: 0 errors
- vitest: 603 passed (8 new), 1 skipped
- No production code changed — this FID is pure contract pinning; the route and page are untouched.
