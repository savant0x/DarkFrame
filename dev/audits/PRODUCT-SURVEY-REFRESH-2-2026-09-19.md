# PRODUCT SURVEY REFRESH 2 — 2026-09-19: the board after the polish arc

**Method:** TODO/placeholder census across live code (56 hits triaged — dead code,
stale comments, and replaced stubs separated from real gaps), follow-through
verification of every surface shipped this arc, and targeted probes on the
notification and monetization paths. Law 16 throughout.

## Shipped since the last refresh (all live-verified)

- **Ask-veterans delivers** (0.0.18, `cdfaee7`): broadcast seam + honest count +
  veteran toasts. The false-success feature now reaches the game's one veteran.
- **Chat profile navigation** (0.0.19, `73754dc`): message senders link to
  `/profile/[username]`; the ChatMessage corpse + barrel archived.
- **Factory Manage tile button** (0.0.20, `a266d5f`): owner-only jump to
  `/game/unit-factory`; the FID-006 barrel residue repaired.
- **Chat item links + auction name search** (0.0.21, `ba16ab4`): `[ItemName]`
  links on the live renderer over the real catalog (the validation stub died),
  ILIKE name filter through the auction API, panel search box, `/game?market=`
  deep-link with tab preselection.
- **Deep-link open repair** (this session, `45525fa`): found during THIS refresh —
  the game page never opened the auction house from the `market` param (the
  panel consumed it but only mounts when open). A chat item-link click had no
  visible effect. Fixed: the page validates the param against the item-link
  route and opens the panel.

## Census findings

- **Stale TODO comments in ChatPanel (doc rot, not gaps):** "TODO Task 10:
  Implement WebSocket chat:ask_veterans" sits above the implemented HTTP call;
  the trailing IMPLEMENTATION NOTES block still lists chat:message/typing/online
  subscriptions as TODO — all shipped in FID-002. The block is false
  advertising to the next contributor. Small hygiene batch.
- **`lib/db/schema/notifications.ts` is an unwritten ledger**: zero live writers
  or readers (auction notifications deliver via DM system-conversations — live
  since FID-004; WMD uses its own `wmd_notifications` table + panel). Candidate:
  delete the block or adopt it as a real inbox; currently it misleads.
- The remaining "coming soon" hits in components are historical comments about
  stubs long replaced (StatsViewWrapper economy tab, TileInspectorModal edit).

## The remaining board (ranked)

| # | Item | Shape | Note |
|---|------|-------|------|
| 1 | **RP packages checkout** (`app/shop/rp-packages`: "TODO: Integrate Stripe payment") | Revenue-relevant; needs an operator decision: real Stripe checkout session flow reusing the VIP grant-path plumbing | The only live "this does nothing" button a paying player can reach |
| 2 | **Items table design FID** — tradeable listings are unnamed ("Tradeable Item" on the card, not linkable from chat) | Schema + migration + listing flow + card; design-first FID | Unlocks the full item economy; biggest remaining gameplay-system gap |
| 3 | **ChatPanel doc-rot hygiene** — rewrite the stale IMPLEMENTATION NOTES/TODO block to reflect shipped reality | 30-minute batch | Prevents the next false-premise survey |
| 4 | **notifications schema disposition** — delete the unwritten block or adopt it | Hygiene FID, operator call | Similar class to the shim exit: dead structure misleads |
| 5 | **PlayerDetailModal reset-progress** (admin, :671) | Small, scoped+logged admin endpoint | Convenience, not player-facing |
| 6 | **ChatPanel virtualization** (react-window) | Only when scroll pain is real | Standing park |

## Product verdict

Every player-facing surface from the original three surveys is now shipped,
honest, and probe-verified: the economy (auction/VIP), real-time (chat/DM/DM
notifications), new-player funnel (tutorial/protection/newbie chat/ask-veterans),
navigation (every route, nav target, and chat click lands somewhere real), and
clans (research/territory/alliance live). What remains is one monetization gap
(#1), one system-design frontier (#2), and hygiene (#3–#5). The game no longer
has any known surface that lies to players.

## Not product work (standing context)

Mongo era deleted (0.0.13); Stripe VIP grant path fixed (0.0.9); all technical-
debt tracks closed; suite 119 files / 1191 tests; tsc 0; eslint clean.
