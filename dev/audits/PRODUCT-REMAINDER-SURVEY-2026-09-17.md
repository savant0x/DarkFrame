# PRODUCT-REMAINDER SURVEY — 2026-09-17 (session 052)

**Method:** every claim probed live per Law 16. Baselines: session-030 P2/P3
re-verification + session-037 shrine disposition. Census surfaces: game pages,
player panels, TODO density, route existence vs client callers, mount graphs.

## Already closed since the last survey (no longer product work)

- Territory capture UI (FID-013) · shrine line (FID-20260917-002: dead economy
  deleted, presence enforced) · tutorial completion (session-030: ends by
  design at track-action; overlay handles completion) · P3 specialization
  (live, str/def multipliers; verdict flipped from "missing") · sabotage UI
  (FID-011) · clan research (FID-012) · P0 endpoints (FID-010) · dead-route +
  inverted-census arcs (FID-006/007) · inventory (FID-008) · VIP money path
  (FID-009, uncommitted batch).

## P0 — UI that lies to the player (chat action stubs, "Task 8")

`components/chat/ChatMessage.tsx` ships action buttons that show SUCCESS
toasts while doing nothing. Trust defects, not missing features:

1. **Report** (:184): toast "Message reported to moderators" — no route, no
   persistence exists anywhere (`chat_reports`/`chatReports`: zero hits;
   moderation schema has mutes/bans/warnings/mod_log only).
2. **Block** (:194): toast "Blocked <user>" — no block backend at all.
3. **Per-message delete** (:204): route `POST /api/chat/delete` EXISTS and
   ChatPanel calls it in its own flow (:948-950) — but ChatPanel never passes
   the `onDelete` prop into ChatMessage, so the button fires the stub path:
   toast "Message deleted", zero effect.

**Fix shape (proposed FID):** wire `onDelete` through (trivial, backend
exists); add report persistence (table + route + admin visibility);
block needs a product decision — chat-only visibility filter vs global
(party/friends/DM) blocking — before building.

**Decision (operator, post-survey): block = GLOBAL** — chat + DMs +
social interactions in one step. Recorded as the chat-honesty FID's
scope; touches friends/messaging services, not just chat.

## P1 — Invisible system: AlliancePanel mounted NOWHERE

`components/AlliancePanel.tsx` is complete UI (propose/break/contract flows)
and `app/api/clan/alliance/*` has five live routes — but no page, panel, or
tab mounts AlliancePanel (grep: zero importers). An entire diplomacy system
exists and players cannot reach it.

**Fix shape (proposed FID):** mount as a ClanPanel tab (candidate: the
existing `social` tab region) or a standalone entry; otherwise the system is
dead weight and both sides should be deleted. Mount is recommended — the
backend is live and this is the highest-value-per-effort product item left.

## P2 — Chat polish cluster (smaller, real)

- Profile modal from chat usernames (ChatMessage :223 TODO).
- Item-details modal on validated item links (route exists; :259 TODO —
  details modal absent).
- MessageThread real-time (Socket.io emission TODOs :270/:275) — DM thread
  is send/refresh only.
- ChatPanel perf/real-time backlog (:2132-2139): react-window virtualization,
  typing indicators, online count — documented, unstarted.

## P2 — Queued, evidence-complete, awaiting execution

- **Tutorial `/complete` deletion FID** — approved pre-restart, interrupted
  before filing. Route exists with ZERO client callers (re-probed today);
  census would flag it dead-weight. 30-minute FID.

## Roadmap context (not product, but queued)

FID-009 implementation batch uncommitted; Mongo Clusters A–D; SCOPE rows
#11 (territory income dedupe) and #22 (admin PlayerDetailModal — rebuilt
STALE-closed, verify) remain the standing tech-debt heads.

## Recommended order

1. Chat honesty FID (P0: wire delete, build report, decide block) — small,
   kills the lying-toaster class.
2. Alliance mount FID (P1) — full system unlock, backend already live.
3. Tutorial /complete deletion micro-FID (P2 queued).
4. Chat polish cluster (P2) — pick up alongside any future chat work.
