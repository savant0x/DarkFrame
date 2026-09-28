# FID-20260928-007: Specialization mastery product call — the system is wired and live; nothing dormant to route

**Filename:** `FID-20260928-007-specialization-mastery-disposition.md`
**ID:** FID-20260928-007
**Severity:** LOW
**Status:** `no-action` (2026-09-28, no commit — terminal finding record, zero code delta; the verification evidence is §2's fresh probes)
**Created:** 2026-09-28

---

## 1. Summary

Row 69's last open item — the P3 "specialization mastery" line ("inert by design, awaiting an operator product call") — was dispositioned by operator directive: *"either route bonuses through the raid path or record why the system stays dormant."* Fresh Law-16 probes (2026-09-28, this session) verified every link of the chain **live on today's tree**: the choose flow (panel on its own page → `/api/specialization/choose` → service), doctrine consumption in combat (`resolveBattle` pulls `getDoctrineBonusesForUsernames` for both participants) and production (factory power + unit-cost discounts), and the mastery loop itself (battle wins and doctrine-matching builds award server-side mastery XP; `masteryAmplificationPercent` amplifies the bonuses that earn it). The 2026-09-14 "built but inert — zero bonus consumers" audit verdict was corrected by the survey erratum on 2026-09-16 and has been false since `4237f51` (FID-20260914-008, closed with "Phases 1–3 implemented + live-verified 2026-09-15"). Additionally, today's PvP gate opening (FID-20260928-006, `e7375c4`) **added a consumer surface for free**: human-vs-human base raids resolve through the same `resolveBattle` doctrine stack, so attacker and defender doctrine STR multipliers now apply to base raids too. **Disposition: no action required — the system stays live.** The dormancy question is closed on evidence, not assumed either way.

## 2. Evidence (fresh probes, all executed 2026-09-28)

| # | Chain link | Location | Evidence (command + excerpt) |
| - | ---------- | -------- | ---------------------------- |
| 1 | Amplification + doctrine exports exist | `lib/specializationService.ts:169-195` | `masteryAmplificationPercent(masteryLevel)`; `getDoctrineBonuses` applies `amp = 1 + masteryAmplificationPercent(masteryLevel)/100` |
| 2 | Combat consumption — `resolveBattle` pulls doctrine for BOTH sides | `lib/battleService.ts:371-388` | "FID-20260914-008 Phase 1: doctrine bonuses join the SAME bonus stack" — `getDoctrineBonusesForUsernames([attackerName, defenderName])`, never fails resolution |
| 3 | **NEW surface via FID-20260928-006:** base raids (PvE and the newly opened PvP) resolve through `resolveBattle` → doctrine applies to base raids automatically | `app/api/combat/attack/route.ts` (unified raid route) → `resolveBattle` | the route's battle resolution is `resolveBattle(...)` — no separate math, the doctrine stack rides the shared seam |
| 4 | Production consumption — doctrine power multiplier + unit-cost discounts | `lib/factoryService.ts:257-263, 553-557` | `power += floor(p.totalStrength * doctrine.strMul)`; `metalCost = ceil(UNIT_COST_METAL * doctrine.metalCostMul)` |
| 5 | Mastery XP is earnable and server-side | `lib/statTrackingService.ts:83-118` | "every battle won grants server-side mastery XP (never client-granted)"; "+10 per matching-category unit" (Offensive→STR, Defensive→DEF) |
| 6 | Player-facing choose flow is mounted and wired | `app/game/specialization/page.tsx:16,72` → `components/SpecializationPanel.tsx:192,233` → `app/api/specialization/choose/route.ts:23` | `<SpecializationPanel />` rendered; panel fetches `/api/specialization/choose` (+ `/switch`, `/mastery`); route imports `chooseSpecialization` |
| 7 | The "inert" premise has been false since 2026-09-15 | `dev/fids/archive/FID-20260914-008-specialization-system-audit-and-plan.md:11,118` | "closed (Phases 1–3 implemented + live-verified 2026-09-15)"; addendum: doctrine helper wiring, mastery XP hooks, client-grant exploit closed |

## 3. Disposition

- **No action required.** Every surface the original audit wanted wired is wired and verified fresh; the doctrine↔mastery loop is closed by construction (choose → bonuses apply in combat/production → wins/builds award mastery XP → mastery amplifies the bonuses).
- Row 69's P3 line closes on this FID; with the P2 lines already dispositioned (territory shipped, shrine live, tutorial by-design, battle line resolved on `e7375c4` per the ratified `PVP_BASE_RAID_DESIGN.md`), **row 69 is fully dispositioned and closes** with this FID.
- **Honest limitations:** (1) mastery *level progression pace* (curve tuning) is un-audited here — the call was wiring, not balance; the curve can be swept later on telemetry like the combat ladders were. (2) `slotRegenMultiplier` remains a recorded dead knob (BASE_RAID_BALANCE.md) — unrelated to mastery, left recorded. (3) The probes are static consumption censuses, not live battle replays; resolveBattle's doctrine behavior is additionally pinned by `__tests__/lib/battleResolution.test.ts` and was live-verified in FID-20260914-008's Phase 1.

## 4. Closure

- **Status:** `no-action` (2026-09-28) — terminal finding record; no code change, no pins, no gates affected.
- **Archive:** `dev/fids/archive/` at filing; row 69 closure cites this FID; recorded in `SESSION-2026-09-28-008.md` follow-through and CHANGELOG 0.0.53.

---

**Final status:** no-action
