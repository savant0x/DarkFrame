# FID-20260908-021: Repo-wide lint debt remediation — the 295 `any`s policy

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-021-repo-wide-lint-debt-remediation.md`
**ID:** FID-20260908-021
**Severity:** LOW (type hygiene; no runtime behavior change — but untyped seams around socket.io emit and auth user fields are where real bugs hide)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

FID-016's full-repo lint run surfaced 325 pre-existing errors. FID-017/018/019/020's
in-scope gates retired 26 en route. The standing census is **299 problems: 295
`no-explicit-any`, 1 `no-unused-vars`**, plus 3 pre-existing `react-hooks/exhaustive-deps`
warnings that are **out of scope** (each has behavior risk if "fixed" without
understanding the callback lifecycle — recorded, not touched).

## 2. Evidence (RED) — census at FID open

| Bucket | Count | Character |
| ------ | ----- | --------- |
| `lib/**` services | 192 | `: any` params typed against drizzle rows / JSON payloads |
| `__tests__/**` | 53 | test fixtures & mock rows |
| `scripts/*.ts` | 15 | one-off ops/maintenance scripts (TS, not JS/CJS) |
| `app/**` | 14 | API routes mapping untyped payloads |
| `components/**` | 12 | payload-mapping callbacks |
| `vitest.setup.ts` | 8 | global test mocks |
| `hooks/**` | 3 | socket conditional-type `args: any[]` idiom |
| `no-unused-vars` | 1 | `InventoryItem` import, `app/api/shrine/boost-all/route.ts:16` |

## 3. Policy decision (the scripts-vs-typing question, answered per bucket)

1. **`scripts/*.ts` + `dev/scripts/*.ts` → OVERRIDE (not typing).** These are
   one-off ops/maintenance scripts executed manually against prod data, not
   shipped code. The existing override already exempts `.js/.cjs` siblings on
   exactly this rationale; the `.ts` gap is an accident of file extension, not a
   policy. Typing 15 throwaway scripts buys nothing. The override is extended
   honestly and documented.
2. **`lib/websocket/**` → HAND-TYPE ALL 15.** Operator-named target. This is live
   server code: broadcast.ts's 5 `payload as any` are socket.io generic-emit
   workarounds (fixed by typing against socket.io's own `ServerToClientEvents`
   emit contract); chatHandler's casts reach into `AuthenticatedUser` where the
   interface *already has* `level` (the cast is blind) and only `isVIP` is
   genuinely missing (added to the interface, not cast around); chat.test's 5
   socket-event promises get their real payload shapes.
3. **Everything else → HAND-TYPE, no blanket override.** Services, routes,
   components, tests, setup: each site is typed against its real contract
   (drizzle `$inferSelect`, wire payload interfaces, `unknown` for opaque data).
   No suppressions anywhere.

## 4. Five Questions

1. **Root cause?** The codebase predated the strict `any` rule for most of its life.
2. **Reproduce?** `npx eslint . | grep -c no-explicit-any` (295 at FID open).
3. **Smallest correct fix?** Policy matrix above; per-site honest typing with
   `tsc` between files.
4. **Verify?** Per-file tsc; final `npx eslint .` = 0 errors; vitest 362/0/1;
   no new `eslint-disable` anywhere.
5. **Side effects?** Types-only + one interface field addition + config override;
   no runtime change.

## 5. Proposed Fix (GREEN)

1. Extend `.eslintrc.json` ops override to `scripts/**/*.ts` + `dev/scripts/**/*.ts`.
2. Hand-type lib/websocket family (broadcast, chatHandler, auth interface, chat.test).
3. Delete the unused `InventoryItem` import.
4. Hand-type hooks (3), `lib/toast` (1), `lib/test-utils` (2), `vitest.setup.ts` (8).
5. Hand-type remaining lib services, `__tests__`, app routes, components in
   census order until `eslint .` reports 0 errors.
6. The 3 `exhaustive-deps` warnings remain (recorded, out of scope).## 6. Audit Record

**Per-bucket outcomes (not all matched the open-plan bucket sizes — the honest census at
implementation split differently, recorded here):**

- **Dead code deleted instead of typed (the two largest single wins):**
  - `lib/queryOptimization.ts` (19 sites) — zero importers anywhere (only the
    `lib/index.ts` barrel re-exported it; every "caller" hit was MongoDB collection
    method name-collisions). Barrel line removed, file deleted. tsc proved the case.
  - `lib/battleLogService.ts` `logBattle`/`logBattlesBulk` (dead writers) — typed
    against a mongo-era `BattleLog` shape (`_id`, `UnitSnapshot[]`) that structurally
    misfits the drizzle schema (`jsonb().$type<Unit[]>()`); they could never have
    compiled-and-run. Removed; readers with real callers typed properly.
- **Seam fixes (root, not per-consumer):**
  - `lib/mongodb.ts` `aggregate()` — pipeline result type is independent of the
    collection type (mirrors the real driver); `TResult = T` parameter added with
    still exactly one boundary assertion. Unblocked every `$group` consumer.
  - `lib/websocket/auth.ts` — `AuthenticatedUser.isVIP: boolean` added and
    populated from the db (`fetchUserData` never selected `vip`; the `?? user.vip`
    fallback in chatHandler was dead code).
  - `types/game.types.ts` — `Player.lastBotScan` added (the service writes it);
    `Player` already carried `shrineBoosts` (antiCheat annotations were noise).
  - `context/GameContext.tsx` — `GameContextState` exported (additive) for test views.
- **Live bugs the honest types exposed and fixed:**
  - `app/api/chat/channels/route.ts` — `player.isVIP === true` on a `smallint` column
    could never be true; fixed to the established `vip === 1` idiom.
  - `app/api/clan/perks/available/route.ts` — `clan.level` (field is `levelCurrentLevel`)
    and `auth.player.isVIP` (field is `vip`) read `undefined` at runtime.
  - `lib/clanLevelService.ts` — `lastXPGain` update was a phantom column (silent no-op
    write); `lib/migrations/factorySlots.ts` — double-encoded jsonb (`JSON.stringify`
    into a jsonb column).
  - `lib/stripe/subscriptionService.ts` — select *aliased* `mongoId` to `id`, so the
    `row.mongoId` fallback was dead.
  - `__tests__/api/friends/*` — fixtures encoded a phantom API (nested `player` objects,
    `from`/`to` fields) the service never had; UI + service agree on the flat contract;
    21/21 tests pass on corrected fixtures.
- **Scripts override:** extended to `scripts/**/*.ts` + `dev/scripts/**/*.ts` (15 sites),
  documented in §3.1.
- **Out of scope (recorded, untouched):** the 3 `react-hooks/exhaustive-deps` warnings
  (GameContext, WebSocketContext, useWebSocket).

## 7. Implementation Record

- Census tooling: `scripts/lint-census-fid021.cjs` (argv-driven, read-only).
- Grind order: websocket family → hooks/toast/test-utils/setup → friends tests (contract
  drift surfaced & fixed) → queryOptimization (deleted, 19) → beerBaseAnalytics (15,
  13 via redundant-annotation removal) → ranking/botScanner/friend/battleLog (34) →
  clanChat (10) → researchPoint (9) → statTracking/clanResearch/clanService (19) →
  antiCheat (5) → clanAlliance/clanBank/botMagnet (11, incl. mapper numeric()/timestamp
  bugs fixed) → dm/moderation (8) → 12-file straggler batch → `Record<string,any>`
  update-builders → stripe → tests tail (channels, ask-veterans, BattleResultModal,
  MovementControls, FriendsList, AddFriendModal).
- Migration idiom for tests: `vi.mocked()` over `as any`; typed `Mock` alias for
  `(global.fetch as any)`; `Partial<GameContextState>` views for context fixtures.
- A str_replace misfire corrupted the `RPTransaction` region mid-flight (FID §5 Law 13:
  verify after each write) — caught by the tsc gate and repaired before continuing.

## 8. Closure

- **Gates:** [x] `npx eslint .` **0 errors** (3 pre-existing warnings, out of scope) ·
  [x] tsc 0 · [x] vitest **362 passed / 1 skipped** · [x] **0 suppressions added**
  (23 pre-existing `eslint-disable` comments unchanged; diff adds none)
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add .eslintrc.json lib/ types/ hooks/ context/ components/ app/ __tests__/ vitest.setup.ts scripts/lint-census-fid021.cjs dev/fids/FID-20260908-021-repo-wide-lint-debt-remediation.md dev/session-summaries/SESSION-2026-09-08-002.md`
- **Follow-through:** none — this FID closes the lint program; guard stays in `.eslintrc.json`.
