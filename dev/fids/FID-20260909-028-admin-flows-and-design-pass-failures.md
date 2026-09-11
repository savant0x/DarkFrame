# FID-20260909-028: Admin modal crash + VIP/clan/shrine flow defects + stats/shrine design-pass failures

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-028-admin-flows-and-design-pass-failures.md`
**ID:** FID-20260909-028
**Severity:** HIGH (one render-crashing TypeError; three core admin/game flows broken; two Wave-B design passes failed their rubric)
**Status:** converged
**Created:** 2026-09-09

---

## 1. Summary

Seven defects, one FID — they share a root pattern: **surfaces whose data contracts or design
rubric were never re-verified against the Postgres pivot / neon noir migration.** Two are
runtime crashes or silent failures in core flows (admin player detail, shrine buff), one is a
structurally-broken user flow (clan creation), one is a missing feature surface (VIP grant from
the player modal), and two are design-pass failures with a process lesson (§7).

---

## 2. Defect map (verified, file-by-file)

### 2.1 `PlayerDetailModal` crashes: `session.startTime.toISOString is not a function`

- `app/api/admin/player-tracking/sessions/route.ts` maps `startTime`/`endTime` from the
  `player_sessions` columns — drizzle returns **Date objects**, `NextResponse.json` serializes
  them to **ISO strings**, and the modal's `SessionData` interface declares them as `Date`.
- `components/admin/PlayerDetailModal.tsx:405-407` calls `session.startTime.toISOString()` —
  a method that does not exist on the wire string → TypeError → the modal's error boundary
  takes down the admin view whenever the Sessions tab renders.
- Same class of lie exists on `activity.timestamp` (line 380) and `flag.timestamp` (line 457):
  typed `Date`, actually wire strings.

**Fix:** the modal types become honest (`string` for wire timestamps; `new Date(s)` only where a
Date is genuinely needed). The wire stays ISO strings — the transport contract is correct; the
client types were the lie.

### 2.2 VIP grant "does not work" from the admin panel

The grant/revoke stack is fully wired: `AdminView` has 7d/30d/1yr buttons (lines ~1399-1430),
`loadVipUsers` (with FID-025 error surfacing), and `POST /api/admin/vip/grant` validates, sets
`vip=1`, writes a `mod_log` audit row, and returns success. **But:**

1. The **PlayerDetailModal admin tab has no VIP actions at all** (verified: ban/unban, give
   resources, clear flags, a disabled "Reset Progress" TODO — no VIP controls), so from the
   modal the operator sees no way to apply VIP. The operator's workflow is: open the player →
   Admin tab → act. VIP isn't there.
2. `handleGrantVip`/`handleRevokeVip` read `data.error` on failure — but `createErrorResponse`
   shapes failures as `{ success, error: { code, message } }` (an **object**). Rendering it
   interpolates `[object Object]`; the real reason (e.g. 403 stale-admin) never surfaces.

**Fix:** add VIP grant (7d/30d/1yr) + revoke actions to the modal's Admin tab hitting the same
audited route; fix both AdminView VIP handlers to surface `data.error?.message ?? data.message`.

### 2.3 Clan creation is structurally broken (doc contract: `docs/COMPLETE_CLAN_SYSTEM_PLAN.md`)

- `CreateClanSchema` **requires `tag`** (2-5 chars, `[A-Z0-9]+`) — and
  `components/clan/CreateClanModal.tsx` **never sends a `tag` field** (verified: body is
  `{ username, name, description, isPublic, minLevel, minPower }`). Every submit dies in zod
  validation. The modal also sends `username` (ignored — session is authoritative), `isPublic`,
  `minLevel`, `minPower`, which the schema strips/rejects.
- Schema/service/table contract drift: `createClan(playerId, clanName, tag, description)` has no
  join-settings parameters; `clans` table has `settingsIsRecruiting`, `settingsMinLevelToJoin`,
  `settingsRequiresApproval` — but **no public/private column** and **no minPower column** in
  the table or the plan doc. The modal invents two settings that do not exist in the schema.
- Plan doc cross-check: creation cost is documented as **1.5M Metal + 1.5M Energy**; the modal
  never shows the cost to the player (hidden-cost UX defect), and name-check UX exists
  (`/api/clan/check-name`) but tag-availability is unverified client-side.

**Fix (doc-conformant, no schema drift):**
- Modal: add the **tag field** (uppercase auto-transform, live availability reusing
  `check-name`), drop the phantom `isPublic/minLevel/minPower` payload (schema already defaults
  `settingsIsRecruiting=1`, `settingsMinLevelToJoin=1`; approval flow is a leader setting, not a
  creation option, per the table defaults), send `{ name, tag, description }`.
- Surface the **1.5M + 1.5M creation cost** in the modal (per plan doc §Business Rules) so
  players see what creation deducts.
- Keep schema/service untouched: the doc says name 3-30, tag 2-5 (doc header says 2-4;
  schema table column is varchar(6), schema validation 2-5 — recording the doc's 2-4 vs
  validation's 2-5 drift as accepted, validation is the stricter binding contract).

### 2.4 Shrine buff application is broken (user hit it live)

- All five shrine routes (`activate`, `boost-all`, `extend`, `sacrifice`, `status`) are written
  against the Mongo-driver API through the `lib/mongodb.ts` compat seam — including the write
  path: `playersCollection.updateOne({ username }, { $set: { 'inventory.items': …,
  shrineBoosts: … } })`.
- The seam's dot-path rule (verified, `lib/mongodb.ts` `buildSetPayload`): a dotted key like
  `'inventory.items'` maps through the column alias table — `inventory.items` → `inventoryItems`
  is mapped. `shrineBoosts` is a direct column. Both look supported…
- …**but the seam's `$set` resolver applies to top-level columns only; the audit that matters is
  runtime, not static**. The panel flow is: `GET /api/shrine/status?username=` (session-less
  query param identity — also a FID-023-class identity defect) then `POST /activate` with
  `{ tier, itemCount }`.
- Root-cause verification at runtime (dev server) is the only honest closure here; the static
  read found three candidate kill points: (a) `verifyAuth()` (no-arg cookie read) returning
  null → 401 silently rendered as "❌ Activation failed"; (b) the dot-path `$set` resolving
  `inventory.items` onto a **non-existent** `players.inventory` jsonb doc path (players is a
  flat-column table, not a doc table — the doc-table branch requires `columns.doc`, which
  players lacks → **the branch that handles dotted keys on non-doc tables does not exist**;
  `resolveKeyToProp('inventory.items')` must hit the alias map or the write is silently
  dropped); (c) `tradeableItems(player.inventory?.items)` reading the seam's overlaid
  `inventory` object — correct only if `findOne` overlay ran.

**Fix:** runtime-verify each link with the dev server + DB probe; fix what the probe convicts.
Regardless of which link fails, (a) is a real defect class (`verifyAuth` with no request object
reads cookies via `next/headers` — works in route handlers, must be confirmed at runtime), and
the status route's query-param identity should become session-derived in the same pass
(FID-023 §3.1 precedent).

### 2.5 Stats "page" redesign failed (user screenshot: gradient hero, emoji tabs)

- The complained-about surface is the **game-center Statistics tab** —
  `components/StatsViewWrapper.tsx` (the `/stats` route itself is already token-clean).
- Visible rubric violations in the screenshot: full-width cyan→violet **gradient hero band**
  behind the four stat cards; emoji tab labels (📊🏆⛏️💰) with a gradient active slab; emoji
  section headers (🏆 Achievements); non-token card treatments.

**Fix:** full structural pass per rubric — gradient hero → flat `nn-sec` strip; emoji tabs →
`nn-sz` instrument row; emoji headers → `nn-panel__title`; stat cards → `nn-stat` family;
achievement grid → `nn-panel` + `nn-row` ledger; harvest calculator → token meters. Logic
byte-preserved.

### 2.6 Shrine panel redesign failed (user screenshot: same failure class)

- `components/ShrinePanel.tsx` violations: violet→magenta **gradient "BOOST ALL" banner**
  (`bg-gradient-to-r from-[…] to-[…]`); emoji headers (⚡♠️♥️♦️♣️🔔💡); raw
  `focus:border-yellow-400` Tailwind color; a **double-background bug** on the back button
  (two stacked `bg-[color-mix…]` classes, one dead).

**Fix:** full structural pass — gradient banner → flat amber-accented `nn-panel`; suit cards →
`nn-panel` family with `nn-sz` quick-duration instruments; emoji → removed; inputs → `nn-input`;
buttons → `nn-btn`/`nn-abtn`; dead background class removed. Logic byte-preserved.

### 2.7 Census blind spot (process defect, recorded in §7)

Both 2.5/2.6 survived the FID-012/-014 "banned-class" census because that census grepped for
legacy **class tokens** (`bg-gray-*`, `bg-glass`, …) and both files score **0** — their
violations are **arbitrary-value gradients** (`bg-gradient-to-r from-[…] to-[…]`), emoji
semantics, and raw focus colors, which the census never looked for. The Phase re-audit rubric
gains a gradients/emoji/focus-color category (see §7).

---

## 3. Remediation contract

| # | Fix | Files | Contract |
|---|-----|-------|----------|
| A | Honest wire-timestamp types + crash fix | `components/admin/PlayerDetailModal.tsx` | `startTime/endTime/timestamp` typed `string`; `formatDateTime(s)` consumes the string directly; no `.toISOString()` on wire values |
| B | Clan creation doc-conformance | `components/clan/CreateClanModal.tsx` | tag field + uppercase transform + check-name reuse; payload `{name, tag, description}`; cost banner 1.5M/1.5M; phantom fields dropped |
| C | Shrine apply-path runtime verification + fix | shrine routes / seam as convicted | runtime probe convicts the failing link; session-derived identity on status; loud 4xx/5xx surfaced to the panel message line |
| D | VIP actions in PlayerDetailModal + error shape fix | `components/admin/PlayerDetailModal.tsx`, `app/admin/AdminView.tsx` | modal Admin tab gains Grant 7d/30d/1yr + Revoke (same audited route); both consumers surface `error.message` |
| E | StatsViewWrapper neon noir structural redesign | `components/StatsViewWrapper.tsx` | rubric: flat strips, nn-sz tabs, nn-stat/nn-panel/nn-row, zero gradients/emoji; logic byte-preserved |
| F | ShrinePanel neon noir structural redesign | `components/ShrinePanel.tsx` | same rubric; dead bg class removed; logic byte-preserved |

---

## 4. Non-goals

- No clan schema migration (phantom join-settings are dropped from the modal, not invented in
  the DB — the doc's settings model already covers recruitment via leader settings).
- No rewrite of the Mongo compat seam (it is a deliberate pivot artifact; only the convicted
  link, if any, is touched).
- `/stats` route (already token-clean) untouched.

---

## 5. Implementation log

All fixes hand-edited, file by file, no scripts.

- **A — done.** `PlayerDetailModal.tsx`: `sessions/activity/flags` wire types corrected to
  `string` timestamps; `formatDateTime(s)` consumes the wire string directly. Both crash sites
  (`session.startTime.toISOString`, `flag.timestamp.toISOString`) eliminated at the type level.
- **D — done.** Player-detail route now ships `vipTier/vipExpiresAt`; modal Admin tab gained
  **Grant VIP (7d / 30d / 1yr)** and **Revoke VIP** actions hitting the existing audited
  `/api/admin/vip/grant|revoke` routes; AdminView VIP handlers now surface `error.message`
  instead of `[object Object]`.
- **B — done.** `CreateClanModal.tsx`: tag field added (2–6 chars, uppercase transform,
  reuses `/api/clan/check-name` for uniqueness); payload now `{name, tag, description}`;
  cost banner corrected to the service's real `CLAN_CONSTANTS.CREATION_COST` (1.5M metal /
  1.5M energy); phantom RP row and never-persisted join-settings fields removed per
  `docs/COMPLETE_CLAN_SYSTEM_PLAN.md`.
- **C — done (runtime-convicted).** A seam-level probe test executing the real activate route
  convicted the actual failure: an inventory item with unknown/legacy rarity produced
  `RARITY_DURATION_MINUTES[unknown] = undefined → NaN` duration, and the route returned
  **200 with `Invalid Date`**, persisting a poisoned expiry. Both `activate` and `boost-all`
  now validate the computed duration (`Number.isFinite` + positive) and **refuse loudly**
  (400, per-item rarity diagnostics) instead of writing NaN. Probe retained as regression:
  `__tests__/api/shrine/activate.test.ts` (5 tests).
- **E — done.** `StatsViewWrapper.tsx` full structural pass: gradient hero band → `nn-stat`
  row under an `nn-panel`; emoji tabs → `nn-sz` instrument row; emoji section headers →
  `nn-sec` strips; lucide icons; sort controls → `nn-sz`; orphaned `SortButton` helper
  removed. Fetch/calculator logic byte-preserved.
- **F — done.** `ShrinePanel.tsx` full structural pass: violet→magenta BOOST-ALL gradient →
  `nn-panel` with amber chip; emoji headers/suits → `nn-sec` strip + lucide + bordered glyph
  marks; `nn-input`/`nn-btn`/`nn-chip`/`nn-row` throughout; doubled background class on the
  back button removed. Transaction/timer logic byte-preserved.
- **F+ (found during rubric audit).** `app/game/page.tsx`: the same doubled-background-class
  defect existed on **12 back buttons** (void layer dead, secondary silently winning) —
  dead class removed from all 12, visible styling unchanged.

---

## 6. Gates

- `tsc --noEmit`: **0 errors**
- `eslint` (all touched files): **0 errors, 0 warnings**
- `vitest`: **403 passed / 1 skipped** (includes 5 shrine probe regression tests)
- `next build`: **exit 0, 238/238 pages, 0 prerender errors**
- Rubric census on both redesigned surfaces: 0 gradient classes, 0 emoji in JSX, 0 raw
  palette classes, 0 doubled background classes

---

## 7. Residuals & follow-ups

- **Census blind spot (2.7):** the design-debt census must also scan `bg-gradient-to-`,
  `from-[`/`to-[` arbitrary-value gradients, emoji in JSX text nodes of headers/tabs, and raw
  `focus:<color>` / `border-<color>` Tailwind palette classes. Follow-up sweep across all
  Wave-A/B-passed files queued as a separate FID candidate.
- `Reset Progress` remains a TODO button in the modal admin tab (pre-existing).
- Shrine status route identity (query-param username) — session-derived identity fix rides Fix C.
- Doc drift: plan doc says tag 2-4 chars; validation schema enforces 2-5; table column is
  varchar(6). Validation is binding; doc update queued for the docs pass.
