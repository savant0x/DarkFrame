# FID-20260917-004 — Abandon rewire + player-log view (dead-twin sweep resolutions)

**Status:** `closed (commit `ef64421`)`
**Session:** 2026-09-17 (post-FID-003)
**Origin:** Repo-wide dead-route census (237 routes → 2 true orphans). Operator ratified: `factory/abandon` = Keep + rewire UI; `logs/player/[id]` = Keep + wire UI.

## Goal

1. **Rewire the abandon flow** — `FactoryManagementPanel.handleAbandon` currently calls `POST /api/factory/release` (mode single); the canonical `POST /api/factory/abandon` has zero callers. Restore the intended verb.
2. **Activate the player-log endpoint** — `GET /api/logs/player/[id]` (combined activity + battle logs, self/admin scoped) has zero callers. Add a log view to the own-profile page (the route permits self-view; profile is a game tab).

## RED evidence (all probed this session)

| # | Fact | Evidence |
|---|---|---|
| 1 | `abandon` route healthy, zero client callers | 209 lines, `export async function POST`; census greps: only ref = its own header comments |
| 2 | Abandon modal calls `release` instead | `components/FactoryManagementPanel.tsx` `handleAbandon` → `/api/factory/release` `{mode:'single',factoryX,factoryY}` |
| 3 | `release` single-mode is superset twin (auth, 404 ownership, reset shape + `productionRate:1` + batch mode) | `app/api/factory/release/route.ts:76-135` |
| 4 | `abandon` does NOT reset `productionRate` | `app/api/factory/abandon/route.ts:105-124` — field absent from `$set` while `release` resets it |
| 5 | UI copy falsely claims unit deletion | Modal body + footer: "DELETE ALL UNITS" — contradicts FID-20260914-009 Phase A ("Abandon costs the factory, never the army") |
| 6 | `logs/player/[id]` zero callers, no twin | 236 lines; `grep logs/player` outside route = 0; client calls zero `/api/logs*` |
| 7 | Route auth = cookie `token`, self-or-admin (`payload.username` vs `[id]`) | `app/api/logs/player/[id]/route.ts:55-72` |
| 8 | Response: `activityLogs[]`+`activityCount`, `battleLogs[]`+`battleCount`, `combatStats`, `pagination{limit,offset}` | route :122-184; `ActivityLog`/`BattleLog` in `types/activityLog.types.ts:165,204`; `BattleOutcome` :142 |
| 9 | Profile page = natural host; plain-fetch auth pattern | `app/profile/ProfileView.tsx:79` (`fetch('/api/player/profile')`) |

## Implementation plan (GREEN)

1. **`components/FactoryManagementPanel.tsx`** — `handleAbandon` → `POST /api/factory/abandon` body `{factoryX, factoryY}` (response `success`+`message` consumed identically). Replace the two false "DELETE ALL UNITS" strings with the FID-20260914-009 truth (units unaffected).
2. **`app/api/factory/abandon/route.ts`** — add `productionRate: 1` to the reset `$set` (parity with `release`; display-only field, prevents stale value on abandoned tiles).
3. **`components/PlayerLogPanel.tsx` (new)** — self-log view: type tabs (all/activity/battle), renders activity entries (action, timestamp, success/errorCode) and battle entries (attacker→defender, outcome color, location), combat stats wells when present; NEON NOIR tokens (`nn-panel`, `nn-well`, `nn-chip`, `nn-row`); empty + loading + error states; `limit=100` default.
4. **`app/profile/ProfileView.tsx`** — new "Commander Log" panel section hosting `PlayerLogPanel` (username from `useGameContext` player).

No schema, route-contract, or auth changes. `getPlayerCombatStatistics` shape rendered defensively (optional block).

## Verification plan

- Gates: `npx tsc --noEmit` · `npm run lint` · `npm run test:ci` (baseline 989+1)
- New: `__tests__/components/PlayerLogPanel.test.tsx` — mocked fetch; pins: renders activity entry, renders battle outcome, error state, empty state (≥4)
- Law-4 greps: `/api/factory/abandon` ≥1 client caller; `logs/player` ≥1 client caller; `DELETE ALL UNITS` → 0 matches
- Sweep closure: census re-run shows 1 orphan remaining class = none (both routes gain callers)

## Loop record

**Pass 1** (sequential-thinking audit, 4 thoughts): found 2 pre-implementation risks — (a) `player.username` on the GameContext type needed a probe (ASSUMPTION verified: exists, `context/GameContext.tsx:102`); (b) component-test harness convention probed (house idiom: `__tests__/components/**`, jsdom, `global.fetch = vi.fn()` per AddFriendModal.test.tsx). One contract note added to plan: the logs route returns PLAIN JSON (no success envelope) — component written against that. Zero plan amendments; the plan as filed was correct.

## Implementation record

**Files (5):**
1. `components/FactoryManagementPanel.tsx` — `handleAbandon` → `POST /api/factory/abandon` `{factoryX, factoryY}`; both false "DELETE ALL UNITS" strings replaced with FID-20260914-009 truth (units unaffected); error toast copy updated
2. `app/api/factory/abandon/route.ts` — `productionRate: 1` added to reset `$set` (release-parity; display-only field)
3. `components/PlayerLogPanel.tsx` (new) — tabs all/activity/battle; plain-JSON contract; combat-stats wells; outcome coloring per `BattleOutcome`; empty/loading/error states; `encodeURIComponent` on username
4. `app/profile/ProfileView.tsx` — `PlayerLogPanel` hosted above Battle Statistics, `player.username` from context
5. `__tests__/components/PlayerLogPanel.test.tsx` (new) — 6 pins: activity render + URL, battle render + outcome + stats, failed-activity errorCode, non-OK error state, empty state, tab refetch

**Gates (fresh, post-implementation):** `tsc --noEmit` exit 0 · `eslint` exit 0 · `vitest` **995 passed / 1 skipped** (baseline 989 + 6 new)

**Gate-1 self-correction:** the new suite's own assertion `getByText('1')` was ambiguous (two wells both render "1") — re-scoped to labeled selectors; re-run green. Component code needed no changes.

**Law-4 reachability:** `/api/factory/abandon` → 1 client caller (FactoryManagementPanel:118) · `logs/player` → 1 client caller (PlayerLogPanel:107 + ProfileView import) · `DELETE ALL UNITS` → **0 matches** · `/api/factory/release` retained for batch mode (FactoryManagementPanel:149)

**Sweep closure:** both census orphans now have live callers; zero dead routes remain from the 237-route sweep.

## Audit record

Closed 2026-09-17 (session 041) on operator go-ahead. Batch hash: `ef64421`
(7 files, +475/−5: 4 implementation paths, 1 test suite, the FID itself, SCOPE rows
76+77 hunk-staged via index reconstruction — row 78 held back). Gates re-verified
fresh this session before commit: tsc 0 · eslint 0 (all 5 code paths) ·
PlayerLogPanel pins 6/6; full-suite 995+1skip recorded at implementation and
unchanged by commit. Law-4 reachability and sweep-closure claims audited against
the implementation record — both accurate. Archived at closure.
