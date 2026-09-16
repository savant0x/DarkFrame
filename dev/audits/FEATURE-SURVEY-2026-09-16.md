# FEATURE SURVEY — 2026-09-16: what the game needs next (ground-truth census)

**Method:** full route census (`find app/api -name route.ts` → 190 routes) cross-checked
against every client `fetch` (components/app/lib), with Law-16-style probes on every
load-bearing "broken"/"latent" verdict (no Next.js rewrites exist — checked). Recorded
product calls harvested from session records and closed FIDs.

---

## P0 — Broken UI: panels calling routes that DO NOT EXIST (players hit this today)

| # | Panel | Calls | Reality | Player-visible failure |
| - | ----- | ----- | ------- | ---------------------- |
| 1 | `DiscoveryLogPanel` | `GET /api/discoveries?username=` | Only `discovery/status` exists | Panel errors on open; X/15 discovery progress never loads |
| 2 | `FriendsList` | `GET /api/friends/online` | Route absent (friends core exists) | Online-friends list always fails |
| 3 | `FriendsList` | `GET /api/friends/requests/[id]/action`-class handling + block | `friends/block` absent | Block action dead in `FriendActionsMenu` |
| 4 | `FriendActionsMenu` | `DELETE /api/friends/[id]`-adjacent block flows | partial | Remove/block inconsistent |

- **Disposition ask:** rebuild the three missing endpoints against `lib/friendsService`
  / `lib/discoveryService` (backends exist — this is contract re-wiring, not new systems),
  or panel-level graceful degradation + route build behind one FID.
- Note: the 2026-09-04 audit fixed the admin modal's dead endpoints (#22); this is the
  **player-side** sibling nobody swept — SCOPE never carried it.

## P1 — Recorded product call: surface sabotage in the WMD Intelligence Panel

The -007 enforcement made sabotage fully functional server-side (route repaired, owner-
derived targets, void at commit, 4/4 probes). No client sends `action: 'sabotage'` — the
panel only does RECONNAISSANCE missions. Enforcement sits dormant until a UI ships.
**The panel is the natural home** (it already lists missiles/batteries/research rows with
owner data). Ask: commit the sabotage tab + confirmation flow (target → victim preview →
fire), with the protection parity message + skill-floor refusals surfaced verbatim.

## P2 — Latent PvP/combat routes (server-live, zero UI)

| Route | What it would give the game |
| ----- | --------------------------- |
| `POST /api/battle/attack` | Generic PvP battle resolution (protected by -008 seams; needs targeting UI + army composition flow) |
| `POST /api/clan/warfare/capture` | Territory capture from the map UI (war-gated; treasury-funded) |
| `POST /api/clan/research/contribute` + `unlock` | Clan research: no panel exists at all — the clan tech tree is unreachable |
| `POST /api/shrine/sacrifice` + `extend` + `status` | Shrine system beyond the two wired actions |
| `POST /api/tutorial/complete` | Tutorial completion endpoint — the tutorial presumably ends some other way; dead seam |
| `POST /api/bot-migration` | Admin-adjacent; likely correctly latent |
| `POST /api/fast-travel` | Wired (3 refs) — fine |

## P3 — Inert-by-design systems awaiting an operator product call

- **Specialization mastery** (`specialization/mastery` route exists; -2026-09-14 audit
  verdict: "built but inert — zero bonus consumers"). Choosing a spec writes data nothing
  reads. Either wire bonuses into combat/economy or hide the UI.
- **Flag-holder survival economics** — audit flagged survival as unaudited.

## Priorities (recommendation)

1. **P0 friends/discovery endpoints** — only true breakage; small, contract re-wiring.
2. **P1 sabotage UI** — the recorded product call; completes the -007 story.
3. **P2 clan research panel** — biggest unreached system (a whole tech tree).
4. Everything else as appetite allows.

---

**Erratum/honesty:** client fetch census greps can't see dynamically-built URLs; each
"latent" verdict above was re-probed for dynamic construction (template literals, variable
paths) before landing here. `clan/research/contribute` showed 1 ref — from the route's own
file; re-verified zero UI callers.

---

## Erratum (2026-09-16, session 030 — re-verification pass)

- **P3 specialization verdict STALE:** "zero bonus consumers" was true at audit time
  (2026-09-14) but is false now. `battleService:374` consumes doctrine bonuses in
  `resolveBattle` (STR/DEF multipliers, mastery-amplified via
  `masteryAmplificationPercent` at specializationService:195), `factoryService:262,555`
  applies cost multipliers, and `statTrackingService:77,116` awards mastery XP on
  battle wins / unit builds. The choose-flow stays; no wiring work needed.
- **Tutorial "dead seam" refined:** the tutorial ends by DESIGN through action
  tracking — `track-action` auto-completes steps at target and the overlay handles
  `result.tutorialComplete`; `skipTutorial` (via `/decline`) also sets the flag.
  `POST /api/tutorial/complete` (0 UI callers) is a likely-redundant legacy path —
  deletion candidate pending a writer census, not a feature to build.
