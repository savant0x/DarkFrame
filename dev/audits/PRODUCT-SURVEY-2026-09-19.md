# PRODUCT SURVEY — 2026-09-19: gameplay remainder after the technical-debt era

**Method:** every prior-survey claim re-probed per Law 16. Baselines: session-030
P2/P3 re-verification, session-037 shrine disposition, session-052 remainder
survey. Fresh surfaces: full dead-component census (components/ × importers),
chat TODO census, level/XP wiring, auction listing flow, socket event surface.

## Closed since session-052 (no longer product work)

- Chat honesty (report/block/delete) — FID-012, live-verified in-game.
- AlliancePanel mount — DONE (FID-010): Alliances tab in ClanPanel; the
  session-052 P1 is closed.
- Tutorial /complete deletion, inventory, VIP money path, dead-route +
  inverted-census arcs — closed.
- Progression visibility: StatsPanel renders Level + XP HUD rows (session-052's
  "level surfacing" hypothesis disprobed — never was a gap).
- Chat real-time SERVER side exists: chatHandlers emits `chat:message`,
  `chat:typing_start/stop`, `chat:online_count`, `chat:message_deleted`.

## P0 — Auction unit listings fabricate stats (economy integrity)

`CreateListingModal.tsx:106` hardcodes `unitStrength: 100, unitDefense: 50`
("TODO: Get from actual unit data") into every unit listing. The unit option IS
rendered and reachable, the listing route accepts it, escrow snapshots it, and
`AuctionListingCard.tsx:194` displays the fabricated numbers to buyers
("Str: 100 | Def: 50"). The buyer receives a unit whose stat object is fiction —
battle totals iterate the units jsonb, so purchased units miscount in combat.
Every unit type lists identically: the marketplace cannot price units honestly.

**Fix shape:** derive stats from `UNIT_CONFIGS` (already imported in the modal)
client-side AND override server-side at listing creation — the route must
construct the escrow snapshot from `unitType` alone, never trusting client stat
fields. Small FID, money-adjacent path, pins + one live round-trip probe.

## P1 — Chat is real-time on the server, polled on the client

ChatPanel's own backlog (:2204-2211) documents unstarted subscriptions:
`chat:message`, typing indicators, online count. The emissions all exist — this
shrank from session-052's "MessageThread TODOs" to client-only wiring. The
largest remaining player-experience gap per unit of effort.

## P1 — RESOLVED 2026-09-19: balance UI already exists (premise disprobed)

The "BalanceIndicator mounted nowhere" claim failed grounding twice over: the
mechanic's UI lives inside `StatsPanel` (STR/DEF meters, Balance status row with
power multiplier, Dealt/Taken combat multipliers, and the actionable
recommendation caution) and the leaderboard (Effective Power + balance status).
Full evidence and disposition: `BALANCE-UI-DISPOSITION-2026-09-19.md`. The
archived component stays archived; no mount, no build.


## P2 — Small honesty/polish stubs (chat TODO census, 20 sites)

- Profile modal from chat usernames (ChatMessage :267).
- Item-details modal on validated item links (route EXISTS; :304 TODO stale).
- ModerationPanel polling → socket events (Task 10 remnant).
- PlayerDetailModal reset-progress stub (:671).
- ChatPanel virtualization (react-window) — perf, only when scroll pain is real.

## P2 — Dead UI generation: 13 unmounted components, ~3,150 lines

Full census (importer-checked, barrel-aware, test-excluded):
AutoFarmStatsDisplay (271), BalanceIndicator (124, see P1), BattleLogModal
(194), BattleLogViewer (455), BattleStatsPanel (33), CombatAttackModal (467),
FactoryButton (272), FundDistributionPanel (464), HarvestButton (169 —
superseded by HarvestModal/TileRenderer), HarvestStatus (133), LevelUpModal
(229), PassiveIncomeDisplay (295), XPProgressBar (145). Superseded by newer
panels but never deleted; several carry their own orphaned test files.
Disposition: archive-or-delete batch (BalanceIndicator exempt pending P1).

## Closed-as-moot from SCOPE

- Row 16 (territory clan_activities divergent columns): the defect site is
  gone — territoryService no longer writes clan_activities.

## Not product work (standing context)

Stripe VIP grant-path fixed (0.0.9); Mongo era fully deleted (0.0.13); every
technical-debt track (shim, lint, docs residue, route censuses) is closed.

## Recommended order

1. **Auction unit-stat honesty FID** (P0) — money-adjacent, small, pins+probe.
2. **Chat real-time client wiring** (P1) — server emits; add subscriptions.
3. **BalanceIndicator mount-or-delete decision** (P1) — operator call.
4. **Dead-component archival batch** (P2) — hygiene, census-pinned.
5. Chat polish stubs (P2) — opportunistically with any chat work.
