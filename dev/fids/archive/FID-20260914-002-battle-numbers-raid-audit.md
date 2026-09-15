# FID-20260914-002: battle-numbers audit — counters, casualties, loot, flag drop

**Filename:** `FID-20260914-002-battle-numbers-raid-audit.md`
**ID:** FID-20260914-002
**Severity:** high
**Status:** verified
**Created:** 2026-09-14 12:46

---

## Summary

Operator-directed extensive audit of the battle-number pipeline surfaced five
evidence-cited issues: (1) the Battle Log panel's four counters are hardcoded
to zero, (2) base-raid garrisons have strength 0 so the attacker can never
lose a unit and defender casualties are phantom synthesized units, (3) raid
victories award RP that no report ever states, (4) there is no user-initiated
flag drop, (5) the troop-transport toggle is verified present and owner-gated
(operator owns the tech — server restart/hard-reload is the likely fix), and
(6) the 12h flag auto-drop never fires — the drop logic lives only in a cron
route that no scheduler ever invokes.

---

## Environment

- **OS:** Windows 11 (NTFS)
- **Node:** v25.2.1
- **Commit/State:** Working tree

---

## Detailed Description

### Issue 1 — Battle Log counters hardcoded to zero (HIGH)

`app/api/combat/logs/route.ts` — the summary endpoint the Battle Log panel
(`components/BattleLogLinks.tsx`) polls every 30s returns hardcoded zeros:

```ts
if (summaryParam === 'true') {
  // For now, return zero counts - this endpoint would need battle log collection
  return NextResponse.json({ success: true, attackCount: 0, defenseCount: 0,
    infantryCount: 0, landMineCount: 0 });
}
```

The Recent Raids feed (`/api/player/battle-history`) reads the real
`battle_logs` table — hence battles appear there while every counter stays 0.
The summary also trusts the query-string username (session-identity gap).

**Fix:** implement the counts against `battle_logs` (attacker/defender role
counts + INFANTRY-type count), bound to the session identity, and keep the
land-mine count at 0 with a comment (no `LandMine` battle type exists —
future-proofing row).

### Issue 2 — garrison STR 0: no attacker losses, phantom casualties (HIGH)

`app/api/combat/attack/route.ts` `synthesizeGarrison` builds a defense-only
garrison (`strength: 0`, DEF 20/unit, HP 15/unit, up to 500 units). With
`lib/battleService.calculateDamage`'s defender term `defSTR − attackerSTR/2`,
a STR-0 garrison deals only the 5-damage floor; raids end in 1 round (garrison
HP is tiny), 5 < one unit's 10 HP, so `calculateUnitLosses` returns 0 attacker
casualties every raid — `applyAttackerCasualties` (guarded by
`unitsLost > 0`) never fires. The defender's "casualties" are the phantom
synthesized units, not a real army.

**Fix (per docs/design/BASE_RAID_BALANCE.md):** the garrison mirrors the
raider's weight class — total STR floored at `ceil(attackerSTR ×
GARRISON_STR_RATIO)` (0.6), per-unit STR redistributed; size
`clamp(ceil(totalDefense/20), 8, 60)`; named constants for every knob so the
doc's tuning table is actionable.

### Issue 3 — winner receives unstated RP (MEDIUM)

`app/api/combat/attack/route.ts` awards `100 + 20 × base.level` RP on every
raid victory (FID-20260911-044) AFTER `persistBattleLog` — the battle report
(the notification built from the battleLog) states loot + XP but never RP, so
the winner receives resources beyond what any report states.

**Fix:** award RP BEFORE persist and state it on the battleLog message (the
report's info line) so every reward is stated.

### Issue 4 — no user-initiated flag drop (MEDIUM)

The flag only leaves a holder via the 12h cron auto-drop, defeat, or theft.
`POST /api/flag/flee` is an escape-from-challenge (pays the challenger), not a
drop. No `/api/flag/drop` exists.

**Fix:** `POST /api/flag/drop` — bearer-only, mirrors the auto-drop write
(`currentHolder: null, currentHolderUsername: null`, lib/flagBotService:339),
SYSTEM notification via notifySystem; drop button wired into the flag UI.

### Issue 5 — troop-transport toggle report (INFO)

The toggle IS in the tree and verified (git status: MovementControls.tsx,
GameContext.tsx, move/route.ts, schemas.ts, neon-noir.css all modified; grep
receipts MovementControls.tsx:18/:73/:86/:189, CSS :1025-1058; tsc 0, eslint
0, vitest 736/0). It is owner-gated: it renders only when the player owns
`troop-transport`. Operator owns the tech — the likely fix is a dev-server
restart / hard reload (the server predates the changes).

### Issue 6 — 12h flag auto-drop never fires (HIGH)

The 12h hold-limit drop exists ONLY in `app/api/cron/flag-bot-movement`
(:105-146) — which no scheduler ever invokes: `vercel.json` lists only
player-snapshot + purge-old-data crons, and `server.ts` schedules the flag
job via `lib/jobs/flagBotManager` — whose handler has NO 12h logic. For a
human holder: `shouldResetFlag()` returns false (held flags are claimed —
the DEFECT FIX at lib/flagBotService:395), `getFlagBot()` returns null →
the job logs "Player holds flag - skipping movement" every 30 minutes
forever. Operator observed: ~3 days of continuous holding, no drop.

**Fix:** implement the 12h hold-limit drop in the scheduled job
(`flagBotManagerJob` — 30-minute cadence), mirroring the cron route's flags
update + milestone grant, and add the cron to vercel.json for production.

---

## Impact Assessment

### Affected Components

- `app/api/combat/logs/route.ts` (summary counts + session identity)
- `app/api/combat/attack/route.ts` (garrison constants + weight-class model,
  RP-before-persist + message statement)
- `docs/design/BASE_RAID_BALANCE.md` (new — mechanics source of truth)
- `app/api/flag/drop/route.ts` (new — user-initiated drop)
- `lib/jobs/flagBotManager.ts` (12h hold-limit drop in the scheduled job)
- `vercel.json` (flag-bot-movement cron entry)
- Flag UI (drop button)

### Risk Level

- [x] High: battle numbers are systematically wrong (counters dead, losses
  impossible, rewards unstated)

---

## Proposed Solution

1. Summary counts: drizzle count() queries on battle_logs by role + type,
   session-bound (query username ignored).
2. Garrison: named constants + weight-class model per the design doc.
3. Rewards: RP before persist, stated on the battleLog message.
4. Flag drop: POST /api/flag/drop (bearer-only) + UI button.
5. Toggle: verified present — operator restarts the dev server + hard reload.
6. 12h hold-limit drop implemented in the scheduled flag job + vercel.json
cron entry.

---

## Verification Gates

- gate: tsc (full repo)
- gate: eslint (full repo)
- gate: vitest (full suite)

---

## Perfection Loop

### Loop 1 -- RED

- **RED:** audit complete (evidence above, all five issues cited to files).
- **GREEN:** design doc + four fixes.
- **AUDIT:** Verifier agent (touches an active FID).

---

## Implementation Evidence

- **Files changed:** `app/api/combat/logs/route.ts` (real counts + session identity),
  `app/api/combat/attack/route.ts` (garrison constants + weight-class model, RP-before-persist
  + stated message), `docs/design/BASE_RAID_BALANCE.md` (new — mechanics source of truth),
  `app/api/flag/drop/route.ts` (new — user-initiated drop), `lib/jobs/flagBotManager.ts`
  (12h hold-limit drop in the scheduled job), `vercel.json` (flag-bot-movement cron),
  `components/FlagTrackerPanel.tsx` + `app/game/page.tsx` (drop button + handler).
- **Completion pass (session 2026-09-14, this FID's finish):** the stream arrived
  uncommitted with two corruption artifacts — a column-0 `} else {` in flagBotManager.ts
  and a malformed brace in vercel.json (same CRLF-write class FID-20260914-001's
  self-correct note documented) — both repaired and JSON-parse/grep-verified. The garrison
  size floor was `Math.max(1, …)`, contradicting the FID's `clamp(…, 8, 60)` — aligned via
  a named `GARRISON_SIZE_FLOOR = 8` constant. The design doc listed a `GARRISON_HP = 15`
  knob, but battleService derives HP from `strength > 0` (STR units = 10 HP,
  `HP_PER_STR_UNIT`) — the garrison units are STR-class, so the doc was corrected to mark
  HP as derived (10), and the T1 tuning row fixed (120→80 HP).
- **tsc:** exit 0 (2026-09-14 17:15 EDT).
- **eslint:** exit 0 (2026-09-14 17:15 EDT).
- **vitest:** 75 passed | 1 skipped (76 files), 736 passed | 1 skipped (737), 0 failures
  (2026-09-14 17:15 EDT).
- **Law 4 reachability:** the 12h drop lives in `flagBotManagerJob`, executed by
  `startFlagBotJob` (`server.ts:299`) on the 30-minute interval (`FLAG_BOT_JOB_CONFIG.interval`)
  plus the vercel cron for production; `GARRISON_SIZE_FLOOR` declared (`attack/route.ts:109`)
  + consumed (`:120`); the drop flow is wired end to end — `POST /api/flag/drop` route exists,
  `onDrop` prop declared (`FlagTrackerPanel.tsx:64`) + button (`:344`), handler bound
  (`app/game/page.tsx:1450`) and fetching the route (`:940`).

---

## Resolution

- **Status:** verified (double audit: static gates + manual re-read of all changed files,
  2026-09-14).
- **Fix per issue:** (1) Battle Log counters are real drizzle `count()` queries on
  `battle_logs` by role/type, session-bound (query username ignored); landMineCount stays 0
  with a comment (no LandMine BattleType exists). (2) Garrison mirrors the raider's weight
  class — total STR floored at `ceil(attackerSTR × 0.6)`, redistributed per-unit, size
  `clamp(ceil(totalDefense/20), 8, 60)` — so attacker losses are real and casualties are
  proportional, per `docs/design/BASE_RAID_BALANCE.md`. (3) Raid RP is awarded BEFORE
  `persistBattleLog` and stated in the victory message ("+X XP, +Y RP"), which is set on the
  battleLog pre-persist; the response's `rewards` carries `rp`. (4) `POST /api/flag/drop`
  (bearer-only, mirrors the auto-drop write, SYSTEM notification) + Drop button in the
  bearer self-view (hidden while a steal channel is live — the channel owns the flag's
  fate). (5) Toggle verified present in the tree — operator action: restart the dev server
  + hard reload (the running process predates the changes). (6) The 12h hold-limit drop
  runs in the scheduled `flagBotManagerJob` (30-min cadence) AND is added to `vercel.json`
  (`*/30 * * * *`) for production.
- **Verification Evidence:** tsc 0, eslint 0, vitest 76 files / 737 tests / 0 failures,
  Law 4 grep receipts, vercel.json JSON-parse valid.

---

## Lessons Learned

1. A UI panel polling an endpoint that returns hardcoded zeros will look
   broken forever — the endpoint comment even said so. Wire counters to the
   same table the sibling feed reads.
2. Balance knobs belong in a design doc with a tuning table, not inline
   comments — the operator fine-tunes from the doc.
3. Rewards must be stated where they are granted: award before persist so
   the report carries every number.
4. An uncommitted FID stream can still be broken: corruption artifacts
   (column-0 braces, JSON misindents) and doc-vs-implementation drift
   (a tuning constant battleService derives) survived the first pass —
   re-verify the artifact, not the claim.